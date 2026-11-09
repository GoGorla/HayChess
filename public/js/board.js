// Simple flat piece set (viewBox 45x45). Colors come from CSS (.pc.w / .pc.b).
const SVG = {
  P:'<path d="M22.5 18c-3 0-5 1.5-5 3.5 0 1.5 1 2.5 2.5 3.5-4 1.5-7 5.5-7 11.5h19c0-6-3-10-7-11.5 1.5-1 2.5-2 2.5-3.5 0-2-2-3.5-5-3.5z"/><circle cx="22.5" cy="13" r="5.5"/><rect x="11" y="36" width="23" height="4" rx="2"/>',
  R:'<path d="M11 40v-4h2.5v-5H17V18h-4V9h5v3h3V9h3v3h3V9h5v9h-4v13h3.5v5H34v4z"/><path class="d" d="M17 18h11M13.5 31h18M11 36h23"/>',
  N:'<path d="M12 40l2-11c0-5 4-8 6-11l-4-1-1-4 5-3 2-5 3 4c8 2 11 10 10 18l-1 13z"/><circle class="e" cx="21" cy="12.5" r="1.3"/><circle class="e" cx="15.7" cy="14.5" r=".8"/><path class="d" d="M25 9c4 2 7 7 7 13M12 36h22"/>',
  B:'<circle cx="22.5" cy="8.5" r="3"/><path d="M22.5 11.500c-6 5-9 9-9 14 0 3 2 5 4 6.500h-6.500v5.500h23v-5.500h-6.500c2-1.500 4-3.500 4-6.500 0-5-3-9-9-14z"/><path class="d" d="M20 20l5 5M17.500 32h10M11 36.500h23"/>',
  Q:'<path d="M9 14l5 18h17l5-18-7.500 8-6-13-6 13z"/><circle cx="9" cy="13" r="2.300"/><circle cx="22.500" cy="8" r="2.300"/><circle cx="36" cy="13" r="2.300"/><rect x="12" y="32" width="21" height="6" rx="1.500"/><path class="d" d="M14.500 28h16"/>',
  K:'<path d="M22.5 14c-9 0-12 7-10 13l2 5h16l2-5c2-6-1-13-10-13z"/><rect x="12" y="32" width="21" height="6" rx="1.500"/><path class="d" d="M22.500 3.500v10.500M18.500 7.500h8M14.500 28h16"/>'
};

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
        if (m) { this.sel = null; if (this.myTurn) this.onMove(m); else this.pre = { from:m.from, to:m.to }; }
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
    g.style.cssText = `position:fixed;left:${e.clientX-w/2}px;top:${e.clientY-w/2}px;width:${w*.9}px;height:${w*.9}px;pointer-events:none;z-index:1000`;
    this.el.append(g); pc.style.opacity = .3;
    this.drag = { from:q, ghost:g, w:w*.9, x:e.clientX, y:e.clientY, moved:false, was };
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
        if (this.myTurn) this.onMove(m); else this.pre = { from:m.from, to:m.to };
        return this.render();
      }
    }
    this.sel = null; this.pre = null;
    this.render();
  }

  play(m) { this.s = Chess.apply(this.s, m); this.last = m; this.sel = null; this.render(); }

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
      d.innerHTML = p ? `<span class="pc ${p[0]}"><svg viewBox="0 0 45 45">${SVG[p[1]]}</svg></span>` : '';
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
