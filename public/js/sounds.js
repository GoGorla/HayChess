// Original synthesized sound effects (Web Audio). No audio files needed.
const Sound = (() => {
  let ctx = null, on = true;
  try { on = localStorage.getItem('hc_sound') !== 'off'; } catch (e) {}

  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(c, dur) {
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random()*2-1) * (1 - i/n);
    return buf;
  }
  // wooden "tock": short pitched thump plus a bright noise click
  function tock(c, t, { f = 170, v = .5, dur = .09, br = 1800 } = {}) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f*1.8, t); o.frequency.exponentialRampToValueAtTime(f, t+.04);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.02);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g2 = c.createGain();
    s.buffer = noise(c, .04); fl.type = 'bandpass'; fl.frequency.value = br; g2.gain.value = v*.8;
    s.connect(fl).connect(g2).connect(c.destination); s.start(t);
  }
  function tone(c, t, f, dur, v = .2, type = 'triangle') {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(v, t+.01); g.gain.exponentialRampToValueAtTime(.001, t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.02);
  }

  const S = {
    move:    (c,t) => tock(c, t, { f:170, v:.5 }),
    premove: (c,t) => tock(c, t, { f:240, v:.25, dur:.06, br:2400 }),
    capture: (c,t) => { tock(c, t, { f:110, v:.85, dur:.15, br:1100 }); tock(c, t+.05, { f:150, v:.5, dur:.08 }); },
    castle:  (c,t) => { tock(c, t, { f:170, v:.5 }); tock(c, t+.13, { f:140, v:.5 }); },
    promote: (c,t) => { tock(c, t, { f:170, v:.5 }); [523,659,784].forEach((f,i) => tone(c, t+.08+i*.07, f, .18, .18)); },
    check:   (c,t) => { tock(c, t, { f:170, v:.5 }); tone(c, t+.05, 880, .14, .18, 'square'); tone(c, t+.16, 880, .14, .18, 'square'); },
    start:   (c,t) => { tone(c, t, 392, .16, .2); tone(c, t+.11, 523, .22, .2); },
    end:     (c,t) => { tone(c, t, 523, .2, .2); tone(c, t+.16, 392, .2, .2); tone(c, t+.32, 330, .35, .2); },
    tick:    (c,t) => tone(c, t, 1500, .04, .12, 'square')
  };

  function play(name) {
    if (!on || !S[name]) return;
    const c = ac(); if (!c) return;
    S[name](c, c.currentTime + .005);
  }
  // pick the right sound for a move (called with the position before and after)
  function move(prev, m, next) {
    const st = Chess.status(next);
    if (st && st.winner) return play('check');
    if (Chess.inCheck(next)) return play('check');
    if (m.castle) return play('castle');
    if (m.promo) return play('promote');
    if (prev.b[m.to] || m.ep) return play('capture');
    play('move');
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem('hc_sound', on ? 'on' : 'off'); } catch (e) {}
    if (on) play('move');
    return on;
  }
  return { play, move, toggle, get on() { return on; } };
})();
