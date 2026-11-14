// Learn: practice lessons (collect stars / solve a position), reading lessons with diagrams, and a board set-up exercise.
// Positions are written as tokens like "wKe1".
const Learn = (() => {
  const sq = n => 'abcdefgh'.indexOf(n[0]) + (8 - +n[1]) * 8;
  const nm = i => 'abcdefgh'[i&7] + (8 - (i>>3));
  const parse = str => { const b = Array(64).fill(null); (str || '').split(/\s+/).filter(Boolean).forEach(t => { b[sq(t.slice(2))] = t.slice(0,2); }); return b; };
  const C = (pos, st, tx) => ({ pos, st, tx });
  const file = f => [1,2,3,4,5,6,7,8].map(r => f + r).join(' ');
  const rank = (...rs) => rs.flatMap(r => 'abcdefgh'.split('').map(f => f + r)).join(' ');
  const P = (t, x, pos, mk, ar) => ({ t, x, pos: pos || '', mk: mk || '', ar: ar || '' });   // a reading page with a diagram
  const START = 'wRa1 wNb1 wBc1 wQd1 wKe1 wBf1 wNg1 wRh1 wPa2 wPb2 wPc2 wPd2 wPe2 wPf2 wPg2 wPh2 bRa8 bNb8 bBc8 bQd8 bKe8 bBf8 bNg8 bRh8 bPa7 bPb7 bPc7 bPd7 bPe7 bPf7 bPg7 bPh7';
  const NAMES = { K:'king', Q:'queen', R:'rook', B:'bishop', N:'knight', P:'pawn' };

  const S = [
    /* ---------------- Moves & Pieces ---------------- */
    { id:'board', tab:'moves', name:'The Board', pc:'wK', hue:200, kind:'guided', desc:'Ranks, files, and where every piece starts.', sc:[
      { title:'Ranks, files and the starting position', pages:[
        P('The board', 'A chessboard is an 8 by 8 grid of 64 squares that alternate between light and dark. Turn the board so that a light square sits in the bottom-right corner for both players.', '', 'h1'),
        P('Files run up and down', 'The eight columns are called files. They are named with the letters a to h, from left to right as White sees the board. The marked column is the e-file.', '', file('e')),
        P('Ranks run across', 'The eight rows are called ranks. They are numbered 1 to 8, starting from White\'s side of the board. The marked row is the fourth rank.', '', rank(4)),
        P('Naming a square', 'Every square is named by its file letter followed by its rank number. The marked square is where the e-file meets the fourth rank, so it is called e4.', '', 'e4'),
        P('Where White starts', 'White begins on ranks 1 and 2, the two rows closest to White. Rank 2 holds the eight pawns and rank 1 holds the other eight pieces.', START, rank(1, 2)),
        P('Where Black starts', 'Black begins on ranks 7 and 8, the two rows at the far side. Rank 7 holds the pawns and rank 8 holds the pieces, a mirror image of White.', START, rank(7, 8)),
        P('The back rank', 'On the back rank the pieces stand in this order: rook, knight, bishop, queen, king, bishop, knight, rook. Each queen starts on a square of her own color, and the two kings face each other on the e-file.', START, 'd1 d8 e1 e8') ] } ] },
    { id:'pawn', tab:'moves', name:'Pawn', pc:'wP', hue:196, kind:'collect', desc:'Pawns march forward and capture diagonally.', sc:[
      C('wPe2','e4','A pawn can move two squares on its first move. Collect the star!'),
      C('wPe3','e4 e5 e6','After that, pawns move one square at a time. Collect all three stars.'),
      C('wPd4 bNe5 bNf6','','Pawns capture diagonally, never straight ahead. Capture both pieces.'),
      C('wPc2 wPc3 bNd3','d4','A blocked pawn can still capture. Take the piece, then reach the star.'),
      C('wPf2 bNg3 bNh5','g4','Combine pushes and captures to clear the board.') ] },
    { id:'rook', tab:'moves', name:'Rook', pc:'wR', hue:172, kind:'collect', desc:'Rooks glide along ranks and files.', sc:[
      C('wRa1','a6 h6','Rooks move in straight lines, any distance. Collect both stars.'),
      C('wRd4','d1 h1','Plan your route to use as few moves as you can.'),
      C('wRe4 bNe8 bNa8','','Capture both knights.'),
      C('wRa1 wPa3','a5','Rooks cannot jump over pieces. Find a way around the pawn.'),
      C('wRc3','c7 g7 g2','Three stars, three moves. Can you do it?') ] },
    { id:'bishop', tab:'moves', name:'Bishop', pc:'wB', hue:210, kind:'collect', desc:'Bishops slide diagonally and never change square colour.', sc:[
      C('wBc1','h6 f8','Bishops move diagonally. Collect both stars.'),
      C('wBc3','a1 h8','Use the long diagonal.'),
      C('wBd4 bNg7 bNb2','','Capture both knights.'),
      C('wBc1 wPd2','a3 e7','Your own pawn is in the way, so go the other direction first.'),
      C('wBd1','h5 e8','Chain diagonals together.') ] },
    { id:'knight', tab:'moves', name:'Knight', pc:'wN', hue:232, kind:'collect', desc:'Knights jump in an L and leap over everything.', sc:[
      C('wNb1','c3 e4','Knights move in an L: two squares one way, one the other.'),
      C('wNg1','f3 h4','Hop from star to star.'),
      C('wNe4 bNc5 bNd7','','Capture both knights.'),
      C('wNa1','c2 e3 g4','Three stars in three jumps.'),
      C('wNb1 wPc3 wPd2','b5','Knights jump over pieces, but cannot land on their own.') ] },
    { id:'queen', tab:'moves', name:'Queen', pc:'wQ', hue:268, kind:'collect', desc:'The queen combines rook and bishop.', sc:[
      C('wQd1','d8 a5','The queen moves like a rook and a bishop together.'),
      C('wQa1','a8 h8 h1','Sweep the edges of the board.'),
      C('wQd4 bNd8 bNh8 bNh4','','Capture all three knights.'),
      C('wQe1 wPd2 wPe2 wPf2','a1 a8','Your pawns box you in. Slide along the back rank.'),
      C('wQc3','a5 e5 e1','Find the shortest route through all three stars.') ] },
    { id:'king', tab:'moves', name:'King', pc:'wK', hue:305, kind:'collect', desc:'The king steps one square in any direction.', sc:[
      C('wKe1','e3','The king moves one square at a time.'),
      C('wKa1','c3 c5','Walk the king to both stars.'),
      C('wKd4 bNe5 bNf6','','Kings can capture too. Take both knights.'),
      C('wKe4','e8','A long walk. Every step counts.'),
      C('wKe1 wPe2','e3','Your pawn blocks the way. Go around it.') ] },
    { id:'values', tab:'moves', name:'Piece Values', pc:'wQ', hue:150, kind:'read', desc:'How much each piece is worth, and what makes a fair trade.', sc:[
      { title:'What each piece is worth', pages:[
        P('Counting material', 'Players use points to compare pieces. A pawn is worth 1 point, the baseline for everything else.', 'wPe4', 'e4'),
        P('Knights and bishops', 'A knight or a bishop is worth about 3 points. Together they are called the minor pieces.', 'wNd4 wBg4', 'd4 g4'),
        P('Rooks', 'A rook is worth about 5 points because it controls whole ranks and files.', 'wRd4', 'd4'),
        P('The queen', 'The queen is worth about 9 points, the same as a rook, a bishop and a pawn together.', 'wQd4', 'd4'),
        P('The king', 'The king has no point value because losing it ends the game. In the endgame it also becomes a strong fighting piece.', 'wKe1', 'e1') ] },
      { title:'Fair and unfair trades', pages:[
        P('Even trades', 'Capturing a knight with a knight is an even trade: 3 points for 3 points.', 'wNe5 bNc6', 'e5 c6', 'e5-c6'),
        P('Winning material', 'If your knight takes a rook, you gain 5 points. Even if the knight is captured back, you are still ahead by 2 points.', 'wNd4 bRe6', 'd4 e6', 'd4-e6'),
        P('Do not give material away', 'Taking a protected pawn with your queen risks losing 9 points for 1. Always check whether the target is defended.', 'wQd4 bPg7 bBh8', 'g7 h8', 'd4-g7') ] } ] },
    { id:'ep', tab:'moves', name:'En passant', pc:'wP', hue:336, kind:'goal', goal:'ep', desc:'A special pawn capture, only available right away.', sc:[
      { pos:'wKe1 wPe5 bKe8 bPd5', ep:'d6', tx:'Black just moved a pawn two squares. Capture it en passant!' },
      { pos:'wKg1 wPe5 bKg8 bPf5', ep:'f6', tx:'Capture the pawn that just passed you, as if it had moved one square.' },
      { pos:'wKe1 wPb5 bKe8 bPa5', ep:'a6', tx:'It works on the edge of the board too.' },
      { pos:'wKg1 wPd5 wPg5 bKg8 bPe5', ep:'e6', tx:'Only one pawn can be captured en passant. Pick the right one.' },
      { pos:'wKe1 wPc5 wPe5 bKe8 bPb5 bPd5', ep:'b6', tx:'Black just played b7-b5. Capture it en passant.' } ] },
    { id:'castle', tab:'moves', name:'Castling', pc:'wR', hue:14, kind:'goal', goal:'castle', desc:'Tuck your king away and bring a rook into play.', sc:[
      { pos:'wKe1 wRh1 bKe8', cr:'K', only:'K', tx:'Castle kingside: move your king two squares toward the rook.' },
      { pos:'wKe1 wRa1 bKe8', cr:'Q', only:'Q', tx:'Castle queenside: the king moves two squares toward the a-rook.' },
      { pos:'wKe1 wRa1 wRh1 wPa2 wPh2 bKe8', cr:'KQ', tx:'You can castle either way. Pick one.' },
      { pos:'wKe1 wRa1 bKe8 bRb8', cr:'Q', only:'Q', tx:'The rook attacks b1, but the king never crosses it. Castling is still legal.' },
      { pos:'wKe1 wRh1 wPf2 wPg2 bKe8 bRh8', cr:'K', only:'K', tx:'Your rook is attacked, but you may still castle kingside.' } ] },
    { id:'notation', tab:'moves', name:'Reading Moves', pc:'wN', hue:62, kind:'read', desc:'Understand the letters and symbols used to write moves.', sc:[
      { title:'Chess notation', pages:[
        P('Piece letters', 'Moves are written with a letter for the piece: K for king, Q for queen, R for rook, B for bishop and N for knight. Pawns have no letter.', START),
        P('Writing a move', 'Nf3 means a knight moves to f3. The piece letter comes first, then the square it lands on.', 'wNg1', 'g1 f3', 'g1-f3'),
        P('Pawn moves', 'A pawn move is written as just the destination square. The move e4 means a pawn goes to e4.', 'wPe2', 'e2 e4', 'e2-e4'),
        P('Captures', 'An x marks a capture. Bxc6 means a bishop captures the piece on c6.', 'wBb5 bNc6', 'b5 c6', 'b5-c6'),
        P('Special symbols', 'O-O is castling kingside and O-O-O is castling queenside. A plus sign means check, a hash sign means checkmate, and an equals sign shows promotion, as in e8=Q.', 'wKe1 wRh1', 'e1 h1') ] } ] },

    /* ---------------- Tactics ---------------- */
    { id:'tactic', tab:'tactics', name:'What Is a Tactic?', pc:'wN', hue:20, kind:'read', desc:'The idea behind the tricks you are about to learn.', sc:[
      { title:'Thinking in tactics', pages:[
        P('A short, forcing idea', 'A tactic is a short sequence of forcing moves that wins material or delivers checkmate. Here a knight attacks the king and the rook at once. This is called a fork.', 'wNc7 bKe8 bRa8', 'c7', 'c7-e8 c7-a8'),
        P('Look for forcing moves', 'Before each move, check three things: checks, captures and threats. Forcing moves limit your opponent\'s choices, which makes tactics easier to find.', 'wQh5 bKe8 bPf7', 'h5 f7', 'h5-f7'),
        P('What comes next', 'You will practise skewers and pins, then checks and checkmates, and finally how to avoid stalemate when you are winning.', '') ] } ] },
    { id:'skewer', tab:'tactics', name:'Skewer', pc:'wB', hue:28, kind:'goal', goal:'skewer', desc:'Attack a valuable piece so it must move, exposing the one behind.', sc:[
      { pos:'wKh1 wRa1 bKe6 bQe8', tx:'Skewer: check the king so it has to move, then win the queen behind it.', steps:[{ ok:['a1e1'], reply:'e6d6' }, { ok:['e1e8'], msg:'The king moved. Capture the queen!' }] },
      { pos:'wKg1 wBd1 bKc6 bRe8', tx:'Use your bishop to skewer the king and rook.', steps:[{ ok:['d1a4'], reply:'c6c7' }, { ok:['a4e8'], msg:'Capture the rook behind the king!' }] },
      { pos:'wKg1 wRa1 bKd8 bRh8', tx:'Skewer along the back rank.', steps:[{ ok:['a1a8'], reply:'d8d7' }, { ok:['a8h8'], msg:'Take the rook!' }] },
      { pos:'wKh1 wQb1 bKe5 bRe8', tx:'Your queen can skewer too.', steps:[{ ok:['b1e1'], reply:'e5d5' }, { ok:['e1e8'], msg:'Win the rook!' }] },
      { pos:'wKg1 wBd2 bKe7 bRf8', tx:'Check the king along the diagonal so the rook falls.', steps:[{ ok:['d2b4'], reply:'e7d7' }, { ok:['b4f8'], msg:'The rook is unprotected. Take it!' }] } ] },
    { id:'pin', tab:'tactics', name:'Pin', pc:'wB', hue:48, kind:'goal', goal:'pin', desc:'Freeze a piece because moving it would expose something bigger.', sc:[
      { pos:'wKe1 wBc4 bKe8 bNc6', target:'c6', tx:'Pin the knight to the king. It cannot move without exposing the king.' },
      { pos:'wKg1 wRa1 bKe8 bNe5', target:'e5', tx:'Pin the knight on the e-file with your rook.' },
      { pos:'wKe1 wQd1 bKc8 bNe6', target:'e6', tx:'Your queen can pin along a diagonal.' },
      { pos:'wKg1 wBc1 bKf8 bNe7', target:'e7', tx:'Pin the knight to the king with your bishop.' },
      { pos:'wKh1 wRa2 bKh4 bBd4', target:'d4', tx:'Pin the bishop along the fourth rank.' } ] },
    { id:'check', tab:'checks-mates', name:'Check', pc:'wK', hue:96, kind:'goal', goal:'check', desc:'Attack the enemy king.', sc:[
      { pos:'wKe1 wQd1 bKe8', tx:'Give check: attack the black king.' },
      { pos:'wKg1 wRa1 bKe8', tx:'Give check with your rook.' },
      { pos:'wKg1 wNe4 bKe8', tx:'Knights give check from an L-shape away.' },
      { pos:'wKe1 wBc4 bKe8', tx:'Give check with the bishop.' },
      { pos:'wKg1 wPd3 bKe5', tx:'Even a pawn can give check. Push it!' },
      { pos:'wKg1 wRe1 wBe4 bKe8', tx:'Move the bishop to uncover a check from the rook.' },
      { pos:'wKg2 wQd1 bKg8 bPg7 bPh7', tx:'Find a check for your queen.' },
      { pos:'wKe1 wBc4 wQd1 bKe8', only:'B', tx:'Give check with the bishop, not the queen.' } ] },
    { id:'mate', tab:'checks-mates', name:'Checkmate', pc:'bK', hue:152, kind:'goal', goal:'mate', desc:'The king is attacked and has no escape.', sc:[
      { pos:'wKg1 wRa1 bKg8 bPf7 bPg7 bPh7', tx:'Mate in one: the black king is trapped by its own pawns.' },
      { pos:'wKf6 wQa7 bKh8', tx:'Mate in one: your king supports the queen.' },
      { pos:'wKe1 wRa7 wRb1 bKe8', tx:'Mate in one with two rooks.' },
      { pos:'wKg1 wNe5 bKh8 bRg8 bPg7 bPh7', tx:'Mate in one with the knight.' },
      { pos:'wKe1 wQh5 wBc4 bKe8 bQd8 bBf8 bNg8 bPf7 bPd7', tx:'Mate in one: attack the weak f7 square.' },
      { pos:'wKb6 wRh1 bKa8', tx:'Mate in one: the king and rook trap the king.' },
      { pos:'wKg1 wQh5 wBd3 bKg8 bRf8 bPh7', tx:'Mate in one: your bishop protects the queen.' },
      { pos:'wKe1 wRa7 wNf6 bKh8', tx:'Mate in one: knight and rook together.' } ] },
    { id:'stale', tab:'tactics', name:'Avoid stalemate', pc:'wQ', hue:182, kind:'goal', goal:'stale', desc:'A draw happens when the side to move has no legal move and is not in check.', sc:[
      { pos:'wKf6 wQe4 bKh8', tx:'You are winning, but be careful. Make a move that leaves Black a legal move.' },
      { pos:'wKc2 wQd5 bKa1', tx:'Do not trap the king without giving check.' },
      { pos:'wKf2 wQe3 bKh1', tx:'Leave the black king a legal move, or deliver mate.' },
      { pos:'wKg6 wQe2 bKh8', tx:'Some queen moves are a blunder here. Avoid stalemate!' },
      { pos:'wKb6 wQh3 bKa8', tx:'Find a move that does not stalemate Black.' } ] },
    { id:'draws', tab:'tactics', name:'Ways to Draw', pc:'wK', hue:240, kind:'read', desc:'Every way a game can end without a winner.', sc:[
      { title:'Stalemate and dead positions', pages:[
        P('Stalemate', 'If the player to move is not in check but has no legal move, the game is drawn. It often happens when the stronger side forgets to leave the enemy king a square.', 'wKf6 wQg6 bKh8', 'h8'),
        P('Insufficient material', 'If neither side has enough pieces to ever give checkmate, the game is drawn at once. King against king, or king and one minor piece against a king, are examples.', 'wKe1 wNb1 bKe8'),
        P('Same-colored bishops', 'Bishops that all stand on the same color of square cannot force checkmate either, so kings and same-colored bishops are a draw.', 'wKe1 wBc1 bKe8 bBf8', 'c1 f8') ] },
      { title:'Repetition, fifty moves and agreement', pages:[
        P('Threefold repetition', 'If the same position appears three times, the game is drawn. HayChess declares this automatically.', ''),
        P('Perpetual check', 'If one side can keep giving check and the other king cannot escape, the position repeats and the game is drawn. This is called perpetual check.', 'wQf7 bKh8 wKg1', 'f7 h8', 'f7-h8'),
        P('The fifty-move rule', 'If fifty moves by each side pass with no pawn move and no capture, the game is drawn.', ''),
        P('Agreement and timeouts', 'Players can agree to a draw at any time. If a player runs out of time but the opponent could not possibly checkmate, the game is a draw as well.', '') ] } ] }
  ];
  S.forEach(s => s.sc.forEach((c, i) => { c.id = s.id + '-' + i; }));
  const TABS = ['moves', 'tactics', 'checks-mates'];

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
  let cur = null, lb = null, trayPick = null;
  const prog = () => Store.get('learn', {});
  const flat = tab => S.flatMap((s, si) => s.tab===tab ? s.sc.map((c, i) => ({ si, i, key:c.id })) : []);
  const starsStr = n => '&#9733;'.repeat(n) + '<i>' + '&#9733;'.repeat(3 - n) + '</i>';
  const ICON = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.500 4.500L19 7.500"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.500l2.900 6.200 6.600.8-4.900 4.600 1.300 6.600L12 17.400 6.100 20.700l1.300-6.600L2.500 9.500l6.600-.8z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.500c3-1 6-1 9 1v13c-3-2-6-2-9-1zM21 5.500c-3-1-6-1-9 1v13c3-2 6-2 9-1z"/></svg>'
  };

  function render() {
    rails(typeof learnSub==='string' && learnSub!=='openings' ? learnSub : 'moves');
    const p = prog();
    let total = 0, all = 0; S.forEach(s => s.sc.forEach(c => { all++; total += p[c.id] || 0; }));
    $('#learnstars').innerHTML = '&#9733; ' + total + ' / ' + all * 3;
    TABS.forEach(tab => {
      const f = flat(tab), curKey = (f.find(x => p[x.key]==null) || {}).key;
      $('#path-' + tab).innerHTML = S.map((s, si) => {
        if (s.tab!==tab) return '';
        const doneN = s.sc.filter(c => p[c.id]!=null).length;
        return `<section class="unit" data-id="${s.id}" style="--h:${s.hue}"><div class="ubanner"><div><small>${s.kind==='read' || s.kind==='guided' ? 'READ &amp; LEARN' : 'PRACTICE'} &middot; ${doneN}/${s.sc.length}</small><h2>${s.name}</h2><p>${s.desc}</p></div><img alt="" src="${PIECE_IMG[s.pc]}"></div><div class="nodes">` +
          s.sc.map((c, i) => {
            const st = p[c.id], state = st!=null ? 'done' : c.id===curKey ? 'cur' : 'lock', read = s.kind==='read' || s.kind==='guided';
            return `<button class="node ${state}" style="--x:${OFF[i%8]}px" data-s="${si}" data-i="${i}">` +
              (state==='cur' ? '<span class="startb">START</span>' : '') +
              `<span class="nface">${ICON[state==='lock' ? 'lock' : state==='done' ? 'check' : read ? 'book' : 'star']}</span>` +
              (state==='done' ? `<span class="nstars">${starsStr(st)}</span>` : '') + '</button>';
          }).join('') + '</div></section>';
      }).join('');
    });
  }
  const TIPS = ['Control the center with pawns and pieces early in the game.', 'Develop your knights and bishops before moving the same piece twice.', 'Castle early to protect your king and connect your rooks.',
    'Before every move, ask what your opponent is threatening.', 'Do not bring your queen out too early; she can be chased around.', 'Knights are strongest near the center. A knight on the rim is dim.',
    'In the endgame, bring your king toward the action.', 'A passed pawn must be pushed. It is a long-term asset.', 'Trade pieces when you are ahead in material, and avoid trades when behind.',
    'Rooks belong on open files. Put them where the pawns are gone.', 'Look for checks, captures and threats on every single move.', 'If you find a good move, look for a better one before you play it.'];
  const SPOT = [['wP','Pawn','Small but mighty: pawns decide the structure of the whole game.'], ['wN','Knight','The only piece that jumps. Great for forks.'], ['wB','Bishop','Loves long open diagonals and stays on one color all game.'],
    ['wR','Rook','Best on open files and the seventh rank.'], ['wQ','Queen','The strongest piece, but never worth risking for a pawn.'], ['wK','King','Safe in the corner early, a fighter in the endgame.']];
  function rails(tab) {
    const p = prog(), f = flat(tab), day = Math.floor(Date.now() / 864e5), cp = flat(tab).find(x => p[x.key]==null);
    let total = 0, all = 0, done = 0; S.forEach(s => s.sc.forEach(c => { all++; if (p[c.id]!=null) { done++; total += p[c.id]; } }));
    const pct = Math.round(done / all * 100), sp = SPOT[day % SPOT.length], R = 34, C = 2 * Math.PI * R;
    const stages = S.filter(s => s.tab===tab).map(s => { const d = s.sc.filter(c => p[c.id]!=null).length; return `<div class="mini"><span>${s.name}</span><div class="bar"><i style="width:${d / s.sc.length * 100}%"></i></div><b>${d}/${s.sc.length}</b></div>`; }).join('');
    $('#learn-left').innerHTML = `<div class="rcard"><div class="rtitle">Your progress</div>
      <div class="ringrow"><svg viewBox="0 0 80 80" class="ring"><circle cx="40" cy="40" r="${R}" class="rt"/><circle cx="40" cy="40" r="${R}" class="ra" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct / 100)}" transform="rotate(-90 40 40)"/></svg><div><b>${pct}%</b><small>of all lessons</small></div></div>
      <div class="stat"><span>&#9733; ${total}</span><span>${done} / ${all} lessons</span></div>
      ${cp ? `<button class="btn wide" data-go="${cp.si},${cp.i}">Continue learning</button>` : '<p class="muted small">This section is finished. Nice work!</p>'}</div>
      <div class="rcard"><div class="rtitle">This section</div>${stages || '<p class="muted small">Nothing here yet.</p>'}</div>`;
    $('#learn-right').innerHTML = `<div class="rcard tip"><div class="rtitle">Tip of the day</div><p>${TIPS[day % TIPS.length]}</p></div>
      <div class="rcard spot"><div class="rtitle">Piece spotlight</div><img alt="" src="${PIECE_IMG[sp[0]]}"><b>${sp[1]}</b><p class="muted small">${sp[2]}</p></div>
      <div class="rcard"><div class="rtitle">How to read the path</div><ul class="legend"><li><i class="lg cur"></i>Your next lesson</li><li><i class="lg done"></i>Completed, with stars</li><li><i class="lg lock"></i>Locked until you finish earlier ones</li></ul><p class="muted small">Earn up to three stars on every lesson. Using a hint lowers the maximum.</p></div>`;
  }
  function celebrate(stageId) {                              // falling pieces on the finished section only
    clearCelebration();
    const sec = document.querySelector(`.unit[data-id="${stageId}"]`); if (!sec) return;
    const keys = Object.keys(PIECE_IMG), box = document.createElement('div'); box.className = 'fall'; box.style.setProperty('--fh', (sec.offsetHeight + 80) + 'px');
    box.innerHTML = Array.from({ length:22 }, () => `<img alt="" src="${PIECE_IMG[keys[(Math.random()*keys.length)|0]]}" style="left:${Math.random()*92}%;animation-duration:${2+Math.random()*2}s;animation-delay:${Math.random()*.8}s;--rot:${(Math.random()*720-360)|0}deg">`).join('');
    sec.append(box); box.dataset.t = setTimeout(() => box.remove(), 6200);
  }
  function clearCelebration() { document.querySelectorAll('.unit .fall').forEach(b => { clearTimeout(+b.dataset.t); b.remove(); }); }

  function open(si, i) {
    const s = S[si], p = prog(), f = flat(s.tab), idx = f.findIndex(x => x.si===si && x.i===i);
    if (idx < 0 || f.slice(0, idx).some(x => p[x.key]==null)) return toast('Finish the earlier lessons first.');
    clearCelebration();
    cur = { si, i, st:s, sc:s.sc[i], mistakes:0, hinted:false, hint:0, moves:0, step:0, done:false, busy:false, me:-1, par:0, page:0, phase:'practice' };
    openTab('lesson', false, s.sc[i].id); setup();
  }
  function openById(id) { for (let si = 0; si < S.length; si++) { const i = S[si].sc.findIndex(c => c.id===id); if (i >= 0) return open(si, i); } openTab('learn'); }

  function ui(mode) {
    $('#lpager').hidden = mode!=='read'; $('#ltray').hidden = mode!=='setup';
    $('#lbtns').hidden = mode==='read'; $('#lcheck').hidden = mode!=='setup'; $('#lhint').hidden = false;
    $('#lnote').textContent = mode==='read' ? 'Read each page and study the board. Use Back and Next to move through the lesson.'
      : mode==='setup' ? 'Pick a piece, then click a square to place it. Click a placed piece (or use the eraser) to remove it.' : 'Press Hint once to see which piece to move, and again to see where it goes.';
  }
  function newBoard(locked) {
    lb = new Board(freshBoard('lboard'), { mode:'online', color:'w', onMove });
    lb.locked = !!locked; lb.active = !locked; return lb;
  }
  function setup() {
    const sc = cur.sc, st = cur.st;
    $('#lbar').hidden = true; $('#lbar').className = 'lbar';
    if (st.kind==='read' || st.kind==='guided') { cur.phase = 'read'; cur.page = 0; paintPage(); return; }
    ui('practice'); newBoard(false);
    lb.s = startState(sc);
    lb.stars = new Set((sc.st || '').split(' ').filter(Boolean).map(sq));
    if (st.kind==='collect') { cur.me = sq(sc.pos.split(' ')[0].slice(2)); cur.par = (bfs(lb.s.b, cur.me, lb.stars) || []).length; }
    cur.hint = 0; cur.step = 0; cur.busy = false; cur.done = false;
    lb.render(); paintInfo();
  }
  function paintDots() {
    const p = prog();
    $('#lprog').innerHTML = cur.st.sc.map((c, i) => `<i class="${p[c.id]!=null ? 'on' : i===cur.i ? 'now' : ''}"></i>`).join('');
    $('#lesson').style.setProperty('--h', cur.st.hue);
  }
  function paintInfo() {
    const sc = cur.sc, st = cur.st;
    $('#ltitle').textContent = st.name + ' · ' + (cur.i + 1) + ' of ' + st.sc.length;
    $('#ltask').textContent = sc.steps ? (cur.step ? sc.steps[cur.step-1].msg || '' : sc.tx) : sc.tx;
    $('#ltext').textContent = st.kind==='collect' ? 'Par: ' + cur.par + ' move' + (cur.par===1 ? '' : 's') + ' for three stars.' : '';
    paintDots();
  }

  /* ----- reading pages ----- */
  function paintPage() {
    const sc = cur.sc, pg = sc.pages[cur.page], last = cur.page === sc.pages.length - 1;
    ui('read'); newBoard(true);
    lb.s = startState({ pos: pg.pos });
    lb.marks = new Set(pg.mk.split(' ').filter(Boolean).map(sq));
    lb.arrows = pg.ar.split(' ').filter(Boolean).map(a => { const [x, y] = a.split('-'); return sq(x) + '-' + sq(y); });
    lb.render();
    $('#ltitle').textContent = cur.st.name + ' · ' + sc.title;
    $('#ltask').textContent = pg.t; $('#ltext').textContent = pg.x;
    $('#lpg').textContent = (cur.page + 1) + ' / ' + sc.pages.length;
    $('#lprev').disabled = cur.page === 0;
    $('#lnextpg').textContent = last ? (cur.st.kind==='guided' ? 'Set up the board' : 'Finish') : 'Next';
    paintDots();
  }
  function nextPage() {
    const last = cur.page === cur.sc.pages.length - 1;
    if (!last) { cur.page++; return paintPage(); }
    if (cur.st.kind==='guided') return startSetup();
    win(3);
  }

  /* ----- board set-up exercise ----- */
  function startSetup() {
    cur.phase = 'setup'; cur.mistakes = 0; cur.hinted = false; trayPick = null;
    ui('setup'); newBoard(true);
    lb.s = startState({ pos:'' });
    $('#ltitle').textContent = cur.st.name + ' · Set up the board';
    $('#ltask').textContent = 'Set up the chessboard for the start of a game.';
    $('#ltext').textContent = 'Place all 32 pieces where they begin. Remember: White is at the bottom, and each queen goes on her own color.';
    $('#ltray').innerHTML = ['w','b'].map(c => `<div class="trow">${['K','Q','R','B','N','P'].map(t => `<button data-p="${c+t}"><img alt="" src="${PIECE_IMG[c+t]}"></button>`).join('')}</div>`).join('') + '<div class="trow"><button class="era" data-p="x">Eraser</button></div>';
    lb.render(); paintDots();
  }
  const target = () => parse(START);
  function mismatches() {
    const t = target(), cur_ = lb.s.b, bad = [];
    for (let i = 0; i < 64; i++) if ((t[i] || null) !== (cur_[i] || null)) bad.push(i);
    return bad;
  }
  function setupClick(e) {
    if (!cur || cur.phase!=='setup' || cur.done) return;
    const q = lb.at(e); if (q==null) return;
    const b = lb.s.b.slice();
    if (trayPick && trayPick!=='x') b[q] = trayPick; else if (b[q]) b[q] = null;
    lb.s = { ...lb.s, b }; lb.hints.clear(); lb.hi.clear(); lb.render();
  }
  function checkSetup() {
    const bad = mismatches();
    if (!bad.length) return win(Math.max(1, 3 - cur.mistakes - (cur.hinted ? 1 : 0)));
    cur.mistakes++; Sound.play('bad');
    lb.hi = new Set(bad); lb.render();
    bar('bad', bad.length + (bad.length===1 ? ' square is' : ' squares are') + ' not right yet', 'Look at the red squares, or press Hint.', false);
    setTimeout(() => { if (cur && !cur.done) { lb.hi.clear(); lb.render(); $('#lbar').hidden = true; } }, 2200);
  }
  function setupHint() {
    const bad = mismatches(); if (!bad.length) return;
    const t = target(); let i = bad.find(x => t[x]) ; if (i===undefined) i = bad[0];
    cur.hinted = true; lb.hints = new Set([i]); lb.render();
    $('#ltext').textContent = t[i] ? `Put the ${t[i][0]==='w' ? 'white' : 'black'} ${NAMES[t[i][1]]} on ${nm(i)}.` : `Remove the piece on ${nm(i)}.`;
  }

  /* ----- practice lessons ----- */
  function bar(kind, msg, sub, showNext) {
    const b = $('#lbar'); b.hidden = false; b.className = 'lbar ' + kind;
    $('#lbmsg').textContent = msg; $('#lbsub').innerHTML = sub || ''; $('#lnext').hidden = !showNext;
  }
  function tip(t) { bar('bad', t, '', false); setTimeout(() => { if (!cur.done) $('#lbar').hidden = true; }, 1600); }
  function onMove(m) {
    if (!cur || cur.done || cur.busy || cur.phase!=='practice') return;
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
    cur.mistakes++; cur.busy = true; Sound.play('bad'); lb.play(m);
    const g = cur.st.goal, why = g==='stale' ? 'That is stalemate. It is a draw!' : g==='check' && cur.sc.only ? 'Use the bishop for this one.' : 'Not quite. Try again.';
    bar('bad', why, '', false);
    setTimeout(() => { if (cur.done) return; const mk = cur.mistakes, h = cur.hinted; setup(); cur.mistakes = mk; cur.hinted = h; }, 1300);
  }
  function win(force) {
    cur.done = true; Sound.play('good');
    let stars;
    if (force) stars = force;
    else if (cur.st.kind==='collect') stars = cur.moves <= cur.par ? 3 : cur.moves <= cur.par + 2 ? 2 : 1;
    else stars = Math.max(1, 3 - cur.mistakes);
    if (cur.hinted) stars = Math.min(stars, 2);
    const p = prog(); p[cur.sc.id] = Math.max(stars, p[cur.sc.id] || 0); Store.set('learn', p, true);
    const last = cur.i === cur.st.sc.length - 1;
    bar('good', ['Good job!', 'Nicely done!', 'Perfect!'][stars-1], `<span class="bigstars">${starsStr(stars)}</span>`, true);
    $('#lnext').textContent = last ? 'Finish stage' : 'Continue';
    paintDots();
  }
  function bestMove() {
    const sc = cur.sc, st = cur.st;
    if (st.kind==='collect') { const p = bfs(lb.s.b, cur.me, lb.stars); return p && p[0]; }
    if (sc.steps) { const k = sc.steps[cur.step].ok[0]; return { from:sq(k.slice(0,2)), to:sq(k.slice(2,4)) }; }
    return Chess.legal(lb.s, 'w', true).find(m => judge(st.goal, sc, lb.s, m, Chess.apply(lb.s, m))) || null;
  }
  function hint() {
    if (!cur || cur.done || cur.busy) return;
    if (cur.phase==='setup') return setupHint();
    const m = bestMove(); if (!m) return;
    cur.hinted = true;
    if (cur.hint===0) { lb.hints = new Set([m.from]); cur.hint = 1; }
    else { lb.hints = new Set([m.from, m.to]); lb.hintArrow = [m.from, m.to]; cur.hint = 2; }
    lb.render();
  }
  function next() {
    const st = cur.st;
    if (cur.i + 1 < st.sc.length) { cur.i++; cur.sc = st.sc[cur.i]; cur.mistakes = 0; cur.hinted = false; cur.moves = 0; openTab('lesson', false, cur.sc.id); setup(); }
    else { const id = st.id, tab = st.tab; cur = null; openTab('learn', false, tab); render(); const sec = document.querySelector(`.unit[data-id="${id}"]`); if (sec) sec.scrollIntoView({ behavior:'smooth', block:'start' }); celebrate(id); }
  }

  function init() {
    $$('.path').forEach(el => { el.onclick = e => { const b = e.target.closest('.node'); if (b) open(+b.dataset.s, +b.dataset.i); }; });
    $('#learn-left').onclick = e => { const b = e.target.closest('[data-go]'); if (b) { const [si, i] = b.dataset.go.split(',').map(Number); open(si, i); } };
    $('#lhint').onclick = hint;
    $('#lreset').onclick = () => { if (!cur || cur.done) return; if (cur.phase==='setup') { lb.s = startState({ pos:'' }); lb.hints.clear(); lb.hi.clear(); lb.render(); } else { cur.moves = 0; const mk = cur.mistakes, h = cur.hinted; setup(); cur.mistakes = mk; cur.hinted = h; } };
    $('#lnext').onclick = next;
    $('#lprev').onclick = () => { if (cur && cur.page > 0) { cur.page--; paintPage(); } };
    $('#lnextpg').onclick = nextPage;
    $('#lcheck').onclick = checkSetup;
    $('#ltray').onclick = e => { const b = e.target.closest('button'); if (!b) return; trayPick = b.dataset.p; $$('#ltray button').forEach(x => x.classList.toggle('on', x===b)); };
    document.getElementById('lboard').parentElement.addEventListener('pointerdown', e => { if (e.target.closest('#lboard')) setupClick(e); });
    $('#lback').onclick = () => { const tab = cur ? cur.st.tab : 'moves'; cur = null; openTab('learn', false, tab); render(); };
    render();
  }
  return { init, render, openById, clearCelebration, S, _t: { parse, judge, startState, bfs, sq, nm, pinned, START } };
})();
