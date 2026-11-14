// Rules engine. Board: 64 squares, index = row*8+col, row 0 = rank 8. Pieces like 'wP','bK'.
const Chess = (() => {
  const N = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  const K = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const R = K.slice(0,4), B = K.slice(4);
  const on = (r,c) => r>=0 && r<8 && c>=0 && c<8;

  function start() {
    const b = Array(64).fill(null), o = 'RNBQKBNR';
    for (let c=0;c<8;c++){ b[c]='b'+o[c]; b[8+c]='bP'; b[48+c]='wP'; b[56+c]='w'+o[c]; }
    return { b, turn:'w', cr:{wK:1,wQ:1,bK:1,bQ:1}, ep:null };
  }

  function attacked(s, sq, by) {
    const r=sq>>3, c=sq&7, b=s.b, d=by==='w'?1:-1;
    for (const dc of [-1,1]) if (on(r+d,c+dc) && b[(r+d)*8+c+dc]===by+'P') return true;
    for (const [x,y] of N) if (on(r+x,c+y) && b[(r+x)*8+c+y]===by+'N') return true;
    for (const [x,y] of K) if (on(r+x,c+y) && b[(r+x)*8+c+y]===by+'K') return true;
    for (const [ds,t] of [[R,'R'],[B,'B']]) for (const [x,y] of ds) {
      let rr=r+x, cc=c+y;
      while (on(rr,cc)) {
        const p=b[rr*8+cc];
        if (p) { if (p[0]===by && (p[1]===t||p[1]==='Q')) return true; break; }
        rr+=x; cc+=y;
      }
    }
    return false;
  }

  // Pseudo-legal moves (ignores leaving own king in check). Also used for premoves.
  function pseudo(s, col, all) {
    const m=[], b=s.b, en=col==='w'?'b':'w';
    for (let i=0;i<64;i++) {
      const p=b[i]; if (!p || p[0]!==col) continue;
      const r=i>>3, c=i&7, t=p[1];
      const add=(to,x={})=>m.push({from:i,to,...x});
      const promos=(to)=>{ for (const q of (all?'QNRB':'Q')) add(to,{promo:q}); };
      if (t==='P') {
        const d=col==='w'?-1:1, sr=col==='w'?6:1, pr=col==='w'?0:7, one=(r+d)*8+c;
        if (on(r+d,c) && !b[one]) {
          if (r+d===pr) promos(one);
          else { add(one); if (r===sr && !b[one+d*8]) add(one+d*8,{dbl:1}); }
        }
        for (const dc of [-1,1]) {
          if (!on(r+d,c+dc)) continue;
          const to=(r+d)*8+c+dc;
          if (b[to] && b[to][0]===en) { if (r+d===pr) promos(to); else add(to); }
          else if (to===s.ep) add(to,{ep:1});
        }
      } else if (t==='N' || t==='K') {
        for (const [x,y] of t==='N'?N:K) {
          if (!on(r+x,c+y)) continue;
          const to=(r+x)*8+c+y;
          if (!b[to] || b[to][0]===en) add(to);
        }
        if (t==='K') {
          const row=col==='w'?56:0;
          if (i===row+4 && !attacked(s,i,en)) {
            if (s.cr[col+'K'] && !b[row+5] && !b[row+6] && b[row+7]===col+'R' && !attacked(s,row+5,en)) add(row+6,{castle:'K'});
            if (s.cr[col+'Q'] && !b[row+1] && !b[row+2] && !b[row+3] && b[row]===col+'R' && !attacked(s,row+3,en)) add(row+2,{castle:'Q'});
          }
        }
      } else {
        for (const [x,y] of t==='R'?R:t==='B'?B:K) {
          let rr=r+x, cc=c+y;
          while (on(rr,cc)) {
            const to=rr*8+cc;
            if (b[to]) { if (b[to][0]===en) add(to); break; }
            add(to); rr+=x; cc+=y;
          }
        }
      }
    }
    return m;
  }

  function apply(s, m) {
    const b=s.b.slice(), p=b[m.from], col=p[0], cr={...s.cr};
    b[m.to]=m.promo?col+m.promo:p; b[m.from]=null;
    if (m.ep) b[m.to+(col==='w'?8:-8)]=null;
    if (m.castle) {
      const row=col==='w'?56:0;
      if (m.castle==='K'){ b[row+5]=b[row+7]; b[row+7]=null; } else { b[row+3]=b[row]; b[row]=null; }
    }
    if (p[1]==='K') cr[col+'K']=cr[col+'Q']=0;
    for (const [sq,k] of [[56,'wQ'],[63,'wK'],[0,'bQ'],[7,'bK']]) if (m.from===sq||m.to===sq) cr[k]=0;
    return { b, turn:col==='w'?'b':'w', cr, ep:m.dbl?(m.from+m.to)/2:null };
  }

  const inCheck = (s, col=s.turn) => { const k = s.b.indexOf(col+'K'); return k>=0 && attacked(s, k, col==='w'?'b':'w'); };
  const legal = (s, col=s.turn, all) => pseudo(s,col,all).filter(m => !inCheck(apply(s,m), col));

  // dead positions: K v K, K+minor v K, or only same-coloured bishops
  function insufficient(s) {
    const ps = [];
    for (let i=0;i<64;i++) { const p = s.b[i]; if (p && p[1]!=='K') ps.push([p[1], i]); }
    if (!ps.length) return true;
    if (ps.every(x => x[0]==='B')) return new Set(ps.map(x => ((x[1]>>3)+(x[1]&7))%2)).size===1;
    return ps.length===1 && ps[0][0]==='N';
  }
  // can this colour still deliver mate? (used for timeouts)
  function canMate(s, col) {
    const mine = s.b.filter(p => p && p[0]===col && p[1]!=='K').map(p => p[1]);
    const theirs = s.b.filter(p => p && p[0]!==col && p[1]!=='K').length;
    if (mine.some(t => 'PRQ'.includes(t)) || mine.length>=2) return true;
    return mine.length===1 && theirs>0;
  }
  function fen(s) {
    let r = '';
    for (let y=0;y<8;y++) {
      let e = 0;
      for (let x=0;x<8;x++) { const p = s.b[y*8+x]; if (!p) e++; else { if (e) { r += e; e = 0; } r += p[0]==='w' ? p[1] : p[1].toLowerCase(); } }
      if (e) r += e; if (y<7) r += '/';
    }
    const cr = (s.cr.wK?'K':'')+(s.cr.wQ?'Q':'')+(s.cr.bK?'k':'')+(s.cr.bQ?'q':'');
    return `${r} ${s.turn} ${cr||'-'} ${s.ep==null ? '-' : 'abcdefgh'[s.ep&7]+(8-(s.ep>>3))} 0 1`;
  }
  const key = s => fen(s).split(' ').slice(0,4).join(' ');

  function status(s) {
    if (insufficient(s)) return { over:true, winner:null, text:'Draw by insufficient material' };
    if (legal(s).length) return null;
    return inCheck(s) ? { over:true, winner:s.turn==='w'?'b':'w', text:'Checkmate' } : { over:true, winner:null, text:'Stalemate' };
  }

  return { start, pseudo, apply, legal, inCheck, status, canMate, fen, key };
})();
