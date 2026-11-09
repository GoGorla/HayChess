const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const srv = http.createServer((q, r) => {
  const f = path.join(PUB, q.url === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(PUB)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end('Not found'); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
    r.end(d);
  });
});

const wss = new WebSocketServer({ server: srv });
const games = new Map(); // code -> {code, priv, a, b}
const send = (w, o) => w && w.readyState === 1 && w.send(JSON.stringify(o));
const pub = () => [...games.values()].filter(g => !g.priv && !g.b).map(g => ({ code: g.code }));
const bcast = () => wss.clients.forEach(c => send(c, { t: 'list', games: pub() }));
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

wss.on('connection', ws => {
  send(ws, { t: 'list', games: pub() });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'create') {
      leave(ws);
      const g = { code: newCode(), priv: !!m.priv, a: ws, b: null };
      games.set(g.code, g); ws.game = g;
      send(ws, { t: 'created', code: g.code, priv: g.priv }); bcast();
    } else if (m.t === 'join') {
      const g = games.get(String(m.code).trim());
      if (!g || g.b || g.a === ws) return send(ws, { t: 'err', msg: 'No open game with that code.' });
      leave(ws);
      g.b = ws; ws.game = g;
      const aWhite = Math.random() < 0.5;
      send(g.a, { t: 'start', color: aWhite ? 'w' : 'b' });
      send(g.b, { t: 'start', color: aWhite ? 'b' : 'w' });
      bcast();
    } else if (m.t === 'move' || m.t === 'resign') {
      const g = ws.game; if (!g) return;
      send(g.a === ws ? g.b : g.a, m);
    } else if (m.t === 'leave') leave(ws);
  });
  ws.on('close', () => leave(ws));
});

srv.listen(process.env.PORT || 3000, () => console.log('HayChess running'));
