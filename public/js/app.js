const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const mkWorker = () => new Worker('js/engine-worker.js?v=6');

/* ---------- Tabs ---------- */
const TITLES = { home:'Home', play:'Play', bots:'Bots', analysis:'Analysis', customize:'Board', learn:'Learn', about:'About', game:'Game' };
function openTab(n) {
  $$('.tab-content').forEach(e => e.classList.toggle('active', e.id===n));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===n));
  $('#pagetitle').textContent = TITLES[n] || '';
  window.scrollTo(0,0);
}
$$('[data-tab]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openTab(b.dataset.tab); }));

const hb = new Board($('#hboard'), { mode:'both', onMove(){} }); hb.active = false;

/* ---------- Board customization ---------- */
const T0 = { '--sq-l':'#e9d6ae', '--sq-d':'#a6805c', '--c-last':'#cdd26a', '--c-sel':'#ffeb3b', '--c-hi':'#eb6150', '--c-arrow':'#f97316', '--c-pre':'#2563eb', '--c-dot':'#ffffff' };
const THEME_LABELS = [['--sq-l','Light squares'],['--sq-d','Dark squares'],['--c-last','Last move'],['--c-sel','Selected piece'],['--c-hi','Highlight'],['--c-arrow','Arrows'],['--c-pre','Premoves'],['--c-dot','Move dots']];
const PRESETS = {
  Classic:{}, Ice:{'--sq-l':'#dbe9f4','--sq-d':'#6b8ba8','--c-last':'#9bd1f5'}, Green:{'--sq-l':'#eeeed2','--sq-d':'#769656'},
  Slate:{'--sq-l':'#c9ced6','--sq-d':'#5d6b7e'}, Midnight:{'--sq-l':'#8ea2c0','--sq-d':'#2b3a55'}, Walnut:{'--sq-l':'#d9b98a','--sq-d':'#7a4a2b'}
};
let theme = { ...T0 };
try { Object.assign(theme, JSON.parse(localStorage.getItem('hc_theme') || '{}')); } catch (e) {}
const applyTheme = () => { for (const k in theme) document.documentElement.style.setProperty(k, theme[k]); };
const saveTheme = () => { try { localStorage.setItem('hc_theme', JSON.stringify(theme)); } catch (e) {} };
applyTheme();
$('#themeform').innerHTML = THEME_LABELS.map(([k,n]) => `<label>${n}<input type="color" data-v="${k}" value="${theme[k]}"></label>`).join('');
$('#themeform').oninput = e => { const k = e.target.dataset.v; if (!k) return; theme[k] = e.target.value; applyTheme(); saveTheme(); };
$('#presets').innerHTML = Object.keys(PRESETS).map(n => `<button class="tile" data-p="${n}"><b>${n}</b></button>`).join('');
const syncInputs = () => $$('#themeform input').forEach(i => i.value = theme[i.dataset.v]);
$('#presets').onclick = e => { const b = e.target.closest('.tile'); if (!b) return; theme = { ...T0, ...PRESETS[b.dataset.p] }; applyTheme(); saveTheme(); syncInputs(); };
$('#themereset').onclick = () => { theme = { ...T0 }; applyTheme(); saveTheme(); syncInputs(); };
const cb = new Board($('#cboard'), { mode:'both', onMove: m => cb.play(m) });

/* ---------- Analysis (with evaluation bar) ---------- */
const hist = [];
const abd = new Board($('#aboard'), { mode:'both', onMove: m => { hist.push({ s:abd.s, last:abd.last }); abd.play(m); note(); barEval(); } });
const wpc = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
let barW = null, barTok = 0;
function note() {
  const st = Chess.status(abd.s);
  $('#anote').textContent = st ? st.text + (st.winner ? ' — ' + (st.winner==='w'?'White':'Black') + ' wins' : '') : (abd.s.turn==='w'?'White':'Black') + ' to move';
}
function setBar(cp) {
  const pct = wpc(cp), mate = Math.abs(cp) > 90000, white = cp >= 0;
  $('#evalfill').style.height = pct + '%';
  $('#evaltxt').textContent = mate ? 'M' + Math.max(1, Math.ceil((100000 - Math.abs(cp)) / 2)) : (Math.abs(cp)/100).toFixed(1);
  $('#evaltxt').classList.toggle('top', !white);
  $('#evalpct').textContent = Math.round(pct) + '%';
  $('#evalbar').title = `White ${Math.round(pct)}% · Black ${100 - Math.round(pct)}%`;
}
function barEval() {
  const t = ++barTok, st = Chess.status(abd.s);
  if (st) return setBar(st.winner ? (st.winner==='w' ? 100000 : -100000) : 0);
  if (!barW) barW = mkWorker();
  barW.onmessage = e => { if (t!==barTok || !e.data) return; setBar(abd.s.turn==='w' ? e.data.cp : -e.data.cp); };
  barW.postMessage({ type:'eval', s:abd.s, d:4, t:500 });
}
$('#a-flip').onclick = () => abd.flipBoard();
$('#a-undo').onclick = () => { const h = hist.pop(); if (h) { abd.s=h.s; abd.last=h.last; abd.sel=null; abd.render(); note(); barEval(); } };
$('#a-reset').onclick = () => { hist.length=0; abd.s=Chess.start(); abd.last=null; abd.sel=null; abd.render(); note(); barEval(); };
note(); barEval();

/* ---------- Lobby ---------- */
const TCOPTS = [[1,0],[2,0],[2,1],[3,0],[3,2],[5,0],[10,10],[15,0]];
let tc = { m:10, i:10 }, lobbyMode = 'human', openGames = [];
$('#tcbar').innerHTML = TCOPTS.map(([m,i]) => `<button data-m="${m}" data-i="${i}" class="${m===10&&i===10?'sel':''}"><b>${m}</b><small>${i ? '+'+i : 'min'}</small></button>`).join('');
$('#tcbar').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  tc = { m:+b.dataset.m, i:+b.dataset.i };
  $$('#tcbar button').forEach(x => x.classList.toggle('sel', x===b));
};
const HINTS = {
  human:'Pairs you with the next player on the same time control, or lists your game in the lobby until someone joins. Click any open game above to join it.',
  ai:'Play against a bot. Pick a strength and press Start.',
  friend:'Creates a private game and gives you a 6-digit code to share. Already have a code? Enter it and press Join.'
};
$('#modehint').textContent = HINTS.human;
$('#modes').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  lobbyMode = b.dataset.mode;
  $$('#modes button').forEach(x => x.classList.toggle('on', x===b));
  $('#tcbar').hidden = lobbyMode==='ai'; $('#airow').hidden = lobbyMode!=='ai'; $('#friendrow').hidden = lobbyMode!=='friend';
  $('#modehint').textContent = HINTS[lobbyMode];
};
const LEVELS = [200,400,600,800,1000,1200,1500,1800,2000,2300,2500,2700,3000,3200];
$('#ailv').innerHTML = LEVELS.map(l => `<option value="${l}"${l===1000?' selected':''}>Bot ${l}</option>`).join('');

