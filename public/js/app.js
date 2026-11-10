const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

/* ---------- Tabs ---------- */
function openTab(n) {
  $$('.tab-content').forEach(e => e.classList.toggle('active', e.id===n));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===n));
  window.scrollTo(0,0);
}
$$('[data-tab]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openTab(b.dataset.tab); }));

/* Decorative boards (home + lobby preview) */
[$('#hboard'), $('#vboard')].forEach(el => { const b = new Board(el, { mode:'both', onMove(){} }); b.active = false; });

/* ---------- Analysis ---------- */
const hist = [];
const abd = new Board($('#aboard'), { mode:'both', onMove: m => { hist.push({ s:abd.s, last:abd.last }); abd.play(m); note(); } });
function note() {
  const st = Chess.status(abd.s);
  $('#anote').textContent = st ? st.text + (st.winner ? ' — ' + (st.winner==='w'?'White':'Black') + ' wins' : '') : (abd.s.turn==='w'?'White':'Black') + ' to move';
}
$('#a-flip').onclick = () => abd.flipBoard();
$('#a-undo').onclick = () => { const h = hist.pop(); if (h) { abd.s=h.s; abd.last=h.last; abd.sel=null; abd.render(); note(); } };
$('#a-reset').onclick = () => { hist.length=0; abd.s=Chess.start(); abd.last=null; abd.sel=null; abd.render(); note(); };
note();

/* ---------- Lobby UI ---------- */
const TCS = [['Bullet',[[1,0],[2,1]]], ['Blitz',[[3,0],[3,2],[5,0]]], ['Rapid',[[10,0],[15,10],[30,0]]]];
let tc = { m:10, i:0 };
$('#tcgrid').innerHTML = TCS.map(([n,l]) => `<div class="tcrow"><span class="tcname">${n}</span>${l.map(([m,i]) =>
  `<button class="tile tc${m===10&&i===0?' sel':''}" data-m="${m}" data-i="${i}">${m}+${i}</button>`).join('')}</div>`).join('');
$('#tcgrid').onclick = e => {
  const b = e.target.closest('.tc'); if (!b) return;
  tc = { m:+b.dataset.m, i:+b.dataset.i };
  $$('.tc').forEach(x => x.classList.toggle('sel', x===b));
};
$$('.stab').forEach(b => b.onclick = () => {
  $$('.stab').forEach(x => x.classList.toggle('active', x===b));
  $$('.sub').forEach(s => s.hidden = s.id!==b.dataset.sub);
});
const showPlay = id => ['plobby','pwait'].forEach(v => $('#'+v).hidden = v!==id);
const msg = t => { $('#pmsg').textContent = t; };

/* ---------- Network ---------- */
let ws = null;
const send = o => ws && ws.readyState===1 && ws.send(JSON.stringify(o));
function connect(cb) {
  if (ws && ws.readyState===1) return cb();
  if (!location.host) return msg('Run the server (npm start) and open http://localhost:3000 to play online.');
  ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host);
  ws.onopen = cb;
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => { msg('Disconnected from server. Refresh the page to reconnect.'); };
}

function handle(m) {
  if (m.t==='list') {
    $('#publist').innerHTML = '<div class="row head"><span>Player</span><span>Time</span><span></span></div>' + (m.games.length
      ? m.games.map(g => `<div class="row"><span>${g.name}</span><span>${g.tc.m}+${g.tc.i}</span><button data-join="${g.code}">Join</button></div>`).join('')
      : '<div class="empty">No open games right now.</div>');
  } else if (m.t==='created') {
    $('#wtitle').textContent = m.priv ? 'Private game created' : 'Waiting for an opponent…';
    $('#wcode').hidden = !m.priv; $('#wcodebox').textContent = m.code;
    $('#wtc').textContent = `Time control ${m.tc.m}+${m.tc.i}`;
    showPlay('pwait');
  } else if (m.t==='start') startGame({ mode:'online', color:m.color, tc:m.tc, opp:m.opp, you:m.you });
  else if (m.t==='move') oppMove(m.m);
  else if (m.t==='resign') finish('Opponent resigned. You win!');
  else if (m.t==='timeout') finish('Opponent ran out of time. You win!');
  else if (m.t==='end') { if (pb) finish(m.reason); else { showPlay('plobby'); msg(m.reason); } }
  else if (m.t==='err') msg(m.msg);
}

$('#q-play').onclick = () => connect(() => { msg(''); send({ t:'quick', tc }); });
$('#opt-public').onclick = () => connect(() => { msg(''); send({ t:'create', priv:false, tc }); });
$('#opt-private').onclick = () => connect(() => { msg(''); send({ t:'create', priv:true, tc }); });
$('#publist').onclick = e => { const c = e.target.dataset.join; if (c) connect(() => send({ t:'join', code:c })); };
$('#codego').onclick = () => { const c = $('#codein').value.trim(); if (!/^\d{6}$/.test(c)) return msg('Enter a 6-digit code.'); connect(() => send({ t:'join', code:c })); };
$('#codein').oninput = e => e.target.value = e.target.value.replace(/\D/g,'').slice(0,6);
$('#wcancel').onclick = () => { send({ t:'leave' }); showPlay('plobby'); };
// show the public list as soon as the Join tab is opened
$$('.stab').forEach(b => b.addEventListener('click', () => { if (b.dataset.sub==='s-join') connect(() => {}); }));

/* ---------- Bots UI ---------- */
const BOTS = [['Beginner',[200,400,600,800]], ['Intermediate',[1000,1200,1500,1800]], ['Advanced',[2000,2300,2500]], ['Master',[2700,3000,3200]]];
let botLv = 1000, botColor = 'r', lastBot = null;
$('#botgrid').innerHTML = BOTS.map(([g,ls]) => `<div class="label">${g}</div><div class="tiles">${ls.map(l =>
  `<button class="tile${l===botLv?' sel':''}" data-lv="${l}"><b>${l}</b><span>Bot</span></button>`).join('')}</div>`).join('');
