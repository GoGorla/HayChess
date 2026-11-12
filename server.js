const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const PUB = path.join(__dirname, 'public');
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.wasm':'application/wasm', '.ico':'image/x-icon', '.json':'application/json', '.txt':'text/plain' };

/* ---------- Accounts: one readable file (data/accounts.json) is the source of truth ---------- */
// Set DATA_DIR to a persistent disk path on your host so accounts survive restarts.
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const ACC = path.join(DATA, 'accounts.json'), SES = path.join(DATA, 'sessions.json'), UD = path.join(DATA, 'userdata.json'), OLD = path.join(DATA, 'users.json');
const NOTE = 'Every account on the site. Passwords are stored as one-way scrypt hashes (scrypt$salt$hash), never as plain text.';
const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const writeJSON = (f, o, pretty) => { try { fs.mkdirSync(DATA, { recursive:true }); fs.writeFileSync(f + '.tmp', JSON.stringify(o, null, pretty ? 2 : 0)); fs.renameSync(f + '.tmp', f); } catch (e) { console.error('save failed', f, e.message); } };
let accounts = (readJSON(ACC, null) || {}).accounts, sessions = readJSON(SES, {}), userdata = readJSON(UD, {});
if (!accounts) {                                          // import from the earlier users.json format, if present
  accounts = []; const old = readJSON(OLD, null);
  if (old) old.users.forEach(u => { accounts.push({ username:u.username, email:u.email, password:'scrypt$' + u.salt + '$' + u.hash, created:u.created, id:u.id }); if (u.data) userdata[u.id] = u.data; });
}
const saveAccounts = () => writeJSON(ACC, { _note: NOTE, accounts }, true);
const saveSessions = () => writeJSON(SES, sessions);
const saveUD = () => writeJSON(UD, userdata);
saveAccounts();

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const makePass = pw => { const s = crypto.randomBytes(16).toString('hex'); return 'scrypt$' + s + '$' + hashPw(pw, s); };
const checkPass = (pw, stored) => { const [, s, h] = String(stored).split('$'); try { return crypto.timingSafeEqual(Buffer.from(hashPw(pw, s), 'hex'), Buffer.from(h, 'hex')); } catch (e) { return false; } };
const json = (r, code, o) => { r.writeHead(code, { 'Content-Type':'application/json' }); r.end(JSON.stringify(o)); };
const readBody = (q, cb) => { let d = ''; q.on('data', c => { d += c; if (d.length > 30000) q.destroy(); }); q.on('end', () => { try { cb(JSON.parse(d || '{}')); } catch (e) { cb(null); } }); };
const tokenOf = q => (q.headers.authorization || '').replace('Bearer ', '');
const userOf = q => { const id = sessions[tokenOf(q)]; return id && accounts.find(u => u.id === id); };
const pubUser = u => ({ username:u.username, email:u.email, created:u.created, data:userdata[u.id] || null });
const tries = new Map();
const limited = q => {
  const ip = String(q.headers['x-forwarded-for'] || q.socket.remoteAddress).split(',')[0].trim(), now = Date.now();
  const a = (tries.get(ip) || []).filter(t => now - t < 60000); a.push(now); tries.set(ip, a); return a.length > 20;
};

// finds the Stockfish.js files the site owner dropped into public/js/stockfish/
function findEngine() {
  const dir = path.join(PUB, 'js', 'stockfish');
  let files = []; try { files = fs.readdirSync(dir); } catch (e) { return {}; }
  const js = files.filter(f => /^stockfish.*\.js$/i.test(f) && (/single|asm/i.test(f) || /^stockfish\.js$/i.test(f)));
  const rank = f => /lite.*single/i.test(f) ? 0 : /asm/i.test(f) ? 2 : /single/i.test(f) ? 1 : 3;
  js.sort((a, b) => rank(a) - rank(b));
  for (const f of js) { const w = f.replace(/\.js$/i, '.wasm'); if (/asm/i.test(f)) return { js:f }; if (files.includes(w)) return { js:f, wasm:w }; }
  return {};
}