const card = g => `<button class="oc" data-join="${g.code}"><i class="av">${g.name[0]}</i><span class="nm">${g.name}</span><span class="ttc">${g.tc.i ? g.tc.m+'+'+g.tc.i : g.tc.m+'<small>min</small>'}</span></button>`;
function renderCols(list) {
  const by = { Bullet:[], Blitz:[], Rapid:[], Classic:[], Daily:[] };
  list.forEach(g => by[g.tc.m<=2 ? 'Bullet' : g.tc.m<10 ? 'Blitz' : g.tc.m<30 ? 'Rapid' : 'Classic'].push(g));
  by['Smart picks'] = list.slice(-2).reverse();
  $('#cols').innerHTML = ['Bullet','Blitz','Rapid','Classic','Daily','Smart picks'].map(n =>
    `<div class="col"><h3>${n}</h3>${[0,1,2,3,4].map(i => by[n][i] ? card(by[n][i]) : '<div class="slot"></div>').join('')}</div>`).join('');
}
renderCols([]);
$('#cols').onclick = e => { const b = e.target.closest('[data-join]'); if (b) connect(() => send({ t:'join', code:b.dataset.join })); };
const showPlay = id => ['plobby','pwait'].forEach(v => $('#'+v).hidden = v!==id);
const msg = t => { $('#pmsg').textContent = t; };

