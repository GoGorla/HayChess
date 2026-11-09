const $ = s => document.querySelector(s);

/* ---------- Tabs ---------- */
function openTab(n) {
  document.querySelectorAll('.tab-content').forEach(e => e.classList.toggle('active', e.id===n));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===n));
  window.scrollTo(0,0);
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openTab(b.dataset.tab); }));

/* ---------- Analysis board ---------- */
const abd = new Board($('#aboard'), { mode:'both', onMove: m => { hist.push({ s:abd.s, last:abd.last }); abd.play(m); note(); } });
const hist = [];
function note() {
  const st = Chess.status(abd.s);
  $('#anote').textContent = st ? `${st.text}${st.winner ? ' — ' + (st.winner==='w'?'White':'Black') + ' wins' : ''}` : (abd.s.turn==='w'?'White':'Black') + ' to move';
}
$('#a-flip').onclick = () => abd.flipBoard();
$('#a-undo').onclick = () => { const h = hist.pop(); if (h) { abd.s=h.s; abd.last=h.last; abd.sel=null; abd.render(); note(); } };
$('#a-reset').onclick = () => { hist.length=0; abd.s=Chess.start(); abd.last=null; abd.sel=null; abd.render(); note(); };
$('#a-clear').onclick = () => { abd.hi.clear(); abd.arrows=[]; abd.render(); };
note();

/* ---------- Online play ---------- */
let ws = null, pb = null;
const views = ['pm','pj','pc','pw','pg'];
const show = id => views.forEach(v => $('#'+v).hidden = v!==id);
const send = o => ws.send(JSON.stringify(o));
const msg = t => { $('#pmsg').textContent = t; };

function connect(cb) {
  if (ws && ws.readyState===1) return cb();
  if (!location.host) return msg('Run the server (npm start) and open http://localhost:3000 to play online.');
  ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host);
  ws.onopen = cb;
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => { msg('Disconnected from server.'); show('pm'); };
}

function handle(m) {
  if (m.t==='list') {
    $('#publist').innerHTML = m.games.length
      ? m.games.map(g => `<button class="btn small" data-join="${g.code}">Open game #${g.code} — Join</button>`).join('')
      : '<p class="muted">No public matches right now. Create one!</p>';
  } else if (m.t==='created') {
    $('#wtitle').textContent = m.priv ? 'Private match created' : 'Waiting for an opponent…';
    $('#wcode').hidden = !m.priv; $('#wcodebox').textContent = m.code;
    show('pw');
  } else if (m.t==='start') startGame(m.color);
  else if (m.t==='move') {
    pb.play(m.m); after();
    if (pb.active) { const pm = pb.tryPre(); if (pm) { send({ t:'move', m:pm }); pb.play(pm); after(); } else pb.render(); }
  } else if (m.t==='resign') finish('Opponent resigned — you win!');
  else if (m.t==='end') finish(m.reason);
  else if (m.t==='err') msg(m.msg);
}

function startGame(color) {
  msg(''); show('pg');
  pb = new Board($('#pboard'), { mode:'online', color, onMove: m => { send({ t:'move', m }); pb.play(m); after(); } });
  $('#pme').textContent = 'You are ' + (color==='w' ? 'White' : 'Black');
  $('#presign').hidden = false; after();
}
function after() {
  const st = Chess.status(pb.s);
  if (st) return finish(st.winner ? `${st.text} — ${st.winner===pb.color ? 'you win!' : 'you lose.'}` : st.text);
  $('#pturn').textContent = pb.s.turn===pb.color ? 'Your move' : "Opponent's move" + (pb.pre ? ' (premove set)' : '');
}
function finish(t) { if (pb) { pb.active = false; pb.pre = null; pb.render(); } $('#pturn').textContent = t; $('#presign').hidden = true; }
function menu() { if (ws && ws.readyState===1) send({ t:'leave' }); pb = null; msg(''); show('pm'); }

$('#btn-join').onclick = () => connect(() => show('pj'));
$('#btn-create').onclick = () => show('pc');
$('#opt-public').onclick = () => connect(() => send({ t:'create', priv:false }));
$('#opt-private').onclick = () => connect(() => send({ t:'create', priv:true }));
$('#publist').onclick = e => { const c = e.target.dataset.join; if (c) send({ t:'join', code:c }); };
$('#codego').onclick = () => { const c = $('#codein').value.trim(); if (!/^\d{6}$/.test(c)) return msg('Enter a 6-digit code.'); send({ t:'join', code:c }); };
$('#codein').oninput = e => e.target.value = e.target.value.replace(/\D/g,'').slice(0,6);
$('#presign').onclick = () => { send({ t:'resign' }); finish('You resigned.'); };
document.querySelectorAll('.back').forEach(b => b.onclick = menu);
