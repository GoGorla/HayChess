const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const engine = require('./engine-server');
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

// engine calls need a logged-in user; closing the request cancels a search that is still running
function engineApi(q, r, route) {
  if (q.method !== 'POST') return json(r, 405, { error:'Method not allowed' });
  if (!userOf(q)) return json(r, 401, { error:'Sign in first' });
  if (engine.busy()) return json(r, 503, { error:'Engine busy' });
  readBody(q, async b => {
    if (!b) return json(r, 400, { error:'Bad request' });
    let abort = null; const hook = fn => { abort = fn; };
    r.on('close', () => { if (!r.writableEnded && abort) abort(); });
    try {
      const fn = { '/api/engine/move':engine.move, '/api/engine/analyze':engine.analyze, '/api/engine/review':engine.review }[route];
      if (!fn) return json(r, 404, { error:'Not found' });
      const out = await fn(b, hook);
      if (!r.writableEnded) json(r, out ? 200 : 503, out || { error:'No result' });
    } catch (e) { if (!r.writableEnded) json(r, 500, { error:'Engine error' }); }
  });
}

function api(q, r) {
  const route = q.url.split('?')[0];
  if (q.method === 'GET' && route === '/api/engine') return json(r, 200, engine.status());
  if (route.startsWith('/api/engine/')) return engineApi(q, r, route);
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
const games = new Map(), byGid = new Map();   // code -> game, gid -> game
const RELAY = ['resign', 'timeout', 'draw', 'drawres', 'rematch'];
const send = (w, o) => w && w.readyState === 1 && w.send(JSON.stringify(o));
const pub = () => [...games.values()].filter(g => !g.priv && !g.b).map(g => ({ code: g.code, tc: g.tc, name: g.a.name }));
const bcast = () => wss.clients.forEach(c => send(c, { t: 'list', games: pub() }));
const clampTc = t => ({ m: Math.min(60, Math.max(1, +(t && t.m) || 10)), i: Math.min(30, Math.max(0, +(t && t.i) || 0)) });
const opp = s => s === 'a' ? 'b' : 'a';
const rid = () => crypto.randomBytes(8).toString('hex');
const unique = (map, lo, span) => { let c; do c = String(Math.floor(lo + Math.random() * span)); while (map.has(c)); return c; };
// deliver now, or hold until a disconnected player returns
function toSeat(g, seat, m) { const w = g[seat]; if (w && w.readyState === 1) send(w, m); else g.q[seat].push(m); }
function destroy(g) { clearTimeout(g.dc.a); clearTimeout(g.dc.b); clearTimeout(g.exp); games.delete(g.code); byGid.delete(g.gid); }
const keepAlive = g => { clearTimeout(g.exp); g.exp = setTimeout(() => destroy(g), 30 * 60000); };   // a finished game stays reloadable for 30 minutes
// remaining time for both players, worked out from the moves the server has seen
function clockOf(g) {
  let w = g.tc.m * 60000, b = w, turn = 'w', last = g.startTs;
  for (const x of g.moves) { const el = x.ts - last; if (turn === 'w') w = w - el + g.tc.i * 1000; else b = b - el + g.tc.i * 1000; turn = turn === 'w' ? 'b' : 'w'; last = x.ts; }
  return { w, b, turn, since: Date.now() - last };
}
function leave(ws) {
  const g = ws.game; if (!g) return;
  const seat = g.a === ws ? 'a' : 'b'; ws.game = null;
  if (g.result) { g[seat] = null; if (!g.a && !g.b) destroy(g); return; }       // finished game: just step out of it
  destroy(g);
  const o = g[opp(seat)]; if (o) { o.game = null; send(o, { t:'end', reason:'Opponent left the game' }); }
  bcast();
}
function createGame(ws, priv, tc) {
  leave(ws);
  const g = { code: unique(games, 100000, 900000), gid: unique(byGid, 1e9, 9e9), priv, tc: clampTc(tc), a: ws, b: null, pid: { a: rid(), b: rid() }, q: { a: [], b: [] }, dc: {}, dead: false, moves: [], result: null, colors: {} };
  games.set(g.code, g); byGid.set(g.gid, g); ws.game = g;
  send(ws, { t: 'created', code: g.code, priv: g.priv, tc: g.tc }); bcast();
}
function begin(g, swap) {                      // (re)start a game: pick colours, clear moves, tell both players
  const aWhite = swap ? g.colors.a === 'b' : Math.random() < 0.5;
  g.colors = { a: aWhite ? 'w' : 'b', b: aWhite ? 'b' : 'w' };
  g.moves = []; g.result = null; g.startTs = Date.now(); g.q = { a: [], b: [] };
  if (swap) { byGid.delete(g.gid); g.gid = unique(byGid, 1e9, 9e9); byGid.set(g.gid, g); }
  clearTimeout(g.exp);
  for (const seat of ['a', 'b']) send(g[seat], { t:'start', color: g.colors[seat], tc: g.tc, you: g[seat].name, opp: g[opp(seat)].name, code: g.code, pid: g.pid[seat], gid: g.gid });
}
function joinGame(ws, g) { leave(ws); g.b = ws; ws.game = g; begin(g, false); bcast(); }
// a player's connection dropped mid-game: give them 30 seconds to return, then the opponent wins
function dropSeat(ws) {
  const g = ws.game; if (!g) return;
  if (!g.b) { destroy(g); ws.game = null; bcast(); return; }           // still waiting for an opponent
  const seat = g.a === ws ? 'a' : 'b', o = opp(seat);
  g[seat] = null; ws.game = null;
  if (g.result) { if (!g.a && !g.b) keepAlive(g); return; }
  toSeat(g, o, { t:'oppdc', secs:30 });
  clearTimeout(g.dc[seat]);
  g.dc[seat] = setTimeout(() => {
    if (g[seat] || g.result) return;
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
    } else if (m.t === 'rejoin') {                       // come back after a dropped connection or a page reload
      const g = games.get(String(m.code)) || byGid.get(String(m.gid)), seat = g && (m.pid === g.pid.a ? 'a' : m.pid === g.pid.b ? 'b' : null);
      if (!g || g.dead || !seat || (g[seat] && g[seat] !== ws && g[seat].readyState === 1)) return send(ws, { t:'rejoinfail' });
      clearTimeout(g.dc[seat]); g[seat] = ws; ws.game = g; g.q[seat] = [];
      send(ws, { t:'rejoined', gid:g.gid, code:g.code, color:g.colors[seat], tc:g.tc, opp:g[opp(seat)] ? g[opp(seat)].name : 'Opponent', moves:g.moves.map(x => x.m), clock:clockOf(g), result:g.result });
      if (!g.result) toSeat(g, opp(seat), { t:'oppback' });
    } else if (m.t === 'move') {
      const g = ws.game; if (!g || !g.b || g.result) return;
      g.moves.push({ m:m.m, ts:Date.now() }); toSeat(g, opp(g.a === ws ? 'a' : 'b'), m);
    } else if (m.t === 'gameover') {                       // both players report the result; the first one is kept
      const g = ws.game; if (!g || g.result) return;
      g.result = { winner: m.winner === 'w' || m.winner === 'b' ? m.winner : null, reason: String(m.reason || '').slice(0, 80), kind: String(m.kind || '').slice(0, 10) };
      clearTimeout(g.dc.a); clearTimeout(g.dc.b); keepAlive(g);
    } else if (m.t === 'rematch') {                        // only an offer; declined at once if the opponent is gone
      const g = ws.game, o = g && g[opp(g.a === ws ? 'a' : 'b')];
      if (!g || !g.b || !g.result || !o || o.readyState !== 1) return send(ws, { t:'rematchres', ok:false, reason:'gone' });
      send(o, m);
    } else if (m.t === 'rematchres') {
      const g = ws.game; if (!g || !g.b || !g.result) return;
      if (m.ok) { begin(g, true); } else toSeat(g, opp(g.a === ws ? 'a' : 'b'), { t:'rematchres', ok:false });
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

engine.init();
srv.listen(process.env.PORT || 3000, () => console.log('HayChess running'));