/* ---------- Network ---------- */
let ws = null;
const send = o => ws && ws.readyState===1 && ws.send(JSON.stringify(o));
function connect(cb2) {
  if (ws && ws.readyState===1) return cb2();
  if (!location.host) return msg('Run the server (npm start) and open http://localhost:3000 to play online.');
  ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host);
  ws.onopen = cb2;
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => { msg('Disconnected from server. Refresh the page to reconnect.'); };
}
// show live games as soon as the lobby is visible
$$('[data-tab="play"]').forEach(b => b.addEventListener('click', () => connect(() => {})));

function handle(m) {
  if (m.t==='list') { openGames = m.games; renderCols(m.games); }
  else if (m.t==='created') {
    $('#wtitle').textContent = m.priv ? 'Private game created' : 'Waiting for an opponent…';
    $('#wcode').hidden = !m.priv; $('#wcodebox').textContent = m.code;
    $('#wtc').textContent = `Time control ${m.tc.m}+${m.tc.i}`;
    showPlay('pwait');
  } else if (m.t==='start') startGame({ mode:'online', color:m.color, tc:m.tc, opp:m.opp, you:m.you });
  else if (m.t==='move') oppMove(m.m);
  else if (m.t==='resign') finish('win', 'Opponent resigned');
  else if (m.t==='timeout') finish('win', 'Opponent ran out of time');
  else if (m.t==='end') { if (pb && !over) finish('win', m.reason); else if (!pb) { showPlay('plobby'); msg(m.reason); } }
  else if (m.t==='err') msg(m.msg);
}

$('#startgame').onclick = () => {
  msg('');
  if (lobbyMode==='ai') return startGame({ mode:'bot', lv:+$('#ailv').value, color: Math.random()<.5 ? 'w' : 'b' });
  connect(() => lobbyMode==='friend' ? send({ t:'create', priv:true, tc }) : send({ t:'quick', tc }));
};
$('#codein').oninput = e => e.target.value = e.target.value.replace(/\D/g,'').slice(0,6);
$('#codego').onclick = () => { const c = $('#codein').value.trim(); if (!/^\d{6}$/.test(c)) return msg('Enter a 6-digit code.'); connect(() => send({ t:'join', code:c })); };
$('#wcancel').onclick = () => { send({ t:'leave' }); showPlay('plobby'); };

/* ---------- Bots ---------- */
const BOTS = [['Beginner',[200,400,600,800]], ['Intermediate',[1000,1200,1500,1800]], ['Advanced',[2000,2300,2500]], ['Master',[2700,3000,3200]]];
let botLv = 1000, botColor = 'r', lastBot = null;
$('#botgrid').innerHTML = BOTS.map(([g,ls]) => `<div class="label">${g}</div><div class="tiles">${ls.map(l =>
  `<button class="tile${l===botLv?' sel':''}" data-lv="${l}"><b>${l}</b><span>Bot</span></button>`).join('')}</div>`).join('');
$('#botgrid').onclick = e => { const b = e.target.closest('.tile'); if (!b) return; botLv = +b.dataset.lv; $$('#botgrid .tile').forEach(x => x.classList.toggle('sel', x===b)); };
$('#botcolor').onclick = e => { const b = e.target.closest('button'); if (!b) return; botColor = b.dataset.bc; $$('#botcolor button').forEach(x => x.classList.toggle('sel', x===b)); };
$('#bot-play').onclick = () => startGame({ mode:'bot', lv:botLv, color: botColor==='r' ? (Math.random()<.5?'w':'b') : botColor });

