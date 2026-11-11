const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const PUB = path.join(__dirname, 'public');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.wasm':'application/wasm', '.ico':'image/x-icon', '.json':'application/json' };

/* ---------- Accounts (JSON file; use a real database for production) ---------- */
const DATA = path.join(__dirname, 'data'), DB = path.join(DATA, 'users.json');
let db = { users: [], sessions: {} };
try { db = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) {}
const save = () => { try { fs.mkdirSync(DATA, { recursive:true }); fs.writeFileSync(DB + '.tmp', JSON.stringify(db)); fs.renameSync(DB + '.tmp', DB); } catch (e) { console.error('save failed', e.message); } };
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const json = (r, code, o) => { r.writeHead(code, { 'Content-Type':'application/json' }); r.end(JSON.stringify(o)); };
const readBody = (q, cb) => { let d = ''; q.on('data', c => { d += c; if (d.length > 30000) q.destroy(); }); q.on('end', () => { try { cb(JSON.parse(d || '{}')); } catch (e) { cb(null); } }); };
const tokenOf = q => (q.headers.authorization || '').replace('Bearer ', '');
const userOf = q => { const id = db.sessions[tokenOf(q)]; return id && db.users.find(u => u.id === id); };
const pubUser = u => ({ username:u.username, email:u.email, created:u.created, data:u.data || null });
const tries = new Map();
const limited = q => {
  const ip = q.socket.remoteAddress, now = Date.now(), a = (tries.get(ip) || []).filter(t => now - t < 60000);
  a.push(now); tries.set(ip, a); return a.length > 12;
};

function api(q, r) {
  const route = q.url.split('?')[0];
  if (q.method === 'GET' && route === '/api/me') { const u = userOf(q); return u ? json(r, 200, pubUser(u)) : json(r, 401, { error:'Not signed in' }); }
  if (q.method !== 'POST') return json(r, 405, { error:'Method not allowed' });
  if (limited(q)) return json(r, 429, { error:'Too many attempts. Wait a minute and try again.' });
  readBody(q, b => {
    if (!b) return json(r, 400, { error:'Bad request' });
    const str = v => (typeof v === 'string' ? v.trim() : '');
    if (route === '/api/signup') {
      const email = str(b.email).toLowerCase(), username = str(b.username), pw = typeof b.password === 'string' ? b.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(r, 400, { error:'Enter a valid email address.' });
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return json(r, 400, { error:'Username must be 3-20 letters, numbers or underscores.' });
      if (pw.length < 8 || pw.length > 100) return json(r, 400, { error:'Password must be at least 8 characters.' });
      if (pw !== b.confirm) return json(r, 400, { error:'Passwords do not match.' });
      if (db.users.some(u => u.email === email)) return json(r, 409, { error:'That email is already used by another account.' });
      if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return json(r, 409, { error:'That username is taken.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const u = { id: crypto.randomBytes(8).toString('hex'), email, username, salt, hash: hashPw(pw, salt), created: Date.now(), data: null };
      db.users.push(u);
      const t = crypto.randomBytes(32).toString('hex'); db.sessions[t] = u.id; save();
      return json(r, 200, { token:t, user:pubUser(u) });
    }
    if (route === '/api/login') {
      const id = str(b.id).toLowerCase(), pw = typeof b.password === 'string' ? b.password : '';
      const u = db.users.find(x => x.email === id || x.username.toLowerCase() === id);
      const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
      if (!ok) return json(r, 401, { error:'Wrong email/username or password.' });
      const t = crypto.randomBytes(32).toString('hex'); db.sessions[t] = u.id; save();
      return json(r, 200, { token:t, user:pubUser(u) });
    }
    if (route === '/api/logout') { delete db.sessions[tokenOf(q)]; save(); return json(r, 200, { ok:true }); }
    if (route === '/api/save') {
      const u = userOf(q); if (!u) return json(r, 401, { error:'Not signed in' });
      const s = JSON.stringify(b.data || {}); if (s.length > 30000) return json(r, 413, { error:'Too large' });
      u.data = b.data || {}; save(); return json(r, 200, { ok:true });
    }
    json(r, 404, { error:'Not found' });
  });
}

/* ---------- Static files ---------- */
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/api/')) return api(q, r);
  const f = path.join(PUB, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(PUB)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end('Not found'); }
    const ext = path.extname(f);
    r.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': ext === '.wasm' ? 'public, max-age=86400' : 'no-cache' });
    r.end(d);
  });
});