function api(q, r) {
  const route = q.url.split('?')[0];
  if (q.method === 'GET' && route === '/api/engine') return json(r, 200, findEngine());
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
      if (accounts.some(u => u.email === email)) return json(r, 409, { error:'That email is already used by another account.' });
      if (accounts.some(u => u.username.toLowerCase() === username.toLowerCase())) return json(r, 409, { error:'That username is taken.' });
      const u = { username, email, password: makePass(pw), created: Date.now(), id: crypto.randomBytes(8).toString('hex') };
      accounts.push(u); saveAccounts();
      const t = crypto.randomBytes(32).toString('hex'); sessions[t] = u.id; saveSessions();
      return json(r, 200, { token:t, user:pubUser(u) });
    }
    if (route === '/api/login') {
      const id = str(b.id).toLowerCase(), pw = typeof b.password === 'string' ? b.password : '';
      const u = accounts.find(x => x.email === id || x.username.toLowerCase() === id);
      if (!u || !checkPass(pw, u.password)) return json(r, 401, { error:'Wrong email/username or password.' });
      const t = crypto.randomBytes(32).toString('hex'); sessions[t] = u.id; saveSessions();
      return json(r, 200, { token:t, user:pubUser(u) });
    }
    if (route === '/api/logout') { delete sessions[tokenOf(q)]; saveSessions(); return json(r, 200, { ok:true }); }
    if (route === '/api/save') {
      const u = userOf(q); if (!u) return json(r, 401, { error:'Not signed in' });
      if (JSON.stringify(b.data || {}).length > 30000) return json(r, 413, { error:'Too large' });
      userdata[u.id] = b.data || {}; saveUD(); return json(r, 200, { ok:true });
    }
    json(r, 404, { error:'Not found' });
  });
}

/* ---------- Static files (every page URL serves the app) ---------- */
const sendFile = (r, f, d) => { const ext = path.extname(f); r.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': ext === '.wasm' ? 'public, max-age=86400' : 'no-cache' }); r.end(d); };
const srv = http.createServer((q, r) => {
  const url = q.url.split('?')[0];
  if (url.startsWith('/api/')) return api(q, r);
  const rel = url === '/' ? '/index.html' : decodeURIComponent(url), f = path.join(PUB, rel);
  if (!f.startsWith(PUB)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (!e) return sendFile(r, f, d);
    if (path.extname(rel)) { r.writeHead(404); return r.end('Not found'); }
    fs.readFile(path.join(PUB, 'index.html'), (e2, d2) => e2 ? (r.writeHead(404), r.end('Not found')) : sendFile(r, 'index.html', d2));
  });
});