/* ---------- Game (online + bot) ---------- */
let pb = null, mode = null, origin = 'play', over = false, clk = null, timer = null, token = 0, worker = null, revW = null, botLv_ = 1000, lastSec = -1, gh = [], eid = 0;
const oppColor = () => pb.color==='w' ? 'b' : 'w';
const fmt = ms => { ms = Math.max(0, ms); const s = Math.floor(ms/1000); return ms < 10000 ? (ms/1000).toFixed(1) : Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };

// material points shown next to each player, like chess.com (captured pieces + lead)
const START_CNT = { P:8, N:2, B:2, R:2, Q:1 }, VAL = { P:1, N:3, B:3, R:5, Q:9 };
function capHTML(by, s) {
  const op = by==='w' ? 'b' : 'w', cnt = { w:{P:0,N:0,B:0,R:0,Q:0}, b:{P:0,N:0,B:0,R:0,Q:0} }, pts = { w:0, b:0 };
  for (const p of s.b) if (p && p[1]!=='K') { cnt[p[0]][p[1]]++; pts[p[0]] += VAL[p[1]]; }
  let h = '';
  for (const t of ['P','N','B','R','Q']) {
    const miss = Math.max(0, START_CNT[t] - cnt[op][t]); if (!miss) continue;
    h += '<span>' + `<img alt="" src="${PIECE_IMG[op+t]}">`.repeat(miss) + '</span>';
  }
  const d = pts[by] - pts[op];
  return h + (d>0 ? `<b>+${d}</b>` : '');
}

function startGame(o) {
  token++; over = false; mode = o.mode; origin = o.mode==='bot' ? 'bots' : 'play'; lastBot = o.mode==='bot' ? o : null; gh = []; botLv_ = o.lv;
  msg(''); $('#endm').hidden = true; openTab('game');
  pb = new Board($('#gboard'), { mode:'online', color:o.color, onMove:userMove });
  const oppName = o.mode==='bot' ? `Bot ${o.lv}` : (o.opp || 'Opponent'), meName = o.you || 'You';
  $('#gme').textContent = 'You are ' + (o.color==='w' ? 'White' : 'Black');
  $('#mename').textContent = meName; $('#oppname').textContent = oppName;
  $('#meav').textContent = meName[0]; $('#oppav').textContent = o.mode==='bot' ? 'B' : oppName[0];
  clk = o.tc ? { t:{ w:o.tc.m*60000, b:o.tc.m*60000 }, inc:o.tc.i, turn:'w', stamp:Date.now() } : null;
  $('#meclock').textContent = $('#oppclock').textContent = clk ? fmt(clk.t.w) : '';
  $('#meclock').style.display = $('#oppclock').style.display = clk ? '' : 'none';
  clearInterval(timer); timer = setInterval(tick, 200);
  $('#gresign').hidden = false; $('#gagain').hidden = true;
  Sound.play('start'); after();
  if (mode==='bot' && o.color==='b') botTurn();
}

function tick() {
  if (!clk || over || !pb) return;
  const el = Date.now() - clk.stamp, me = pb.color, op = oppColor();
  const tm = clk.t[me] - (clk.turn===me ? el : 0), to = clk.t[op] - (clk.turn===op ? el : 0);
  $('#meclock').textContent = fmt(tm); $('#oppclock').textContent = fmt(to);
  $('#meclock').classList.toggle('on', clk.turn===me); $('#oppclock').classList.toggle('on', clk.turn===op);
  const sec = Math.ceil(tm/1000);
  if (clk.turn===me && tm>0 && tm<10000 && sec!==lastSec) { lastSec = sec; Sound.play('tick'); }
  if (clk.turn===me && tm<=0) { send({ t:'timeout' }); finish('loss', 'You ran out of time'); }
}
function clockSwitch() {
  if (!clk) return;
  const now = Date.now();
  clk.t[clk.turn] = clk.t[clk.turn] - (now - clk.stamp) + clk.inc*1000;
  clk.turn = clk.turn==='w' ? 'b' : 'w'; clk.stamp = now;
}