/* ---------- Live games ---------- */
const wss = new WebSocketServer({ server: srv });
const games = new Map(); // code -> {code, priv, tc, a, b}
const send = (w, o) => w && w.readyState === 1 && w.send(JSON.stringify(o));
const pub = () => [...games.values()].filter(g => !g.priv && !g.b).map(g => ({ code: g.code, tc: g.tc, name: g.a.name }));
const bcast = () => wss.clients.forEach(c => send(c, { t: 'list', games: pub() }));
const clampTc = t => ({ m: Math.min(60, Math.max(1, +(t && t.m) || 10)), i: Math.min(30, Math.max(0, +(t && t.i) || 0)) });
function newCode() { let c; do c = String(Math.floor(100000 + Math.random() * 900000)); while (games.has(c)); return c; }
function leave(ws) {
  const g = ws.game; if (!g) return;
  ws.game = null; games.delete(g.code);
  const o = g.a === ws ? g.b : g.a;
  if (o) { o.game = null; send(o, { t: 'end', reason: 'Opponent left the game' }); }
  bcast();
}
function createGame(ws, priv, tc) {
  leave(ws);
  const g = { code: newCode(), priv, tc: clampTc(tc), a: ws, b: null };
  games.set(g.code, g); ws.game = g;
  send(ws, { t: 'created', code: g.code, priv: g.priv, tc: g.tc }); bcast();
}
function joinGame(ws, g) {
  leave(ws);
  g.b = ws; ws.game = g;
  const aWhite = Math.random() < 0.5;
  send(g.a, { t: 'start', color: aWhite ? 'w' : 'b', tc: g.tc, you: g.a.name, opp: g.b.name });
  send(g.b, { t: 'start', color: aWhite ? 'b' : 'w', tc: g.tc, you: g.b.name, opp: g.a.name });
  bcast();
}

wss.on('connection', ws => {
  ws.guest = 'Guest' + (1000 + Math.floor(Math.random() * 9000)); ws.name = ws.guest; ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { t: 'list', games: pub() });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'ping') return send(ws, { t:'pong' });
    if (m.t === 'auth') {
      const id = db.sessions[m.token], u = id && db.users.find(x => x.id === id);
      ws.name = u ? u.username : ws.guest; return send(ws, { t:'authed', name: ws.name });
    }
    if (m.t === 'create') createGame(ws, !!m.priv, m.tc);
    else if (m.t === 'quick') {
      const tc = clampTc(m.tc);
      const g = [...games.values()].find(x => !x.priv && !x.b && x.a !== ws && x.tc.m === tc.m && x.tc.i === tc.i);
      if (g) joinGame(ws, g); else createGame(ws, false, tc);
    } else if (m.t === 'join') {
      const g = games.get(String(m.code).trim());
      if (!g || g.b || g.a === ws) return send(ws, { t: 'err', msg: 'No open game with that code.' });
      joinGame(ws, g);
    } else if (['move','resign','timeout','draw','drawres'].includes(m.t)) {
      const g = ws.game; if (!g || !g.b) return;
      send(g.a === ws ? g.b : g.a, m);
    } else if (m.t === 'chat') {
      const g = ws.game; if (!g || !g.b) return;
      send(g.a === ws ? g.b : g.a, { t:'chat', text: String(m.text || '').slice(0, 200) });
    } else if (m.t === 'leave') leave(ws);
  });
  ws.on('close', () => leave(ws));
});
// keep connections alive through hosting proxies that close idle sockets
setInterval(() => wss.clients.forEach(c => { if (c.isAlive === false) return c.terminate(); c.isAlive = false; c.ping(); }), 30000);

srv.listen(process.env.PORT || 3000, () => console.log('HayChess running'));
