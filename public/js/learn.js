// Learn path: staged lessons (piece movement, tactics, rules). Positions are written as tokens like "wKe1".
const Learn = (() => {
  const sq = n => 'abcdefgh'.indexOf(n[0]) + (8 - +n[1]) * 8;
  const nm = i => 'abcdefgh'[i&7] + (8 - (i>>3));
  const parse = str => { const b = Array(64).fill(null); (str || '').split(/\s+/).filter(Boolean).forEach(t => { b[sq(t.slice(2))] = t.slice(0,2); }); return b; };
  const C = (pos, st, tx) => ({ pos, st, tx });             // movement scenario: first piece is yours, collect stars / capture everything

  const S = [
    { id:'pawn', name:'Pawn', pc:'wP', hue:196, kind:'collect', desc:'Pawns march forward and capture diagonally.', sc:[
      C('wPe2','e4','A pawn can move two squares on its first move. Collect the star!'),
      C('wPe3','e4 e5 e6','After that, pawns move one square at a time. Collect all three stars.'),
      C('wPd4 bNe5 bNf6','','Pawns capture diagonally, never straight ahead. Capture both pieces.'),
      C('wPc2 wPc3 bNd3','d4','A blocked pawn can still capture. Take the piece, then reach the star.'),
      C('wPf2 bNg3 bNh5','g4','Combine pushes and captures to clear the board.') ] },
    { id:'rook', name:'Rook', pc:'wR', hue:172, kind:'collect', desc:'Rooks glide along ranks and files.', sc:[
      C('wRa1','a6 h6','Rooks move in straight lines, any distance. Collect both stars.'),
      C('wRd4','d1 h1','Plan your route to use as few moves as you can.'),
      C('wRe4 bNe8 bNa8','','Capture both knights.'),
      C('wRa1 wPa3','a5','Rooks cannot jump over pieces. Find a way around the pawn.'),
      C('wRc3','c7 g7 g2','Three stars, three moves. Can you do it?') ] },
    { id:'bishop', name:'Bishop', pc:'wB', hue:210, kind:'collect', desc:'Bishops slide diagonally and never change square colour.', sc:[
      C('wBc1','h6 f8','Bishops move diagonally. Collect both stars.'),
      C('wBc3','a1 h8','Use the long diagonal.'),
      C('wBd4 bNg7 bNb2','','Capture both knights.'),
      C('wBc1 wPd2','a3 e7','Your own pawn is in the way, so go the other direction first.'),
      C('wBd1','h5 e8','Chain diagonals together.') ] },
    { id:'knight', name:'Knight', pc:'wN', hue:232, kind:'collect', desc:'Knights jump in an L and leap over everything.', sc:[
      C('wNb1','c3 e4','Knights move in an L: two squares one way, one the other.'),
      C('wNg1','f3 h4','Hop from star to star.'),
      C('wNe4 bNc5 bNd7','','Capture both knights.'),
      C('wNa1','c2 e3 g4','Three stars in three jumps.'),
      C('wNb1 wPc3 wPd2','b5','Knights jump over pieces, but cannot land on their own.') ] },
    { id:'queen', name:'Queen', pc:'wQ', hue:268, kind:'collect', desc:'The queen combines rook and bishop.', sc:[
      C('wQd1','d8 a5','The queen moves like a rook and a bishop together.'),
      C('wQa1','a8 h8 h1','Sweep the edges of the board.'),
      C('wQd4 bNd8 bNh8 bNh4','','Capture all three knights.'),
      C('wQe1 wPd2 wPe2 wPf2','a1 a8','Your pawns box you in. Slide along the back rank.'),
      C('wQc3','a5 e5 e1','Find the shortest route through all three stars.') ] },
    { id:'king', name:'King', pc:'wK', hue:305, kind:'collect', desc:'The king steps one square in any direction.', sc:[
      C('wKe1','e3','The king moves one square at a time.'),
      C('wKa1','c3 c5','Walk the king to both stars.'),
      C('wKd4 bNe5 bNf6','','Kings can capture too. Take both knights.'),
      C('wKe4','e8','A long walk. Every step counts.'),
      C('wKe1 wPe2','e3','Your pawn blocks the way. Go around it.') ] },
    { id:'ep', name:'En passant', pc:'wP', hue:336, kind:'goal', goal:'ep', desc:'A special pawn capture, only available right away.', sc:[
      { pos:'wKe1 wPe5 bKe8 bPd5', ep:'d6', tx:'Black just moved a pawn two squares. Capture it en passant!' },
      { pos:'wKg1 wPe5 bKg8 bPf5', ep:'f6', tx:'Capture the pawn that just passed you, as if it had moved one square.' },
      { pos:'wKe1 wPb5 bKe8 bPa5', ep:'a6', tx:'It works on the edge of the board too.' },
      { pos:'wKg1 wPd5 wPg5 bKg8 bPe5', ep:'e6', tx:'Only one pawn can be captured en passant. Pick the right one.' },
      { pos:'wKe1 wPc5 wPe5 bKe8 bPb5 bPd5', ep:'b6', tx:'Black just played b7-b5. Capture it en passant.' } ] },
    { id:'castle', name:'Castling', pc:'wR', hue:14, kind:'goal', goal:'castle', desc:'Tuck your king away and bring a rook into play.', sc:[
      { pos:'wKe1 wRh1 bKe8', cr:'K', only:'K', tx:'Castle kingside: move your king two squares toward the rook.' },
      { pos:'wKe1 wRa1 bKe8', cr:'Q', only:'Q', tx:'Castle queenside: the king moves two squares toward the a-rook.' },
      { pos:'wKe1 wRa1 wRh1 wPa2 wPh2 bKe8', cr:'KQ', tx:'You can castle either way. Pick one.' },
      { pos:'wKe1 wRa1 bKe8 bRb8', cr:'Q', only:'Q', tx:'The rook attacks b1, but the king never crosses it. Castling is still legal.' },
      { pos:'wKe1 wRh1 wPf2 wPg2 bKe8 bRh8', cr:'K', only:'K', tx:'Your rook is attacked, but you may still castle kingside.' } ] },
    { id:'skewer', name:'Skewer', pc:'wB', hue:28, kind:'goal', goal:'skewer', desc:'Attack a valuable piece so it must move, exposing the one behind.', sc:[
      { pos:'wKh1 wRa1 bKe6 bQe8', tx:'Skewer: check the king so it has to move, then win the queen behind it.', steps:[{ ok:['a1e1'], reply:'e6d6' }, { ok:['e1e8'], msg:'The king moved. Capture the queen!' }] },
      { pos:'wKg1 wBd1 bKc6 bRe8', tx:'Use your bishop to skewer the king and rook.', steps:[{ ok:['d1a4'], reply:'c6c7' }, { ok:['a4e8'], msg:'Capture the rook behind the king!' }] },
      { pos:'wKg1 wRa1 bKd8 bRh8', tx:'Skewer along the back rank.', steps:[{ ok:['a1a8'], reply:'d8d7' }, { ok:['a8h8'], msg:'Take the rook!' }] },
      { pos:'wKh1 wQb1 bKe5 bRe8', tx:'Your queen can skewer too.', steps:[{ ok:['b1e1'], reply:'e5d5' }, { ok:['e1e8'], msg:'Win the rook!' }] },
      { pos:'wKg1 wBd2 bKe7 bRf8', tx:'Check the king along the diagonal so the rook falls.', steps:[{ ok:['d2b4'], reply:'e7d7' }, { ok:['b4f8'], msg:'The rook is unprotected. Take it!' }] } ] },
    { id:'pin', name:'Pin', pc:'wB', hue:48, kind:'goal', goal:'pin', desc:'Freeze a piece because moving it would expose something bigger.', sc:[
      { pos:'wKe1 wBc4 bKe8 bNc6', target:'c6', tx:'Pin the knight to the king. It cannot move without exposing the king.' },
      { pos:'wKg1 wRa1 bKe8 bNe5', target:'e5', tx:'Pin the knight on the e-file with your rook.' },
      { pos:'wKe1 wQd1 bKc8 bNe6', target:'e6', tx:'Your queen can pin along a diagonal.' },
      { pos:'wKg1 wBc1 bKf8 bNe7', target:'e7', tx:'Pin the knight to the king with your bishop.' },
      { pos:'wKh1 wRa2 bKh4 bBd4', target:'d4', tx:'Pin the bishop along the fourth rank.' } ] },
    { id:'check', name:'Check', pc:'wK', hue:96, kind:'goal', goal:'check', desc:'Attack the enemy king.', sc:[
      { pos:'wKe1 wQd1 bKe8', tx:'Give check: attack the black king.' },
      { pos:'wKg1 wRa1 bKe8', tx:'Give check with your rook.' },
      { pos:'wKg1 wNe4 bKe8', tx:'Knights give check from an L-shape away.' },
      { pos:'wKe1 wBc4 bKe8', tx:'Give check with the bishop.' },
      { pos:'wKg1 wPd3 bKe5', tx:'Even a pawn can give check. Push it!' },
      { pos:'wKg1 wRe1 wBe4 bKe8', tx:'Move the bishop to uncover a check from the rook.' },
      { pos:'wKg2 wQd1 bKg8 bPg7 bPh7', tx:'Find a check for your queen.' },
      { pos:'wKe1 wBc4 wQd1 bKe8', only:'B', tx:'Give check with the bishop, not the queen.' } ] },
    { id:'mate', name:'Checkmate', pc:'bK', hue:152, kind:'goal', goal:'mate', desc:'The king is attacked and has no escape.', sc:[
      { pos:'wKg1 wRa1 bKg8 bPf7 bPg7 bPh7', tx:'Mate in one: the black king is trapped by its own pawns.' },
      { pos:'wKf6 wQa7 bKh8', tx:'Mate in one: your king supports the queen.' },
      { pos:'wKe1 wRa7 wRb1 bKe8', tx:'Mate in one with two rooks.' },
      { pos:'wKg1 wNe5 bKh8 bRg8 bPg7 bPh7', tx:'Mate in one with the knight.' },
      { pos:'wKe1 wQh5 wBc4 bKe8 bQd8 bBf8 bNg8 bPf7 bPd7', tx:'Mate in one: attack the weak f7 square.' },
      { pos:'wKb6 wRh1 bKa8', tx:'Mate in one: the king and rook trap the king.' },
      { pos:'wKg1 wQh5 wBd3 bKg8 bRf8 bPh7', tx:'Mate in one: your bishop protects the queen.' },
      { pos:'wKe1 wRa7 wNf6 bKh8', tx:'Mate in one: knight and rook together.' } ] },
    { id:'stale', name:'Avoid stalemate', pc:'wQ', hue:182, kind:'goal', goal:'stale', desc:'A draw happens when the side to move has no legal move and is not in check.', sc:[
      { pos:'wKf6 wQe4 bKh8', tx:'You are winning, but be careful. Make a move that leaves Black a legal move.' },
      { pos:'wKc2 wQd5 bKa1', tx:'Do not trap the king without giving check.' },
      { pos:'wKf2 wQe3 bKh1', tx:'Leave the black king a legal move, or deliver mate.' },
      { pos:'wKg6 wQe2 bKh8', tx:'Some queen moves are a blunder here. Avoid stalemate!' },
      { pos:'wKb6 wQh3 bKa8', tx:'Find a move that does not stalemate Black.' } ] }
  ];
  S.forEach(s => { s.sc.forEach((c, i) => { c.id = s.id + '-' + i; }); });

  /* ----- solving helpers ----- */
  const pinned = (next, t) => {
    const f = sq(t), pm = Chess.pseudo(next, 'b').filter(x => x.from===f).length, lm = Chess.legal(next, 'b').filter(x => x.from===f).length;
    return pm > 0 && lm < pm;
  };
  function judge(g, sc, prev, m, next) {
    if (g==='ep') return !!m.ep;
    if (g==='castle') return !!m.castle && (!sc.only || m.castle===sc.only);
    if (g==='check') return Chess.inCheck(next, 'b') && (!sc.only || prev.b[m.from][1]===sc.only);
    if (g==='mate') { const st = Chess.status(next); return !!(st && st.winner==='w'); }
    if (g==='pin') return pinned(next, sc.target);
    if (g==='stale') { const st = Chess.status(next); return !st || !!st.winner; }
    return false;
  }
  function startState(sc) {
    const s = { b: parse(sc.pos), turn:'w', cr:{ wK:0, wQ:0, bK:0, bQ:0 }, ep:null };
    for (const c of (sc.cr || '')) s.cr['w' + c] = 1;
    if (sc.ep) s.ep = sq(sc.ep);
    return s;
  }
  // shortest route (list of moves) that visits every star and captures every black piece
  function bfs(b0, me, stars) {
    const req = [...new Set([...stars, ...b0.map((p,i) => p && p[0]==='b' ? i : -1).filter(i => i>=0)])], full = (1<<req.length) - 1;
    const piece = b0[me], q = [{ pos:me, mask:0, path:[] }], seen = new Set([me + ':0']);
    while (q.length) {
      const n = q.shift(); if (n.mask===full) return n.path;
      const b = b0.slice(); b[me] = null;
      req.forEach((r,k) => { if (n.mask>>k & 1) b[r] = null; });
      b[n.pos] = piece;
      const s = { b, turn:'w', cr:{ wK:0, wQ:0, bK:0, bQ:0 }, ep:null };
      for (const m of Chess.legal(s, 'w').filter(x => x.from===n.pos)) {
        let mask = n.mask; const k = req.indexOf(m.to); if (k>=0) mask |= 1<<k;
        const key = m.to + ':' + mask; if (seen.has(key)) continue; seen.add(key);
        q.push({ pos:m.to, mask, path:n.path.concat([m]) });
      }
    }
    return null;
  }

  /* ----- UI ----- */
  const OFF = [0, 46, 70, 46, 0, -46, -70, -46];
  let cur = null, lb = null;
  const prog = () => Store.get('learn', {});
  const flat = () => S.flatMap((s, si) => s.sc.map((c, i) => ({ si, i, key:c.id })));
  const starsStr = n => '&#9733;'.repeat(n) + '<i>' + '&#9733;'.repeat(3 - n) + '</i>';

  function render() {
    const p = prog(), f = flat(), curKey = (f.find(x => p[x.key]==null) || {}).key;
    let total = 0; Object.values(p).forEach(v => total += v);
    $('#learnstars').innerHTML = '&#9733; ' + total + ' / ' + f.length * 3;
    $('#path').innerHTML = S.map((s, si) => {
      const doneN = s.sc.filter(c => p[c.id]!=null).length;
      return `<section class="unit" style="--h:${s.hue}"><div class="ubanner"><div><small>SECTION ${si+1} &middot; ${doneN}/${s.sc.length}</small><h2>${s.name}</h2><p>${s.desc}</p></div><img alt="" src="${PIECE_IMG[s.pc]}"></div><div class="nodes">` +
        s.sc.map((c, i) => {
          const st = p[c.id], state = st!=null ? 'done' : c.id===curKey ? 'cur' : 'lock';
          return `<button class="node ${state}" style="--x:${OFF[i%8]}px" data-s="${si}" data-i="${i}">` +
            (state==='cur' ? '<span class="startb">START</span>' : '') +
            `<span class="nface">${state==='lock' ? '&#128274;' : state==='done' ? '&#10003;' : '&#9733;'}</span>` +
            (state==='done' ? `<span class="nstars">${starsStr(st)}</span>` : '') + '</button>';
        }).join('') + '</div></section>';
    }).join('');
    const c = $('#path .node.cur'); if (c && !render.once) { render.once = 1; }
  }

  function open(si, i) {
    const p = prog(), f = flat(), idx = f.findIndex(x => x.si===si && x.i===i);
    if (f.slice(0, idx).some(x => p[x.key]==null)) return toast('Finish the earlier lessons first.');
    cur = { si, i, st:S[si], sc:S[si].sc[i], mistakes:0, hinted:false, hint:0, moves:0, step:0, done:false, busy:false, me:-1, par:0 };
    openTab('lesson'); setup();
  }
  function setup() {
    const sc = cur.sc, st = cur.st;
    lb = new Board(freshBoard('lboard'), { mode:'online', color:'w', onMove });
    lb.s = startState(sc); lb.active = true;
    lb.stars = new Set((sc.st || '').split(' ').filter(Boolean).map(sq));
    if (st.kind==='collect') { cur.me = sq(sc.pos.split(' ')[0].slice(2)); cur.par = (bfs(lb.s.b, cur.me, lb.stars) || []).length; }
    cur.hint = 0; cur.step = 0; cur.busy = false; cur.done = false;
    lb.render(); paintInfo(); $('#lbar').hidden = true; $('#lbar').className = 'lbar';
  }
  function paintInfo() {
    const sc = cur.sc, st = cur.st, n = st.sc.length;
    $('#ltitle').textContent = st.name + ' · ' + (cur.i + 1) + ' of ' + n;
    $('#ltask').textContent = sc.steps ? (cur.step ? sc.steps[cur.step-1].msg || '' : sc.tx) : sc.tx;
    $('#ltext').textContent = st.kind==='collect' ? 'Par: ' + cur.par + ' move' + (cur.par===1 ? '' : 's') + ' for three stars.' : '';
    const p = prog();
    $('#lprog').innerHTML = st.sc.map((c, i) => `<i class="${p[c.id]!=null ? 'on' : i===cur.i ? 'now' : ''}"></i>`).join('');
    $('#lboard').parentElement.style.setProperty('--h', st.hue);
    document.getElementById('lesson').style.setProperty('--h', st.hue);
  }
  function bar(kind, msg, sub, showNext) {
    const b = $('#lbar'); b.hidden = false; b.className = 'lbar ' + kind;
    $('#lbmsg').textContent = msg; $('#lbsub').innerHTML = sub || ''; $('#lnext').hidden = !showNext;
  }
  function tip(t) { bar('bad', t, '', false); setTimeout(() => { if (!cur.done) $('#lbar').hidden = true; }, 1600); }

  function onMove(m) {
    if (!cur || cur.done || cur.busy) return;
    const sc = cur.sc, st = cur.st;
    if (st.kind==='collect') {
      if (m.from!==cur.me) return tip('Move the ' + st.name.toLowerCase() + ' for this lesson.');
      lb.play(m); lb.s = { ...lb.s, turn:'w', ep:null }; cur.me = m.to; cur.moves++;
      lb.stars.delete(m.to); lb.hints.clear(); lb.hintArrow = null; cur.hint = 0; lb.render();
      if (!lb.stars.size && !lb.s.b.some(p => p && p[0]==='b')) win();
      return;
    }
    const prev = lb.s, next = Chess.apply(prev, m);
    if (sc.steps) {
      const step = sc.steps[cur.step];
      if (!step.ok.includes(nm(m.from) + nm(m.to))) return wrong(m);
      lb.play(m); cur.step++; lb.hints.clear(); lb.hintArrow = null; cur.hint = 0;
      if (cur.step >= sc.steps.length) return win();
      cur.busy = true;
      setTimeout(() => {
        const r = step.reply, mv = Chess.legal(lb.s).find(x => x.from===sq(r.slice(0,2)) && x.to===sq(r.slice(2,4)));
        if (mv) lb.play(mv);
        cur.busy = false; paintInfo(); lb.render();
      }, 600);
      return;
    }
    if (judge(st.goal, sc, prev, m, next)) { lb.play(m); win(); } else wrong(m);
  }
  function wrong(m) {
    cur.mistakes++; cur.busy = true; Sound.play('bad');
    lb.play(m);
    const g = cur.st.goal, why = g==='stale' ? 'That is stalemate. It is a draw!' : g==='check' && cur.sc.only ? 'Use the bishop for this one.' : 'Not quite. Try again.';
    bar('bad', why, '', false);
    setTimeout(() => { if (cur.done) return; setup2(); }, 1300);
  }
  function setup2() { const mk = cur.mistakes, h = cur.hinted; setup(); cur.mistakes = mk; cur.hinted = h; }

  function win() {
    cur.done = true; Sound.play('good');
    let stars;
    if (cur.st.kind==='collect') stars = cur.moves <= cur.par ? 3 : cur.moves <= cur.par + 2 ? 2 : 1;
    else stars = Math.max(1, 3 - cur.mistakes);
    if (cur.hinted) stars = Math.min(stars, 2);
    const p = prog(); p[cur.sc.id] = Math.max(stars, p[cur.sc.id] || 0); Store.set('learn', p);
    const last = cur.i === cur.st.sc.length - 1;
    bar('good', ['Good job!', 'Nicely done!', 'Perfect!'][stars-1], `<span class="bigstars">${starsStr(stars)}</span>`, true);
    $('#lnext').textContent = last ? 'Finish stage' : 'Continue';
    paintInfo();
    if (last) confettiBurst();
  }
  function confettiBurst() {
    const keys = Object.keys(PIECE_IMG), box = $('#lconf');
    box.innerHTML = Array.from({ length:26 }, () => `<img alt="" src="${PIECE_IMG[keys[(Math.random()*keys.length)|0]]}" style="left:${Math.random()*95}%;animation-duration:${2+Math.random()*2}s;animation-delay:${Math.random()*.6}s;--rot:${(Math.random()*720-360)|0}deg">`).join('');
    setTimeout(() => { box.innerHTML = ''; }, 4800);
  }

  function bestMove() {
    const sc = cur.sc, st = cur.st;
    if (st.kind==='collect') { const p = bfs(lb.s.b, cur.me, lb.stars); return p && p[0]; }
    if (sc.steps) { const k = sc.steps[cur.step].ok[0]; return { from:sq(k.slice(0,2)), to:sq(k.slice(2,4)) }; }
    const ms = Chess.legal(lb.s, 'w', true).filter(m => judge(st.goal, sc, lb.s, m, Chess.apply(lb.s, m)));
    return ms.find(m => st.goal!=='mate' || true) || null;
  }
  function hint() {
    if (!cur || cur.done || cur.busy) return;
    const m = bestMove(); if (!m) return;
    cur.hinted = true;
    if (cur.hint===0) { lb.hints = new Set([m.from]); cur.hint = 1; }
    else { lb.hints = new Set([m.from, m.to]); lb.hintArrow = [m.from, m.to]; cur.hint = 2; }
    lb.render();
  }

  function next() {
    const st = cur.st;
    if (cur.i + 1 < st.sc.length) { cur.i++; cur.sc = st.sc[cur.i]; cur.mistakes = 0; cur.hinted = false; cur.moves = 0; setup(); }
    else { openTab('learn'); render(); const n = $('#path .node.cur'); if (n) n.scrollIntoView({ behavior:'smooth', block:'center' }); }
  }

  function init() {
    $('#path').onclick = e => { const b = e.target.closest('.node'); if (b) open(+b.dataset.s, +b.dataset.i); };
    $('#lhint').onclick = hint;
    $('#lreset').onclick = () => { if (cur && !cur.done) { cur.moves = 0; setup2(); } };
    $('#lnext').onclick = next;
    $('#lback').onclick = () => { cur = null; openTab('learn'); render(); };
    render();
  }
  return { init, render, S, _t: { parse, judge, startState, bfs, sq, nm, pinned } };
})();
