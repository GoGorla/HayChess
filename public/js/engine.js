// Simple chess engine (alpha-beta + quiescence). Strength is set per bot level.
const Engine = (() => {
  const V = { P:100, N:320, B:330, R:500, Q:900, K:0 }, MATE = 100000;
  // depth, chance of a random move, score noise (cp), time limit (ms)
  const L = {
    200:{d:1,r:.60,n:200,t:200}, 400:{d:1,r:.40,n:150,t:200}, 600:{d:1,r:.22,n:120,t:200}, 800:{d:1,r:.10,n:80,t:200},
    1000:{d:2,r:.12,n:70,t:300}, 1200:{d:2,r:.05,n:45,t:300}, 1500:{d:2,r:0,n:25,t:400}, 1800:{d:3,r:0,n:15,t:600},
    2000:{d:3,r:0,n:6,t:900}, 2300:{d:4,r:0,n:3,t:1200}, 2500:{d:5,r:0,n:0,t:1800}, 2700:{d:6,r:0,n:0,t:2500},
    3000:{d:7,r:0,n:0,t:3500}, 3200:{d:9,r:0,n:0,t:5000}
  };
  let nodes, deadline, stop;

  function evalS(s) {
    let sc = 0; const b = s.b;
    for (let i=0;i<64;i++) {
      const p = b[i]; if (!p) continue;
      const t = p[1], r = i>>3, c = i&7, w = p[0]==='w', cd = Math.abs(c-3.5)+Math.abs(r-3.5);
      let v = V[t];
      if (t==='N' || t==='B') v += (7-cd)*5;
      else if (t==='P') v += (w ? 6-r : r-1)*7 + (7-cd)*2;
      else if (t==='Q') v += (7-cd);
      sc += w ? v : -v;
    }
    return s.turn==='w' ? sc : -sc;
  }

  function order(s, ms) {
    for (const m of ms) { const t = s.b[m.to]; m.o = (t ? 1000 + 10*V[t[1]] - V[s.b[m.from][1]]/10 : 0) + (m.promo ? 800 : 0); }
    ms.sort((a,b) => b.o - a.o);
  }

  function qs(s, a, b) {
    if ((++nodes & 1023)===0 && Date.now()>deadline) stop = true;
    if (stop) return 0;
    const st = evalS(s);
    if (st >= b) return st;
    if (st > a) a = st;
    const ms = Chess.legal(s).filter(m => s.b[m.to] || m.ep || m.promo);
    order(s, ms);
    for (const m of ms) {
      const sc = -qs(Chess.apply(s,m), -b, -a);
      if (stop) return 0;
      if (sc >= b) return sc;
      if (sc > a) a = sc;
    }
    return a;
  }

  function nm(s, d, a, b, ply) {
    if ((++nodes & 1023)===0 && Date.now()>deadline) stop = true;
    if (stop) return 0;
    const ms = Chess.legal(s);
    if (!ms.length) return Chess.inCheck(s) ? -MATE+ply : 0;
    if (d<=0) return qs(s, a, b);
    order(s, ms);
    for (const m of ms) {
      const sc = -nm(Chess.apply(s,m), d-1, -b, -a, ply+1);
      if (stop) return 0;
      if (sc >= b) return sc;
      if (sc > a) a = sc;
    }
    return a;
  }

  function pick(s, level) {
    const cf = L[level] || L[1000], ms = Chess.legal(s);
    if (!ms.length) return null;
    if (Math.random() < cf.r) return ms[(Math.random()*ms.length)|0];
    deadline = Date.now() + cf.t; let best = ms[0];
    for (let d=1; d<=cf.d; d++) {
      nodes = 0; stop = false;
      let a = -1e9, bm = null, bs = -1e9;
      for (const m of ms) {
        const sc = -nm(Chess.apply(s,m), d-1, -1e9, -a, 1) + (Math.random()-.5)*cf.n;
        if (stop) break;
        if (sc > bs) { bs = sc; bm = m; }
        if (sc > a) a = sc;
      }
      if (stop || !bm) break;
      best = bm;
      ms.splice(ms.indexOf(bm),1); ms.unshift(bm);
      if (bs > MATE-100) break;
    }
    return { from:best.from, to:best.to, promo:best.promo, dbl:best.dbl, ep:best.ep, castle:best.castle };
  }
  return { pick, levels: Object.keys(L).map(Number) };
})();
