const CLS = [['brilliant','Brilliant'],['excellent','Excellent'],['great','Great'],['good','Good'],['book','Opening'],['slip','Slip'],['error','Error'],['blunder','Blunder']];
const BADGE = {
  crown: '<svg viewBox="0 0 24 24"><path d="M3 18h18l1-11-5 4-5-7-5 7-5-4z" fill="#fff"/></svg>',
  mate: '<b>#</b>', draw: '<b>&frac12;</b>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 3v18M6 4h12l-3 4 3 4H6" stroke="#fff" fill="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" preserveAspectRatio="xMidYMid meet"><circle cx="12" cy="12" r="9"/><path d="M12 6.500V12l3.500 2"/></svg>',
  brilliant: '<b>!!</b>', excellent: '<b>!</b>', slip: '<b>!?</b>', error: '<b>?</b>', blunder: '<b>??</b>',
  great: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4 6.1 20.7l1.3-6.6L2.5 9.5l6.6-.8z" fill="#fff"/></svg>',
  good: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M3 5.5c3-1 6-1 9 1v13c-3-2-6-2-9-1zM21 5.5c-3-1-6-1-9 1v13c3-2 6-2 9-1z"/></svg>'
};

class Board {
  // mode: 'both' (moves alternate) | 'online' (you control `color`)
  constructor(el, { mode, color='w', onMove }) {
    Object.assign(this, { el, mode, color, onMove, flip: color==='b', s: Chess.start(), sel: null, hi: new Set(),
      arrows: [], pre: [], last: null, active: true, rs: null, rsCur: null, drag: null, promo: null, skipAnim: false,
      badges: {}, fall: {}, stars: new Set(), hints: new Set(), marks: new Set(), locked: false, hintArrow: null, engArrows: [] });
    el.innerHTML = '<div class="grid"></div><svg class="ov" viewBox="0 0 800 800"></svg>';
    this.grid = el.firstChild; this.svg = el.lastChild;
    for (let i=0;i<64;i++) this.grid.append(document.createElement('div'));
    el.oncontextmenu = e => e.preventDefault();

    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.promo') || this.locked) return;
      if (e.button===2) { this.rs = this.rsCur = this.at(e); el.setPointerCapture(e.pointerId); this.drawArrows(); return; }
      if (e.button!==0) return;
      if (this.promo) { this.closePromo(); return this.render(); }
      const q = this.at(e); if (q==null) return;
      this.hi.clear(); this.arrows = []; this.hintArrow = null;
      const p = this.view().b[q];
      if (this.active && p && p[0]===this.mine) {                 // pick up own piece (click or drag)
        el.setPointerCapture(e.pointerId);
        const was = this.sel===q; this.sel = q; this.render(); this.startDrag(e, q, was);
      } else if (!(this.active && this.sel!=null && this.attempt(this.sel, q))) {
        this.sel = null; this.pre = []; this.render();            // any other click cancels premoves
      }
    });

    el.addEventListener('pointermove', e => {
      if (this.rs!=null) {                                         // live arrow preview while right-dragging
        const q = this.at(e);
        if (q!==this.rsCur) { this.rsCur = q; this.drawArrows(); }
      }
      const d = this.drag; if (!d) return;
      d.ghost.style.left = (e.clientX - d.w/2) + 'px'; d.ghost.style.top = (e.clientY - d.w/2) + 'px';
      if (Math.hypot(e.clientX-d.x, e.clientY-d.y) > 5) d.moved = true;
    });

    el.addEventListener('pointerup', e => {
      if (e.button===2) {                                          // right click: highlight / arrow
        const q = this.at(e);
        if (q!=null && this.rs!=null) {
          if (q===this.rs) this.hi.has(q) ? this.hi.delete(q) : this.hi.add(q);
          else { const k=this.rs+'-'+q, i=this.arrows.indexOf(k); i<0 ? this.arrows.push(k) : this.arrows.splice(i,1); }
        }
        this.rs = this.rsCur = null; return this.render();
      }
      const d = this.drag; if (!d) return;
      this.drag = null; d.ghost.remove();
      const to = this.at(e);
      if (d.moved && to!=null && to!==d.from) {
        this.skipAnim = true;
        if (!this.attempt(d.from, to)) { this.skipAnim = false; this.render(); }
      } else { if (!d.moved && d.was) this.sel = null; this.render(); }
    });
    el.addEventListener('pointercancel', () => { this.rs = this.rsCur = null; if (this.drag) { this.drag.ghost.remove(); this.drag = null; } this.render(); });
    this.render();
  }

  get mine() { return this.mode==='both' ? this.s.turn : this.color; }
  get myTurn() { return this.mode==='both' || this.s.turn===this.color; }

  // position as displayed: real position plus any queued premoves
  view() {
    let s = this.s;
    for (const m of this.pre) {
      const p = s.b[m.from];
      if (!p || p[0]!==this.mine || !Chess.pseudo(s, this.mine).some(x => x.from===m.from && x.to===m.to)) break;
      s = { ...Chess.apply(s, { from:m.from, to:m.to, promo: p[1]==='P' && (m.to>>3===0 || m.to>>3===7) ? 'Q' : undefined }), ep:null };
    }
    return s;
  }

  targets(from) {
    const ms = this.myTurn ? Chess.legal(this.s, this.s.turn, true) : Chess.pseudo(this.view(), this.mine);
    return ms.filter(m => m.from===from);
  }

  attempt(from, to) {
    const ms = this.targets(from).filter(m => m.to===to);
    if (!ms.length) return false;
    if (this.myTurn && ms.length>1) { this.sel = null; this.promo = { ms, to }; this.render(); return true; }
    this.commit(ms[0]); return true;
  }
  commit(m) {
    this.sel = null; this.hi.clear(); this.arrows = []; this.hintArrow = null;
    if (this.myTurn) this.onMove(m);
    else { this.pre.push({ from:m.from, to:m.to }); Sound.play('premove'); this.render(); }
  }
  closePromo() { this.promo = null; this.skipAnim = false; }

  play(m) {
    const prev = this.s;
    this.s = Chess.apply(prev, m); this.last = m; this.sel = null; this.hi.clear(); this.arrows = []; this.hintArrow = null;
    // if the piece you are holding was just captured, drop it
    if (this.drag) {
      const p = this.view().b[this.drag.from];
      if (!p || p[0]!==this.mine) { this.drag.ghost.remove(); this.drag = null; }
    }
    this.render();
    if (!this.skipAnim) {
      this.animate(m.from, m.to);
      if (m.castle) { const row = prev.b[m.from][0]==='w' ? 56 : 0; m.castle==='K' ? this.animate(row+7, row+5) : this.animate(row, row+3); }
    }
    this.skipAnim = false;
    if (this.active) Sound.move(prev, m, this.s);
  }

  // next queued premove that is legal now (clears the queue if it isn't)
  tryPre() {
    if (!this.pre.length) return null;
    const p = this.pre.shift();
    const m = Chess.legal(this.s).find(x => x.from===p.from && x.to===p.to);
    if (m) return m;
    this.pre = []; return null;
  }

  animate(from, to) {
    const w = this.grid.getBoundingClientRect().width / 8;
    const fj = this.flip ? 63-from : from, tj = this.flip ? 63-to : to;
    const img = this.grid.children[tj].querySelector('.pc'); if (!img || !w) return;
    img.style.transition = 'none'; img.style.zIndex = 4;
    img.style.transform = `translate(${((fj&7)-(tj&7))*w}px,${((fj>>3)-(tj>>3))*w}px)`;
    void img.offsetWidth;
    const ms = Board.animMs; img.style.transition = `transform ${ms}ms cubic-bezier(.25,.8,.35,1)`; img.style.transform = 'translate(0,0)';
    setTimeout(() => { img.style.zIndex = ''; }, ms + 50);
  }

  startDrag(e, q, was) {
    const pc = this.grid.children[this.flip ? 63-q : q].querySelector('.pc'); if (!pc) return;
    const w = this.grid.getBoundingClientRect().width / 8;
    const g = pc.cloneNode(true);
    g.style.cssText = `position:fixed;left:${e.clientX-w/2}px;top:${e.clientY-w/2}px;width:${w*.97}px;height:${w*.97}px;pointer-events:none;z-index:1000;transition:none;transform:none`;
    this.el.append(g); pc.style.opacity = .3;
    this.drag = { from:q, ghost:g, w, x:e.clientX, y:e.clientY, moved:false, was };
  }

  at(e) {
    const r = this.grid.getBoundingClientRect();
    const c = Math.floor((e.clientX-r.left)/r.width*8), rw = Math.floor((e.clientY-r.top)/r.height*8);
    if (c<0||c>7||rw<0||rw>7) return null;
    const j = rw*8+c; return this.flip ? 63-j : j;
  }

  render() {
    const s = this.view(), real = this.s, chk = Chess.inCheck(real);
    const tg = this.sel!=null && this.active ? this.targets(this.sel) : [];
    const preSq = new Set(this.pre.flatMap(m => [m.from, m.to]));
    [...this.grid.children].forEach((d,j) => {
      const i = this.flip ? 63-j : j, r=i>>3, c=i&7, p=s.b[i];
      let cl = 'sq ' + ((r+c)%2 ? 'dk' : 'lt');
      if (this.last && (this.last.from===i || this.last.to===i)) cl += ' last';
      if (this.sel===i) cl += ' sel';
      if (preSq.has(i)) cl += ' pre';
      if (this.hi.has(i)) cl += ' hi';
      if (this.hints.has(i)) cl += ' hintsq';
      if (this.marks.has(i)) cl += ' mark';
      if (this.fall[i]) cl += ' fallsq';
      if (chk && real.b[i]===real.turn+'K') cl += ' chk';
      if (tg.some(m => m.to===i)) cl += p ? ' cap' : ' mv';
      d.className = cl;
      d.dataset.rk = j%8===0 ? 8-(i>>3) : '';
      d.dataset.fl = (j>>3)===7 ? 'abcdefgh'[i&7] : '';
      d.innerHTML = (p ? `<img class="pc${this.fall[i]?' fall':''}" draggable="false" alt="" src="${PIECE_IMG[p]}">` : '') +
        (this.stars.has(i) ? '<span class="lstar">&#9733;</span>' : '') +
        (this.badges[i] ? `<span class="bdg ${this.badges[i]}">${BADGE[this.badges[i]]}</span>` : '');
    });
    if (this.drag) { const im = this.grid.children[this.flip ? 63-this.drag.from : this.drag.from].querySelector('.pc'); if (im) im.style.opacity = .3; }
    this.drawArrows(); this.drawPromo();
  }

  // chess.com-style arrows: thick shaft, triangular head, L-shaped for knight moves
  arrowMarkup(a, b, color, op) {
    const ctr = i => { const j = this.flip ? 63-i : i; return [(j&7)*100+50, (j>>3)*100+50]; };
    const [x1,y1] = ctr(a), [x2,y2] = ctr(b), dx = x2-x1, dy = y2-y1, pts = [[x1,y1]];
    if ((Math.abs(dx)===100 && Math.abs(dy)===200) || (Math.abs(dx)===200 && Math.abs(dy)===100))
      pts.push(Math.abs(dy)>Math.abs(dx) ? [x1,y2] : [x2,y1]);
    pts.push([x2,y2]);
    const [px,py] = pts[pts.length-2], L = Math.hypot(x2-px,y2-py), ux=(x2-px)/L, uy=(y2-py)/L, HL=42, HW=30;
    const bx = x2-ux*HL, by = y2-uy*HL; pts[pts.length-1] = [bx,by];
    const tip = [x2-ux*6, y2-uy*6], c1 = [bx-uy*HW, by+ux*HW], c2 = [bx+uy*HW, by-ux*HW];
    return `<g style="fill:${color};stroke:${color}" opacity="${op}"><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/><polygon points="${tip} ${c1} ${c2}" stroke="none"/></g>`;
  }
  drawArrows() {
    const A = 'var(--c-arrow)', k = k => k.split('-').map(Number);
    let h = this.engArrows.map((a,i) => this.arrowMarkup(a[0], a[1], 'var(--c-eng)', [.85,.55,.4][i] || .35)).join('');
    h += this.arrows.map(x => { const [a,b] = k(x); return this.arrowMarkup(a, b, A, .85); }).join('');
    if (this.hintArrow) h += this.arrowMarkup(this.hintArrow[0], this.hintArrow[1], A, .85);
    if (this.rs!=null && this.rsCur!=null) {                       // shows immediately on right-press, grows while dragging
      if (this.rsCur===this.rs) {
        const j = this.flip ? 63-this.rs : this.rs;
        h += `<circle cx="${(j&7)*100+50}" cy="${(j>>3)*100+50}" r="44" fill="none" stroke-width="8" style="stroke:${A}" opacity=".85"/>`;
      } else h += this.arrowMarkup(this.rs, this.rsCur, A, .6);
    }
    this.svg.innerHTML = h;
  }

  // chess.com-style promotion picker: a column of pieces over the promotion file, with a cancel button
  drawPromo() {
    const old = this.el.querySelector('.promo'); if (old) old.remove();
    this.el.classList.toggle('dim', !!this.promo);
    if (!this.promo) return;
    const { ms, to } = this.promo, j = this.flip ? 63-to : to, top = (j>>3)===0;
    const d = document.createElement('div');
    d.className = 'promo' + (top ? '' : ' up');
    d.style.left = ((j&7)*12.5) + '%';
    d.innerHTML = ['Q','N','R','B'].map(q => `<button data-p="${q}"><img alt="" src="${PIECE_IMG[this.mine+q]}"></button>`).join('') + '<button class="x" data-p="x">&times;</button>';
    d.onpointerdown = e => e.stopPropagation();
    d.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.p==='x') { this.closePromo(); return this.render(); }
      const m = ms.find(x => x.promo===b.dataset.p); this.promo = null; this.commit(m);
    };
    this.el.append(d);
  }

  flipBoard() { this.flip = !this.flip; this.render(); }
}

Board.animMs = 170;

// replace a board element with a fresh copy (drops old listeners) and return it
function freshBoard(id) {
  const old = document.getElementById(id), n = old.cloneNode(false);
  old.replaceWith(n); return n;
}