function userMove(m) {
  gh.push({ s:pb.s, m, c:pb.color });
  if (mode==='online') send({ t:'move', m });
  pb.play(m); clockSwitch(); after();
  if (!over && mode==='bot') botTurn();
}
function oppMove(m) {
  if (!pb || over) return;
  gh.push({ s:pb.s, m, c:oppColor() });
  pb.play(m); clockSwitch(); after();
  if (over) return;
  const pm = pb.tryPre();
  if (pm) { pb.skipAnim = true; userMove(pm); } else pb.render();
}
function botTurn() {
  const t = token, t0 = Date.now(), target = 1000 + Math.random() * 2000;   // bots answer after 1-3 seconds
  if (!worker) worker = mkWorker();
  worker.onmessage = e => {
    if (t!==token || over || !e.data) return;
    setTimeout(() => { if (t===token && !over) oppMove(e.data); }, Math.max(0, target - (Date.now() - t0)));
  };
  worker.postMessage({ s:pb.s, level:botLv_ });
}

function after() {
  $('#mecap').innerHTML = capHTML(pb.color, pb.s); $('#oppcap').innerHTML = capHTML(oppColor(), pb.s);
  const st = Chess.status(pb.s);
  if (st) return finish(st.winner ? (st.winner===pb.color ? 'win' : 'loss') : 'draw', st.text);
  $('#gturn').textContent = pb.s.turn===pb.color ? 'Your move' : (mode==='bot' ? 'Bot is thinking…' : "Opponent's move") + (pb.pre.length ? ` (${pb.pre.length} premove${pb.pre.length>1?'s':''})` : '');
}

