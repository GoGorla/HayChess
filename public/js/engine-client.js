// Engine access for bots, the analysis arrows/bar/icons and the game review.
// Uses the official Stockfish running on the server; falls back to the small built-in engine if it is not installed.
const Eng = (() => {
  const MATE = 100000;
  let ready = null, okSF = false, label = 'Checking engine…', own = null, seq = 0, ctl = null;
  const pend = new Map(), listeners = [], sleep = ms => new Promise(r => setTimeout(r, ms));
  const setLabel = t => { label = t; listeners.forEach(f => f(t)); };

  /* ----- built-in engine (Web Worker): fallback only ----- */
  const ownW = () => {
    if (!own) { own = new Worker('/js/engine-worker.js?v=9'); own.onmessage = e => { const p = pend.get(e.data.id); if (p) { pend.delete(e.data.id); p(e.data); } }; }
    return own;
  };
  const ownCall = msg => new Promise(res => { const id = ++seq; pend.set(id, res); ownW().postMessage({ ...msg, id }); });

  /* ----- official Stockfish on the server ----- */
  async function api(path, body, signal) {
    const r = await fetch(path, { method:'POST', signal, headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + (Auth.token || '') }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('engine ' + r.status);
    return r.json();
  }
  function init() {
    if (ready) return ready;
    ready = (async () => {
      for (let i = 0; i < 60; i++) {                         // the server may still be downloading the engine
        try {
          const j = await fetch('/api/engine').then(r => r.json());
          if (j.state==='ready') { okSF = true; setLabel((j.name || 'Stockfish') + ' (official, running on the server)'); return true; }
          if (j.state!=='starting') break;
        } catch (e) {}
        await sleep(2000);
      }
      setLabel('Built-in engine (Stockfish is not installed on the server)'); return false;
    })();
    return ready;
  }
  const idx = sq => 'abcdefgh'.indexOf(sq[0]) + (8 - +sq[1]) * 8;
  const parseMv = (s, str) => {
    if (!str || str.length < 4) return null;
    const f = idx(str.slice(0,2)), t = idx(str.slice(2,4)), pr = (str[4] || 'q').toUpperCase();
    return Chess.legal(s, s.turn, true).find(m => m.from===f && m.to===t && (!m.promo || m.promo===pr)) || null;
  };
  const plain = m => m && { from:m.from, to:m.to, promo:m.promo, dbl:m.dbl, ep:m.ep, castle:m.castle };
  const lines = (s, top) => (top || []).map(x => { const m = parseMv(s, x.uci); return m && { ...plain(m), cp:x.cp }; }).filter(Boolean);
  const terminal = s => !Chess.legal(s).length ? (Chess.inCheck(s) ? -MATE : 0) : null;

  return {
    init, get ready() { return init(); }, mode() { return okSF ? 'sf' : 'own'; },
    get label() { return label; },
    onLabel(f) { listeners.push(f); f(label); },
    stop() { if (ctl) ctl.abort(); },

    // bot move for a strength level (200-3200)
    async move(s, level) {
      if (await init() && okSF) {
        try { const r = await api('/api/engine/move', { fen: Chess.fen(s), level }); const m = r && parseMv(s, r.best); if (m) return plain(m); } catch (e) {}
      }
      return (await ownCall({ level, s })).move;
    },

    // best lines at maximum strength: {cp (side to move), top:[{from,to,promo,cp}]}
    async analyze(s, { n = 3, t = 700, stale } = {}) {
      const tm = terminal(s); if (tm!==null) return { cp:tm, top:[] };
      if (await init() && okSF) {
        if (ctl) ctl.abort(); const my = ctl = new AbortController();
        try {
          const r = await api('/api/engine/analyze', { fen: Chess.fen(s), n, depth:20, movetime:3500 }, my.signal);
          if (stale && stale()) return null;
          const top = lines(s, r.top); if (top.length) return { cp: top[0].cp, top };
        } catch (e) { if (e.name==='AbortError') return null; }
      }
      if (stale && stale()) return null;
      const o = await ownCall({ type:'analyze', s, d:4, t:Math.min(t, 600) });
      return { cp: o.cp, top: o.top };
    },

    // for game review: best eval, the two best lines, and the worst move's eval (all side to move)
    async review(s) {
      const tm = terminal(s); if (tm!==null) return { cp:tm, top:[], worst:tm };
      if (await init() && okSF) {
        try { const r = await api('/api/engine/review', { fen: Chess.fen(s) }); const top = lines(s, r.top); if (top.length) return { cp: r.cp, top, worst: r.worst }; } catch (e) {}
      }
      const [a, w] = await Promise.all([ownCall({ type:'analyze', s, d:3, t:300 }), ownCall({ type:'worst', s })]);
      return { cp:a.cp, top:a.top, worst:w.cp };
    },
    async eval(s) { const r = await this.review(s); return r.cp; }
  };
})();
