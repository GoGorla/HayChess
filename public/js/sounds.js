// Original synthesized sound effects (Web Audio): modal wood-and-felt piece sounds, bells for alerts.
const Sound = (() => {
  let ctx = null, out = null;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); build();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function build() {
    const c = ctx, comp = c.createDynamicsCompressor();
    comp.connect(c.destination);
    out = c.createGain(); out.gain.value = .9; out.connect(comp);
    // short synthetic room reverb
    const cv = c.createConvolver(), len = Math.floor(c.sampleRate * .35), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 3); }
    cv.buffer = buf; const wet = c.createGain(); wet.gain.value = .14;
    out.connect(cv); cv.connect(wet); wet.connect(comp);
  }
  function noise(c, dur) {
    const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random()*2-1;
    return b;
  }
  // gain envelope: node -> exponential decay -> output
  function env(c, t, v, dur, node) {
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(v, .0002), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    node.connect(g); g.connect(out);
  }
  function osc(c, t, f, v, dur, type = 'sine', slideTo) {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * .5);
    env(c, t, v, dur, o); o.start(t); o.stop(t + dur + .05);
  }

  // A piece landing on a wooden board: inharmonic wood modes + stick click + felt thump
  function hit(c, t, { f = rnd(165, 205), v = .6, body = 1 } = {}) {
    for (const [r, a, d] of [[1,1,.11],[2.34,.5,.07],[3.9,.28,.045],[6.3,.14,.03]])
      osc(c, t, f*r, v*a*body, d, 'sine', f*r*.97);
    const s = c.createBufferSource(), fl = c.createBiquadFilter();
    s.buffer = noise(c, .03); fl.type = 'bandpass'; fl.frequency.value = rnd(2200, 3200); fl.Q.value = .8;
    s.connect(fl); env(c, t, v*.9, .03, fl); s.start(t);
    osc(c, t, 95, v*.7, .09, 'sine', 55);
  }
  function bell(c, t, f, v = .2, dur = .6) {
    osc(c, t, f, v, dur); osc(c, t, f*2.76, v*.25, dur*.5);
  }

  const S = {
    move:    (c,t) => hit(c, t, { v:.6 }),
    premove: (c,t) => hit(c, t, { f:rnd(240,280), v:.28, body:.6 }),
    capture: (c,t) => { hit(c, t, { f:rnd(130,150), v:.95 }); hit(c, t+.05, { f:rnd(200,230), v:.45 }); },
    castle:  (c,t) => { hit(c, t, { v:.55 }); hit(c, t+.12, { f:rnd(140,160), v:.5 }); },
    promote: (c,t) => { hit(c, t, { v:.55 }); bell(c, t+.1, 988, .16, .5); bell(c, t+.19, 1480, .12, .5); },
    check:   (c,t) => { hit(c, t, { v:.6 }); bell(c, t+.07, 740, .22, .55); },
    start:   (c,t) => { hit(c, t, { f:150, v:.4 }); hit(c, t+.16, { f:185, v:.45 }); },
    win:     (c,t) => [523,659,784,1047].forEach((f,i) => bell(c, t+i*.12, f, .2, .7)),
    loss:    (c,t) => [392,330,262].forEach((f,i) => bell(c, t+i*.2, f, .18, .8)),
    draw:    (c,t) => { bell(c, t, 440, .16, .6); bell(c, t+.25, 440, .16, .6); },
    tick:    (c,t) => bell(c, t, 1800, .09, .06)
  };

  function play(name) {
    if (!S[name]) return;
    const c = ac(); if (!c) return;
    S[name](c, c.currentTime + .005);
  }
  function move(prev, m, next) {
    const st = Chess.status(next);
    if (st && st.winner) return play('check');
    if (Chess.inCheck(next)) return play('check');
    if (m.castle) return play('castle');
    if (m.promo) return play('promote');
    if (prev.b[m.to] || m.ep) return play('capture');
    play('move');
  }
  return { play, move };
})();
