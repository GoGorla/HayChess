// Engine access for bots, the analysis bar/arrows and game review.
// Uses Stockfish (stockfish.js) when its files are in public/js/stockfish/, otherwise the built-in engine.
const Eng = (() => {
  const MATE = 100000, SF_NAMES = ['stockfish-19-lite-single.js', 'stockfish-18-lite-single.js', 'stockfish.js'];
  let sf = null, initP = null, job = null, chain = Promise.resolve(), own = null, seq = 0, label = 'Checking engine…';
  const pend = new Map(), listeners = [];
  const setLabel = t => { label = t; listeners.forEach(f => f(t)); };

  /* ----- built-in engine (Web Worker) ----- */
  const ownW = () => {
    if (!own) { own = new Worker('js/engine-worker.js?v=7'); own.onmessage = e => { const p = pend.get(e.data.id); if (p) { pend.delete(e.data.id); p(e.data); } }; }
    return own;
  };
  const ownCall = msg => new Promise(res => { const id = ++seq; pend.set(id, res); ownW().postMessage({ ...msg, id }); });

  /* ----- Stockfish (UCI over a Web Worker) ----- */
  async function findSF() {
    for (const n of SF_NAMES) {
      try { const r = await fetch('js/stockfish/' + n, { method:'HEAD' }); if (r.ok) return n; } catch (e) {}
    }
    return null;
  }
  function init() {
    if (initP) return initP;
    initP = (async () => {
      const n = await findSF();
      if (!n) { setLabel('Built-in engine'); return false; }
      setLabel('Loading Stockfish…');
      return new Promise(res => {
        let done = false; const fin = v => { if (!done) { done = true; setLabel(v ? 'Stockfish' : 'Built-in engine'); res(v); } };
        try {
          const base = new URL('js/stockfish/', location.href).pathname;
          const w = new Worker(base + n + '#' + base + n.replace(/\.js$/, '.wasm'));
          w.onerror = () => fin(false);
          w.onmessage = e => {
            const l = String(e.data);
            if (l === 'uciok') w.postMessage('isready');
            else if (l === 'readyok') { sf = w; w.onmessage = ev => job && job(String(ev.data)); fin(true); }
          };
          w.postMessage('uci');
          setTimeout(() => fin(false), 25000);
        } catch (e) { fin(false); }
      });
    })();
    return initP;
  }

  // run one UCI search; resolves with {best, lines:{multipv:{cp,mv}}}
  function sfRun(cmds, stale) {
    const run = () => new Promise(res => {
      if (stale && stale()) return res(null);
      const lines = {};
      job = l => {
        if (l.startsWith('info') && l.includes(' score ') && l.includes(' pv ')) {
          const mp = +((l.match(/ multipv (\d+)/) || [])[1] || 1), sc = l.match(/ score (cp|mate) (-?\d+)/), pv = (l.match(/ pv (\S+)/) || [])[1];
          if (sc && pv) { const v = +sc[2]; lines[mp] = { cp: sc[1]==='cp' ? v : (v>0 ? 1 : -1) * (MATE - Math.abs(v)*2), mv: pv }; }
        } else if (l.startsWith('bestmove')) { job = null; res({ best: l.split(' ')[1], lines }); }
      };
      cmds.forEach(c => sf.postMessage(c));
    });
    const p = chain.then(run); chain = p.catch(() => {}); return p;
  }
  const idx = sq => 'abcdefgh'.indexOf(sq[0]) + (8 - +sq[1]) * 8;
  const parseMv = (s, str) => {
    if (!str || str.length < 4) return null;
    const f = idx(str.slice(0,2)), t = idx(str.slice(2,4)), pr = (str[4] || 'q').toUpperCase();
    return Chess.legal(s, s.turn, true).find(m => m.from===f && m.to===t && (!m.promo || m.promo===pr)) || null;
  };
  const plain = m => m && { from:m.from, to:m.to, promo:m.promo, dbl:m.dbl, ep:m.ep, castle:m.castle };

  return {
    init,
    get label() { return label; },
    onLabel(f) { listeners.push(f); f(label); },
    stop() { if (sf && job) sf.postMessage('stop'); },

    // bot move for a strength level
    async move(s, level) {
      if (level >= 1500 && await init() && sf) {
        const full = level >= 3200;
        const r = await sfRun([
          'setoption name MultiPV value 1',
          'setoption name UCI_LimitStrength value ' + (full ? 'false' : 'true'),
          'setoption name UCI_Elo value ' + Math.max(1320, Math.min(3190, level)),
          'position fen ' + Chess.fen(s), 'go movetime ' + (full ? 1800 : 900)
        ]);
        const m = r && parseMv(s, r.best); if (m) return plain(m);
      }
      return (await ownCall({ level, s })).move;
    },

    // best lines for the analysis board: {cp (side to move), top:[{from,to,promo,cp}]}
    async analyze(s, { n = 3, t = 700, stale } = {}) {
      if (!Chess.legal(s).length) return { cp: Chess.inCheck(s) ? -MATE : 0, top: [] };
      if (await init() && sf) {
        const r = await sfRun(['setoption name UCI_LimitStrength value false', 'setoption name MultiPV value ' + n, 'position fen ' + Chess.fen(s), 'go movetime ' + t], stale);
        if (!r) return null;
        const top = Object.keys(r.lines).map(Number).sort((a,b) => a-b).map(k => { const m = parseMv(s, r.lines[k].mv); return m && { ...plain(m), cp: r.lines[k].cp }; }).filter(Boolean);
        if (top.length) return { cp: top[0].cp, top };
      }
      if (stale && stale()) return null;
      const o = await ownCall({ type:'analyze', s, d:4, t:Math.min(t, 600) });
      return { cp: o.cp, top: o.top };
    },

    // quick evaluation for game review
    async eval(s) {
      if (!Chess.legal(s).length) return Chess.inCheck(s) ? -MATE : 0;
      if (await init() && sf) {
        const r = await sfRun(['setoption name UCI_LimitStrength value false', 'setoption name MultiPV value 1', 'position fen ' + Chess.fen(s), 'go movetime 110']);
        if (r && r.lines[1]) return r.lines[1].cp;
      }
      return (await ownCall({ type:'eval', s, d:3, t:110 })).cp;
    }
  };
})();