/* ---------- End of game ---------- */
function finish(res, reason) {
  if (over) return; over = true;
  if (pb) { pb.active = false; pb.pre = []; pb.render(); }
  $('#gturn').textContent = { win:'You won', loss:'You lost', draw:'Draw' }[res] + ' — ' + reason;
  $('#gresign').hidden = true; $('#gagain').hidden = mode!=='bot';
  showEnd(res, reason);
}
function showEnd(res, reason) {
  const tk = token, me = pb.color, op = oppColor(), mk = pb.s.b.indexOf(me+'K'), ok = pb.s.b.indexOf(op+'K');
  const lose = reason==='Checkmate' ? 'hash' : 'flag';
  pb.badges = {}; pb.fall = {};
  if (res==='win') { pb.badges[mk] = 'crown'; pb.badges[ok] = lose; pb.fall[ok] = 1; }
  else if (res==='loss') { pb.badges[ok] = 'crown'; pb.badges[mk] = lose; pb.fall[mk] = 1; }
  else pb.badges[mk] = pb.badges[ok] = 'eq';
  pb.render(); Sound.play(res);

  $('#endcard').className = 'endcard ' + res;
  $('#endtitle').textContent = { win:'You won!', loss:'You lost', draw:'Draw' }[res];
  $('#endsub').textContent = reason;
  $('#arc').style.strokeDashoffset = 226.2; $('#rnum').textContent = '--';
  $('#rlabel').textContent = 'Analysing your game…'; $('#rmeta').innerHTML = '';
  $('#confetti').innerHTML = '';
  setTimeout(() => {
    if (tk!==token) return;
    $('#endm').hidden = false;
    if (res==='win') confetti();
    review(tk);
  }, 900);
}
// falling chess pieces as confetti (the HayChess touch)
function confetti() {
  const keys = Object.keys(PIECE_IMG);
  $('#confetti').innerHTML = Array.from({ length:34 }, () => {
    const k = keys[(Math.random()*keys.length)|0], dur = 2.2 + Math.random()*2.2;
    return `<img alt="" src="${PIECE_IMG[k]}" style="left:${Math.random()*92}%;animation-duration:${dur}s;animation-delay:${Math.random()*.9}s;--rot:${(Math.random()*720-360)|0}deg">`;
  }).join('');
}
function evalAsync(w, s) {
  return new Promise(res => {
    const id = ++eid, h = e => { if (e.data && e.data.id===id) { w.removeEventListener('message', h); res(e.data.cp); } };
    w.addEventListener('message', h); w.postMessage({ type:'eval', id, s, d:3, t:110 });
  });
}
function setRating(n, label, meta) {
  $('#rlabel').textContent = label; $('#rmeta').innerHTML = meta || '';
  if (n==null) return;
  $('#arc').style.strokeDashoffset = 226.2 * (1 - n/100);
  const t0 = performance.now();
  (function step(t) { const k = Math.min(1, (t - t0) / 1200); $('#rnum').textContent = Math.round(n*k); if (k<1) requestAnimationFrame(step); })(t0);
}
// rate how well each side played (1-100) from win-chance lost on each move
async function review(tk) {
  if (gh.length < 2) return setRating(null, 'Game too short to analyse');
  const positions = gh.map(h => h.s).concat([pb.s]), ev = [];
  revW = revW || mkWorker();
  for (let i=0; i<positions.length; i++) {
    if (tk!==token) return;
    ev.push(await evalAsync(revW, positions[i]));
    $('#rlabel').textContent = `Analysing your game… ${Math.round((i+1)/positions.length*100)}%`;
  }
  if (tk!==token) return;
  const acc = { w:[], b:[] }, c = { bl:0, mi:0, ia:0 };
  gh.forEach((h,i) => {
    const loss = Math.max(0, wpc(ev[i]) - wpc(-ev[i+1]));
    acc[h.c].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)));
    if (h.c===pb.color) { if (loss>20) c.bl++; else if (loss>10) c.mi++; else if (loss>5) c.ia++; }
  });
  const avg = a => a.length ? a.reduce((x,y) => x+y, 0) / a.length : 0, rate = a => Math.max(1, Math.min(100, Math.round(avg(a))));
  const mine = rate(acc[pb.color]), theirs = rate(acc[oppColor()]);
  const label = mine>=90 ? 'Outstanding' : mine>=75 ? 'Strong play' : mine>=60 ? 'Solid' : mine>=40 ? 'Shaky' : 'Rough game';
  setRating(mine, label, `You ${mine} · Opponent ${theirs}<br>${c.bl} blunder${c.bl===1?'':'s'} · ${c.mi} mistake${c.mi===1?'':'s'} · ${c.ia} inaccurac${c.ia===1?'y':'ies'}`);
}

function leaveGame() {
  if (mode==='online') send({ t:'leave' });
  token++; over = true; clearInterval(timer); pb = null;
  $('#endm').hidden = true; showPlay('plobby'); openTab(origin);
}
$('#gresign').onclick = () => { if (mode==='online') send({ t:'resign' }); finish('loss', 'You resigned'); };
$('#gleave').onclick = leaveGame;
const newBot = () => lastBot && startGame({ mode:'bot', lv:lastBot.lv, color: Math.random()<.5 ? 'w' : 'b' });
$('#gagain').onclick = newBot;
$('#endnew').onclick = () => mode==='bot' ? newBot() : leaveGame();
$('#endx').onclick = () => { $('#endm').hidden = true; };
$('#endan').onclick = () => {
  if (!pb) return;
  hist.length = 0; gh.forEach((h,i) => hist.push({ s:h.s, last: i ? gh[i-1].m : null }));
  abd.s = pb.s; abd.last = gh.length ? gh[gh.length-1].m : null; abd.flip = pb.color==='b'; abd.sel = null; abd.render();
  note(); barEval(); $('#endm').hidden = true; openTab('analysis');
};