/* ---------- Live games ---------- */
const wss = new WebSocketServer({ server: srv });
const games = new Map();            // code -> {code, priv, tc, a, b, pid:{a,b}, q:{a,b}, dc:{a,b}, dead}
const RELAY = ['move', 'resign', 'timeout', 'draw', 'drawres', 'rematch', 'rematchres'];
const send = (w, o) => w && w.readyState === 1 && w.send(JSON.stringify(o));
const pub = () => [...games.values()].filter(g => !g.priv && !g.b).map(g => ({ code: g.code, tc: g.tc, name: g.a.name }));
const bcast = () => wss.clients.forEach(c => send(c, { t: 'list', games: pub() }));
const clampTc = t => ({ m: Math.min(60, Math.max(1, +(t && t.m) || 10)), i: Math.min(30, Math.max(0, +(t && t.i) || 0)) });
const opp = s => s === 'a' ? 'b' : 'a';
const rid = () => crypto.randomBytes(8).toString('hex');
function newCode() { let c; do c = String(Math.floor(100000 + Math.random() * 900000)); while (games.has(c)); return c; }
// deliver now, or hold until a disconnected player returns
function toSeat(g, seat, m) { const w = g[seat]; if (w && w.readyState === 1) send(w, m); else g.q[seat].push(m); }
function destroy(g) { clearTimeout(g.dc.a); clearTimeout(g.dc.b); games.delete(g.code); }
function leave(ws) {
  const g = ws.game; if (!g) return;
  const seat = g.a === ws ? 'a' : 'b'; ws.game = null;
  destroy(g);
  const o = g[opp(seat)]; if (o) { o.game = null; send(o, { t:'end', reason:'Opponent left the game' }); }
  bcast();
}
function createGame(ws, priv, tc) {
  leave(ws);
  const g = { code: newCode(), priv, tc: clampTc(tc), a: ws, b: null, pid: { a: rid(), b: rid() }, q: { a: [], b: [] }, dc: {}, dead: false };
  games.set(g.code, g); ws.game = g;
  send(ws, { t: 'created', code: g.code, priv: g.priv, tc: g.tc }); bcast();
}
function joinGame(ws, g) {
  leave(ws);
  g.b = ws; ws.game = g;
  const aWhite = Math.random() < 0.5;
  send(g.a, { t:'start', color: aWhite ? 'w' : 'b', tc: g.tc, you: g.a.name, opp: g.b.name, code: g.code, pid: g.pid.a });
  send(g.b, { t:'start', color: aWhite ? 'b' : 'w', tc: g.tc, you: g.b.name, opp: g.a.name, code: g.code, pid: g.pid.b });
  bcast();
}
// a player's connection dropped mid-game: give them 30 seconds to return, then the opponent wins
function dropSeat(ws) {
  const g = ws.game; if (!g) return;
  if (!g.b) { destroy(g); ws.game = null; bcast(); return; }           // still waiting for an opponent
  const seat = g.a === ws ? 'a' : 'b', o = opp(seat);
  g[seat] = null; ws.game = null;
  toSeat(g, o, { t:'oppdc', secs:30 });
  clearTimeout(g.dc[seat]);
  g.dc[seat] = setTimeout(() => {
    if (g[seat]) return;
    g.dead = true; toSeat(g, o, { t:'abandon' });
    if (!g[o]) destroy(g);
    bcast();
  }, 30000);
}

wss.on('connection', ws => {
  ws.guest = 'Guest' + (1000 + Math.floor(Math.random() * 9000)); ws.name = ws.guest; ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { t: 'list', games: pub() });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'ping') return send(ws, { t:'pong' });
    if (m.t === 'auth') {
      const id = sessions[m.token], u = id && accounts.find(x => x.id === id);
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
    } else if (m.t === 'rejoin') {
      const g = games.get(String(m.code)), seat = g && (m.pid === g.pid.a ? 'a' : m.pid === g.pid.b ? 'b' : null);
      if (!g || g.dead || !seat || g[seat]) return send(ws, { t:'rejoinfail' });
      clearTimeout(g.dc[seat]); g[seat] = ws; ws.game = g;
      send(ws, { t:'rejoined' });
      g.q[seat].forEach(x => send(ws, x)); g.q[seat] = [];
      toSeat(g, opp(seat), { t:'oppback' });
    } else if (RELAY.includes(m.t)) {
      const g = ws.game; if (!g || !g.b) return;
      toSeat(g, opp(g.a === ws ? 'a' : 'b'), m);
    } else if (m.t === 'chat') {
      const g = ws.game; if (!g || !g.b) return;
      toSeat(g, opp(g.a === ws ? 'a' : 'b'), { t:'chat', text: String(m.text || '').slice(0, 200) });
    } else if (m.t === 'leave') leave(ws);
  });
  ws.on('close', () => dropSeat(ws));
});
// keep connections alive through hosting proxies that close idle sockets
setInterval(() => wss.clients.forEach(c => { if (c.isAlive === false) return c.terminate(); c.isAlive = false; c.ping(); }), 30000);

srv.listen(process.env.PORT || 3000, () => console.log('HayChess running'));