$('#botgrid').onclick = e => {
  const b = e.target.closest('.tile'); if (!b) return;
  botLv = +b.dataset.lv; $$('#botgrid .tile').forEach(x => x.classList.toggle('sel', x===b));
};
$('#botcolor').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  botColor = b.dataset.bc; $$('#botcolor button').forEach(x => x.classList.toggle('sel', x===b));
};
$('#bot-play').onclick = () => startGame({ mode:'bot', lv:botLv, color: botColor==='r' ? (Math.random()<.5?'w':'b') : botColor });

/* ---------- Game (online + bot) ---------- */
let pb = null, mode = null, origin = 'play', over = false, clk = null, timer = null, token = 0, worker = null;
const fmt = ms => { ms = Math.max(0, ms); const s = Math.floor(ms/1000); return ms < 10000 ? (ms/1000).toFixed(1) : Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };

function startGame(o) {
  token++; over = false; mode = o.mode; origin = o.mode==='bot' ? 'bots' : 'play'; lastBot = o.mode==='bot' ? o : null;
  msg(''); openTab('game');
  pb = new Board($('#gboard'), { mode:'online', color:o.color, onMove:userMove });
  $('#gme').textContent = 'You are ' + (o.color==='w' ? 'White' : 'Black');
  $('#mename').textContent = o.you || 'You';
  $('#oppname').textContent = o.mode==='bot' ? `Bot ${o.lv}` : (o.opp || 'Opponent');
  clk = o.tc ? { t:{ w:o.tc.m*60000, b:o.tc.m*60000 }, inc:o.tc.i, turn:'w', stamp:Date.now() } : null;
  $('#meclock').textContent = $('#oppclock').textContent = clk ? fmt(clk.t.w) : '';
  $('#meclock').style.display = $('#oppclock').style.display = clk ? '' : 'none';
  clearInterval(timer); timer = setInterval(tick, 200);
  $('#gresign').hidden = false; $('#gagain').hidden = true;
  botLv_ = o.lv; Sound.play('start'); after();
  if (mode==='bot' && o.color==='b') botTurn();
}
let botLv_ = 1000;

let lastSec = -1;
function tick() {
  if (!clk || over || !pb) return;
  const el = Date.now() - clk.stamp, me = pb.color, op = me==='w' ? 'b' : 'w';
  const tm = clk.t[me] - (clk.turn===me ? el : 0), to = clk.t[op] - (clk.turn===op ? el : 0);
  $('#meclock').textContent = fmt(tm); $('#oppclock').textContent = fmt(to);
  $('#meclock').classList.toggle('on', clk.turn===me); $('#oppclock').classList.toggle('on', clk.turn===op);
  const sec = Math.ceil(tm/1000);
  if (clk.turn===me && tm>0 && tm<10000 && sec!==lastSec) { lastSec = sec; Sound.play('tick'); }
  if (clk.turn===me && tm<=0) { send({ t:'timeout' }); finish('You lost on time.'); }
}
function clockSwitch() {
  if (!clk) return;
  const now = Date.now();
  clk.t[clk.turn] = clk.t[clk.turn] - (now - clk.stamp) + clk.inc*1000;
  clk.turn = clk.turn==='w' ? 'b' : 'w'; clk.stamp = now;
}

function userMove(m) {
  if (mode==='online') send({ t:'move', m });
  pb.play(m); clockSwitch(); after();
  if (!over && mode==='bot') botTurn();
}
function oppMove(m) {
  if (!pb || over) return;
  pb.play(m); clockSwitch(); after();
  if (over) return;
  const pm = pb.tryPre();
  if (pm) userMove(pm); else pb.render();
}
function botTurn() {
  const t = token;
  if (!worker) worker = new Worker('js/engine-worker.js?v=5');
  worker.onmessage = e => { if (t!==token || over || !e.data) return; setTimeout(() => { if (t===token && !over) oppMove(e.data); }, 350); };
  worker.postMessage({ s:pb.s, level:botLv_ });
}

function after() {
  const st = Chess.status(pb.s);
  if (st) return finish(st.winner ? `${st.text}. ${st.winner===pb.color ? 'You win!' : 'You lose.'}` : st.text);
  $('#gturn').textContent = pb.s.turn===pb.color ? 'Your move' : (mode==='bot' ? 'Bot is thinking…' : "Opponent's move") + (pb.pre ? ' (premove set)' : '');
}
function finish(t) {
  if (!over) Sound.play('end');
  over = true;
  if (pb) { pb.active = false; pb.pre = null; pb.render(); }
  $('#gturn').textContent = t; $('#gresign').hidden = true; $('#gagain').hidden = mode!=='bot';
}
function leaveGame() {
  if (mode==='online') send({ t:'leave' });
  token++; over = true; clearInterval(timer); pb = null;
  showPlay('plobby'); openTab(origin);
}
$('#gresign').onclick = () => { if (mode==='online') send({ t:'resign' }); finish('You resigned.'); };
$('#gleave').onclick = leaveGame;
$('#gagain').onclick = () => lastBot && startGame({ mode:'bot', lv:lastBot.lv, color: Math.random()<.5 ? 'w' : 'b' });

/* ---------- Sound toggle ---------- */
const mute = $('#mute');
const drawMute = () => { mute.textContent = Sound.on ? 'Sound: On' : 'Sound: Off'; };
mute.onclick = () => { Sound.toggle(); drawMute(); };
drawMute();
