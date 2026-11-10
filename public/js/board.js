class Board {
  // mode: 'both' (analysis, moves alternate) | 'online' (you control `color`)
  constructor(el, { mode, color='w', onMove }) {
    Object.assign(this, { el, mode, color, onMove, flip: color==='b', s: Chess.start(),
      sel: null, hi: new Set(), arrows: [], pre: null, last: null, active: true, rs: null, drag: null });
    el.innerHTML = '<div class="grid"></div><svg class="ov" viewBox="0 0 800 800"></svg>';
    this.grid = el.firstChild; this.svg = el.lastChild;
    for (let i=0;i<64;i++) this.grid.append(document.createElement('div'));
    el.oncontextmenu = e => e.preventDefault();

    el.addEventListener('pointerdown', e => {
      if (e.button===2) { this.rs = this.at(e); el.setPointerCapture(e.pointerId); return; }
      if (e.button!==0) return;
      const q = this.at(e); if (q==null) return;
      const p = this.s.b[q];
      if (this.active && p && p[0]===this.mine) {          // pick up own piece (click or drag)
        el.setPointerCapture(e.pointerId);
        const was = this.sel===q;
        this.hi.clear(); this.arrows = []; this.sel = q; this.render();
        this.startDrag(e, q, was);
      } else this.click(q);                                // move/capture target or empty square
    });

    el.addEventListener('pointermove', e => {
      const d = this.drag; if (!d) return;
      d.ghost.style.left = (e.clientX - d.w/2) + 'px';
      d.ghost.style.top = (e.clientY - d.w/2) + 'px';
      if (Math.hypot(e.clientX-d.x, e.clientY-d.y) > 5) d.moved = true;
    });

    el.addEventListener('pointerup', e => {
      if (e.button===2) {                                  // right click: highlight / arrow
        const q = this.at(e);
        if (q!=null && this.rs!=null) {
          if (q===this.rs) this.hi.has(q) ? this.hi.delete(q) : this.hi.add(q);
          else { const k=this.rs+'-'+q, i=this.arrows.indexOf(k); i<0 ? this.arrows.push(k) : this.arrows.splice(i,1); }
        }
        this.rs = null; return this.render();
      }
      const d = this.drag; if (!d) return;
      this.drag = null; d.ghost.remove();
      const to = this.at(e);
      if (d.moved && to!=null && to!==d.from) {
        const m = this.targets(d.from).find(x => x.to===to);
        if (m) { this.sel = null; if (this.myTurn) this.onMove(m); else { this.pre = { from:m.from, to:m.to }; Sound.play('premove'); } }
      } else if (!d.moved && d.was) this.sel = null;       // click on selected piece deselects
      this.render();
    });

    el.addEventListener('pointercancel', () => { if (this.drag) { this.drag.ghost.remove(); this.drag = null; this.render(); } });
    this.render();
  }

  startDrag(e, q, was) {
    const pc = this.grid.children[this.flip ? 63-q : q].querySelector('.pc'); if (!pc) return;
    const w = this.grid.getBoundingClientRect().width / 8;
    const g = pc.cloneNode(true);
    g.style.cssText = `position:fixed;left:${e.clientX-w/2}px;top:${e.clientY-w/2}px;width:${w*.97}px;height:${w*.97}px;pointer-events:none;z-index:1000`;
    this.el.append(g); pc.style.opacity = .3;
    this.drag = { from:q, ghost:g, w:w*.97, x:e.clientX, y:e.clientY, moved:false, was };
  }

  at(e) {
    const r = this.grid.getBoundingClientRect();
    const c = Math.floor((e.clientX-r.left)/r.width*8), rw = Math.floor((e.clientY-r.top)/r.height*8);
    if (c<0||c>7||rw<0||rw>7) return null;
    const j = rw*8+c; return this.flip ? 63-j : j;
  }

  get mine() { return this.mode==='both' ? this.s.turn : this.color; }
  get myTurn() { return this.mode==='both' || this.s.turn===this.color; }

  targets(from) {
    const ms = this.myTurn ? Chess.legal(this.s) : Chess.pseudo(this.s, this.mine);
    return ms.filter(m => m.from===from);
  }

  click(q) {
    this.hi.clear(); this.arrows = [];
    if (!this.active) return this.render();
    const had = this.sel;
    if (had!=null && had!==q) {
      const m = this.targets(had).find(x => x.to===q);
      if (m) {
        this.sel = null;
        if (this.myTurn) this.onMove(m); else { this.pre = { from:m.from, to:m.to }; Sound.play('premove'); }
        return this.render();
      }
    }
    this.sel = null; this.pre = null;
    this.render();
  }

  play(m) { const prev = this.s; this.s = Chess.apply(prev, m); this.last = m; this.sel = null; this.render(); if (this.active) Sound.move(prev, m, this.s); }

  tryPre() {
    if (!this.pre) return null;
    const m = Chess.legal(this.s).find(x => x.from===this.pre.from && x.to===this.pre.to);
    this.pre = null; return m || null;
  }

  render() {
    const s = this.s, chk = Chess.inCheck(s);
    const tg = this.sel!=null ? this.targets(this.sel) : [];
    [...this.grid.children].forEach((d,j) => {
      const i = this.flip ? 63-j : j, r=i>>3, c=i&7, p=s.b[i];
      let cl = 'sq ' + ((r+c)%2 ? 'dk' : 'lt');
      if (this.last && (this.last.from===i || this.last.to===i)) cl += ' last';
      if (this.sel===i) cl += ' sel';
      if (this.pre && (this.pre.from===i || this.pre.to===i)) cl += ' pre';
      if (this.hi.has(i)) cl += ' hi';
      if (chk && p===s.turn+'K') cl += ' chk';
      if (tg.some(m => m.to===i)) cl += p ? ' cap' : ' mv';
      d.className = cl;
      d.dataset.rk = j%8===0 ? 8-(i>>3) : '';
      d.dataset.fl = (j>>3)===7 ? 'abcdefgh'[i&7] : '';
      d.innerHTML = p ? `<img class="pc" draggable="false" alt="" src="${PIECE_IMG[p]}">` : '';
    });
    this.drawArrows();
  }

  drawArrows() {
    const ctr = i => { const j = this.flip ? 63-i : i; return [(j&7)*100+50, (j>>3)*100+50]; };
    this.svg.innerHTML = '<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#f97316"/></marker></defs>' +
      this.arrows.map(k => {
        const [a,b] = k.split('-').map(Number), [x1,y1]=ctr(a), [x2,y2]=ctr(b);
        const L = Math.hypot(x2-x1,y2-y1), ux=(x2-x1)/L, uy=(y2-y1)/L;
        return `<line x1="${x1}" y1="${y1}" x2="${x2-ux*34}" y2="${y2-uy*34}" stroke="#f97316" stroke-width="16" stroke-linecap="round" opacity=".9" marker-end="url(#ah)"/>`;
      }).join('');
  }

  flipBoard() { this.flip = !this.flip; this.render(); }
}
