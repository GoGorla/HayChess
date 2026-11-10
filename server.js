const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const srv = http.createServer((q, r) => {
  const f = path.join(PUB, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(PUB)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end('Not found'); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
    r.end(d);
  });
});

const wss = new WebSocketServer({ server: srv });
const games = new Map(); // code -> {code, priv, tc, a, b}
const send = (w, o) => w && w.readyState === 1 && w.send(JSON.stringify(o));
const pub = () => [...games.values()].filter(g => !g.priv && !g.b).map(g => ({ code: g.code, tc: g.tc, name: g.a.name }));
const bcast = () => wss.clients.forEach(c => send(c, { t: 'list', games: pub() }));
const clampTc = t => ({ m: Math.min(60, Math.max(1, +(t && t.m) || 10)), i: Math.min(30, Math.max(0, +(t && t.i) || 0)) });
function newCode() {
  let c;
  do c = String(Math.floor(100000 + Math.random() * 900000)); while (games.has(c));
  return c;
}
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
  ws.name = 'Guest' + (1000 + Math.floor(Math.random() * 9000));
  send(ws, { t: 'list', games: pub() });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'create') createGame(ws, !!m.priv, m.tc);
    else if (m.t === 'quick') {
      const tc = clampTc(m.tc);
      const g = [...games.values()].find(x => !x.priv && !x.b && x.a !== ws && x.tc.m === tc.m && x.tc.i === tc.i);
      if (g) joinGame(ws, g); else createGame(ws, false, tc);
    } else if (m.t === 'join') {
      const g = games.get(String(m.code).trim());
      if (!g || g.b || g.a === ws) return send(ws, { t: 'err', msg: 'No open game with that code.' });
      joinGame(ws, g);
    } else if (m.t === 'move' || m.t === 'resign' || m.t === 'timeout') {
      const g = ws.game; if (!g) return;
      send(g.a === ws ? g.b : g.a, m);
    } else if (m.t === 'leave') leave(ws);
  });
  ws.on('close', () => leave(ws));
});

srv.listen(process.env.PORT || 3000, () => console.log('HayChess running'));
