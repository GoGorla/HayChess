const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const nm = i => 'abcdefgh'[i&7] + (8-(i>>3));

/* ---------- Saved state (guests: this device; logged in: also the account) ---------- */
const Store = (() => {
  let d = {}, t = null;
  try { d = JSON.parse(localStorage.getItem('hc_state') || '{}'); } catch (e) {}
  try { const old = localStorage.getItem('hc_theme'); if (old && !d.theme) d.theme = JSON.parse(old); } catch (e) {}
  const persist = () => { try { localStorage.setItem('hc_state', JSON.stringify(d)); } catch (e) {} };
  return {
    get: (k, def) => d[k] !== undefined ? d[k] : def,
    set(k, v, now) { d[k] = v; persist(); clearTimeout(t); if (now) Auth.push(); else t = setTimeout(() => Auth.push(), 900); },
    all: () => d,
    replace(o) { d = o || {}; persist(); }
  };
})();

/* ---------- Toasts ---------- */
function toast(text, o = {}) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = (o.title ? `<b>${o.title}</b>` : '') + `<p>${text}</p>` + (o.actions ? '<div class="ta"></div>' : '');
  (o.actions || []).forEach(a => {
    const b = document.createElement('button'); b.className = 'btn' + (a.sec ? ' sec' : ''); b.textContent = a.label;
    b.onclick = () => { clearTimeout(tm); el.remove(); if (a.fn) a.fn(); }; el.querySelector('.ta').append(b);
  });
  $('#toasts').append(el);
  const tm = setTimeout(() => { el.remove(); if (o.onTimeout) o.onTimeout(); }, o.ms || (o.actions ? 20000 : 3200));
  return el;
}

/* ---------- Tabs, page addresses, current-game rule ---------- */
const TITLES = { home:'Home', play:'Play', bots:'Bots', local:'One computer', analysis:'Analysis', learn:'Learn', lesson:'Learn', settings:'Settings', game:'Game' };
const GAME_BLOCK = new Set(['play','bots','local','analysis']);
const SET_SUBS = ['board','account','updates','about'], LEARN_SUBS = ['moves','tactics','openings'];
let setSub = 'board', learnSub = 'moves';
let G = null;                                           // the game in progress, if any
const done = () => !G || G.over;
const pathFor = (n, sub) => n==='home' ? '/home' : n==='learn' ? '/learn/' + (sub || learnSub) : n==='settings' ? '/settings/' + (sub || setSub) : n==='lesson' ? '/lesson/' + (sub || '') : '/' + n;
function parsePath(p) {
  const a = p.replace(/^\/+|\/+$/g, '').split('/'), t = a[0] || 'home';
  if (t==='account') return { n:'settings', sub:'account' };
  if (['learn','settings','lesson'].includes(t)) return { n:t, sub:a[1] };
  return ['home','play','bots','local','analysis','game'].includes(t) ? { n:t } : { n:'home' };
}
function paintSubs() {
  SET_SUBS.forEach(s => { $('#set-' + s).hidden = s!==setSub; });
  $$('#setnav button').forEach(b => b.classList.toggle('on', b.dataset.set===setSub));
  LEARN_SUBS.forEach(s => { $('#learn-' + s).hidden = s!==learnSub; });
  $$('#learnnav button').forEach(b => b.classList.toggle('on', b.dataset.learn===learnSub));
}
function openTab(n, force, sub, opt = {}) {
  if (!force && !done() && GAME_BLOCK.has(n)) { toast('Finish your current game first.'); n = 'game'; sub = undefined; opt = { ...opt, replace:true }; }
  if (n==='game' && !G) n = 'home';
  if (n==='learn') { if (LEARN_SUBS.includes(sub)) learnSub = sub; sub = learnSub; }
  if (n==='settings') { if (SET_SUBS.includes(sub)) setSub = sub; sub = setSub; }
  $$('.tab-content').forEach(e => e.classList.toggle('active', e.id===n));
  const navKey = n==='lesson' ? 'learn' : n;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===navKey));
  paintSubs(); $('#pagetitle').textContent = TITLES[n] || '';
  if (n!=='learn') Learn.clearCelebration();
  const p = pathFor(n, sub);
  if (location.pathname!==p) { if (opt.nopush || opt.replace) history.replaceState({}, '', p); else history.pushState({}, '', p); }
  window.scrollTo(0, 0); updatePill();
}
function routeNow() {
  const r = parsePath(location.pathname);
  if (r.n==='lesson') return Learn.openById(r.sub);
  openTab(r.n, false, r.sub, { nopush:true });
}
window.addEventListener('popstate', routeNow);
$$('[data-tab]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openTab(b.dataset.tab, false, b.dataset.sub); }));
$('#setnav').onclick = e => { const b = e.target.closest('button'); if (b) openTab('settings', false, b.dataset.set); };
$('#learnnav').onclick = e => { const b = e.target.closest('button'); if (b) openTab('learn', false, b.dataset.learn); };
$('#logo').onclick = () => openTab('home');
$('#curgame').onclick = () => openTab('game', true);
function updatePill() {
  const p = $('#curgame'), show = !done() && !$('#game').classList.contains('active');
  p.hidden = !show; if (!show) return;
  $('#cgname').textContent = G.kind==='local' ? 'One-computer game' : 'vs ' + G.oppName;
  let t;
  if (clk) { const c = G.kind==='local' ? clk.turn : myColor, el = Date.now() - clk.stamp; t = fmt(clk.t[c] - (clk.turn===c ? el : 0)) + (G.kind==='local' ? ' · ' + (clk.turn==='w' ? 'White' : 'Black') : ' left'); }
  else t = G.kind==='local' ? (pb.s.turn==='w' ? 'White' : 'Black') + ' to move' : (pb.s.turn===myColor ? 'Your move' : 'Their move');
  $('#cgtime').textContent = t;
}

/* ---------- Board studio (colours, legal-move indicators, textures, themes) ---------- */
const T0 = { '--sq-l':'#e9d6ae', '--sq-d':'#a6805c', '--c-last':'#cdd26a', '--c-sel':'#ffeb3b', '--c-hi':'#eb6150', '--c-arrow':'#f97316', '--c-eng':'#3b82f6', '--c-pre':'#2563eb',
  '--c-dot':'#ffffff', '--o-dot':50, '--dot-size':18, '--p-w':'#ffffff', '--p-b':'#4a4a4a', '--radius':0, '--anim':170, dotStyle:'dot', tex:'none', coords:'on' };
const STUDIO = [
  ['Squares and pieces', [['--sq-l','Light squares','color'], ['--sq-d','Dark squares','color'], ['--p-w','White pieces','color'], ['--p-b','Black pieces','color']]],
  ['Highlights and arrows', [['--c-last','Last move','color'], ['--c-sel','Selected piece','color'], ['--c-hi','Highlight (right-click)','color'], ['--c-arrow','Arrows','color'], ['--c-eng','Best-move arrows','color'], ['--c-pre','Premoves','color']]],
  ['Legal-move indicators', [['--c-dot','Colour','color'], ['--o-dot','Opacity','range',0,100,'%'], ['--dot-size','Size','range',8,34,'%'], ['dotStyle','Style','select',['dot','ring','square']]]],
  ['Board look', [['tex','Texture','select',['none','gloss','grain','stripes','vignette']], ['coords','Coordinates','select',['on','off']], ['--radius','Corner radius','range',0,24,'px'], ['--anim','Piece animation','range',0,400,'ms']]]
];
const PRESETS = [
  ['Classic','#e9d6ae','#a6805c'], ['Ice','#dbe9f4','#6b8ba8','#9bd1f5'], ['Green','#eeeed2','#769656'], ['Slate','#c9ced6','#5d6b7e'],
  ['Midnight','#8ea2c0','#2b3a55',null,'#ffe9a8','#1f2d4d'], ['Walnut','#d9b98a','#7a4a2b'], ['Marble','#f0f0f0','#9aa3ad'], ['Coral','#ffe3d6','#e07a5f'],
  ['Lavender','#ece3f7','#8f7bc2'], ['Mint','#e3f5ec','#5fb08b'], ['Sand','#f4e9d0','#c9a66b'], ['Ocean','#cfe8f3','#2f7fa6'], ['Rose','#fbe3e8','#c46a85'],
  ['Charcoal','#b5b9c0','#3a3f47'], ['Royal','#e8ecf8','#3b4fa3'], ['Forest','#d8e6cf','#3f6b4a'], ['Sunset','#ffe0b8','#d9622b'], ['Mono','#ffffff','#8a8a8a'],
  ['Newspaper','#efe7d6','#7d7566'], ['Neon','#1e3a4f','#0d1b27','#00e5ff','#9ff3ff','#ff6ad5'], ['Candy','#ffeaf4','#ff9ec4'], ['Autumn','#f3dfc1','#b5651d'],
  ['Arctic','#f1f8fc','#7fb7d6'], ['Espresso','#cdb4a0','#4a3226'], ['Apricot','#ffe8c7','#e8893a']
];
let theme = { ...T0 };
const PIECE_ORIG = { ...PIECE_IMG };
const boards = () => [hb, cb, abd, pb].filter(Boolean);
const refreshBoards = () => boards().forEach(b => b.render());
const UNIT = { '--o-dot':'%', '--dot-size':'%', '--radius':'px' };
function applyTheme() {
  const r = document.documentElement;
  for (const k in theme) if (k.startsWith('--') && k!=='--anim') r.style.setProperty(k, theme[k] + (UNIT[k] || ''));
  r.dataset.dot = theme.dotStyle; r.dataset.tex = theme.tex; r.dataset.coords = theme.coords; Board.animMs = +theme['--anim'];
}
const saveTheme = () => { Store.set('theme', theme); $('#tcode').value = themeCode(); };
const themeCode = () => 'HC1:' + btoa(unescape(encodeURIComponent(JSON.stringify(theme))));
let recTok = 0;
function recolor() {                                   // re-tint the piece images (white and black sets)
  const tk = ++recTok, rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
  Promise.all(Object.keys(PIECE_ORIG).map(k => new Promise(res => {
    const key = k[0]==='w' ? '--p-w' : '--p-b', hex = String(theme[key]).toLowerCase();
    if (hex === T0[key]) return res([k, PIECE_ORIG[k]]);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), px = d.data, t = rgb(hex), white = k[0]==='w';
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i+3]) continue;
        const L = (px[i] + px[i+1] + px[i+2]) / 3; let a, sh;
        if (white) { a = Math.max(0, Math.min(1, (L - 70) / 80)); sh = Math.max(.55, Math.min(1, L / 245)); }
        else { if (L >= 130) continue; a = Math.max(0, Math.min(1, (L - 38) / 24)); sh = Math.max(.6, Math.min(1.3, L / 74)); }
        for (let j = 0; j < 3; j++) px[i+j] = px[i+j] * (1 - a) + Math.min(255, t[j] * sh) * a;
      }
      x.putImageData(d, 0, 0); res([k, c.toDataURL()]);
    };
    im.onerror = () => res([k, PIECE_ORIG[k]]); im.src = PIECE_ORIG[k];
  }))).then(r => { if (tk!==recTok) return; r.forEach(([k,u]) => { PIECE_IMG[k] = u; }); refreshBoards(); });
}
function buildStudio() {
  $('#studio').innerHTML = STUDIO.map(([title, items]) => `<div class="panel"><div class="label first">${title}</div>` + items.map(([k, label, type, a, b, u]) => {
    const v = theme[k];
    const ctl = type==='color' ? `<input type="color" data-k="${k}" value="${v}">`
      : type==='range' ? `<input type="range" data-k="${k}" min="${a}" max="${b}" value="${v}"><output data-o="${k}" data-u="${u}">${v}${u}</output>`
      : `<select data-k="${k}">${a.map(o => `<option${o===v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    return `<div class="ctl"><label>${label}</label>${ctl}</div>`;
  }).join('') + '</div>').join('');
}
const syncStudio = () => {
  $$('#studio [data-k]').forEach(i => { i.value = theme[i.dataset.k]; });
  $$('#studio output').forEach(o => { o.textContent = theme[o.dataset.o] + o.dataset.u; });
  $('#tcode').value = themeCode();
};
$('#studio').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  theme[k] = e.target.type==='range' ? +e.target.value : e.target.value;
  const o = $(`#studio output[data-o="${k}"]`); if (o) o.textContent = theme[k] + o.dataset.u;
  applyTheme(); saveTheme(); $('#presetsel').value = ''; if (k.startsWith('--p-')) recolor(); else refreshBoards();
});
$('#presetsel').innerHTML = '<option value="">Custom</option>' + PRESETS.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
$('#presetsel').onchange = e => {
  if (e.target.value==='') return;
  const [, l, d, last, pw, pb_] = PRESETS[+e.target.value];
  theme = { ...theme, '--sq-l':l, '--sq-d':d, '--c-last': last || T0['--c-last'], '--p-w': pw || T0['--p-w'], '--p-b': pb_ || T0['--p-b'] };
  applyTheme(); saveTheme(); syncStudio(); recolor();
};
const hex = (h, s, l) => { l /= 100; const a = s * Math.min(l, 1-l) / 100, f = n => { const k = (n + h/30) % 12, c = l - a * Math.max(-1, Math.min(k-3, 9-k, 1)); return Math.round(255*c).toString(16).padStart(2,'0'); }; return '#' + f(0) + f(8) + f(4); };
$('#rand').onclick = () => {
  const h = Math.floor(Math.random()*360);
  theme = { ...theme, '--sq-l':hex(h, 38, 86), '--sq-d':hex(h, 34, 42), '--c-last':hex((h+50)%360, 70, 62), '--c-sel':hex((h+110)%360, 80, 60) };
  applyTheme(); saveTheme(); syncStudio(); $('#presetsel').value = ''; refreshBoards();
};
$('#swap').onclick = () => { [theme['--sq-l'], theme['--sq-d']] = [theme['--sq-d'], theme['--sq-l']]; applyTheme(); saveTheme(); syncStudio(); $('#presetsel').value = ''; refreshBoards(); };
$('#themereset').onclick = () => { theme = { ...T0 }; applyTheme(); saveTheme(); syncStudio(); $('#presetsel').value = '0'; recolor(); };
function paintMyThemes() {
  const mt = Store.get('mythemes', {});
  $('#mythemes').innerHTML = Object.keys(mt).map(n => `<span class="chipx"><span class="sw"><i style="background:${mt[n]['--sq-l']}"></i><i style="background:${mt[n]['--sq-d']}"></i></span><button data-load="${n}">${n}</button><button class="del" data-del="${n}" aria-label="Delete">&times;</button></span>`).join('') || '<span class="muted small">No saved themes yet.</span>';
}
$('#mtsave').onclick = () => {
  const n = $('#mtname').value.trim().replace(/[<>&"]/g, ''); if (!n) return toast('Give your theme a name first.');
  const mt = Store.get('mythemes', {}); if (Object.keys(mt).length >= 10 && !mt[n]) return toast('You can keep up to 10 themes. Delete one first.');
  mt[n] = { ...theme }; Store.set('mythemes', mt); $('#mtname').value = ''; paintMyThemes(); toast('Theme saved.');
};
$('#mythemes').onclick = e => {
  const mt = Store.get('mythemes', {});
  if (e.target.dataset.load) { theme = { ...T0, ...mt[e.target.dataset.load] }; applyTheme(); saveTheme(); syncStudio(); recolor(); }
  else if (e.target.dataset.del) { delete mt[e.target.dataset.del]; Store.set('mythemes', mt); paintMyThemes(); }
};
$('#tcode').readOnly = false;
$('#tcopy').onclick = () => { $('#tcode').select(); try { navigator.clipboard.writeText($('#tcode').value); } catch (e) { document.execCommand('copy'); } toast('Theme code copied.'); };
$('#timport').onclick = () => {
  try {
    const t = $('#tcode').value.trim(); if (!t.startsWith('HC1:')) throw 0;
    const o = JSON.parse(decodeURIComponent(escape(atob(t.slice(4))))), n = {};
    Object.keys(T0).forEach(k => { if (o[k] !== undefined && typeof o[k] === typeof T0[k]) n[k] = o[k]; });
    theme = { ...T0, ...n }; applyTheme(); saveTheme(); syncStudio(); recolor(); toast('Theme imported.');
  } catch (e) { toast('That theme code is not valid.'); }
};

const hb = new Board($('#hboard'), { mode:'both', onMove(){} }); hb.active = false;
const cb = new Board($('#cboard'), { mode:'both', onMove: m => cb.play(m) });

/* ---------- Accounts ---------- */
const Auth = {
  token: (() => { try { return localStorage.getItem('hc_token'); } catch (e) { return null; } })(), user: null,
  async api(path, body, method = 'POST') {
    const r = await fetch(path, { method, headers:{ 'Content-Type':'application/json', ...(this.token ? { Authorization:'Bearer ' + this.token } : {}) }, body: method==='GET' ? undefined : JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  },
  async init() {
    if (!this.token) return paintAccount();
    try { this.user = await this.api('/api/me', null, 'GET'); this.adopt(this.user); } catch (e) { this.token = null; try { localStorage.removeItem('hc_token'); } catch (x) {} }
    paintAccount();
  },
  // merge saved account data with this device: Learn progress keeps the best stars from both
  adopt(u) {
    const sv = u.data || {};
    if (Object.keys(sv).length) {
      const learn = { ...(Store.all().learn || {}) };
      Object.entries(sv.learn || {}).forEach(([k, v]) => { learn[k] = Math.max(v, learn[k] || 0); });
      Store.replace({ ...sv, learn }); loadSettings();
    }
    this.push();
  },
  enter(res) {
    this.token = res.token; try { localStorage.setItem('hc_token', res.token); } catch (e) {}
    this.user = res.user; this.adopt(res.user); paintAccount(); wsAuth();
  },
  push() { if (this.token) this.api('/api/save', { data: Store.all() }).catch(() => {}); },
  async out() { try { await this.api('/api/logout'); } catch (e) {} this.token = null; this.user = null; try { localStorage.removeItem('hc_token'); } catch (e) {} paintAccount(); wsAuth(); }
};
function paintAccount() {
  const u = Auth.user;
  $('#acc-out').hidden = !!u; $('#acc-in').hidden = !u;
  $('#chiptxt').textContent = u ? u.username : 'Guest';
  if (u) { $('#accav').textContent = u.username[0].toUpperCase(); $('#accname').textContent = u.username; $('#accmail').textContent = u.email; $('#accsince').textContent = 'Member since ' + new Date(u.created).toLocaleDateString(); }
}
$('#authseg').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#authseg button').forEach(x => x.classList.toggle('sel', x===b));
  $('#f-signup').hidden = b.dataset.a!=='signup'; $('#f-login').hidden = b.dataset.a!=='login'; $('#auth-err').textContent = '';
};
const authErr = t => { $('#auth-err').textContent = t; };
$('#su-go').onclick = async () => {
  authErr('');
  const email = $('#su-email').value.trim(), username = $('#su-user').value.trim(), password = $('#su-pw').value, confirm = $('#su-pw2').value;
  if (!email || !username || !password) return authErr('Fill in every box.');
  if (password !== confirm) return authErr('Passwords do not match.');
  try { Auth.enter(await Auth.api('/api/signup', { email, username, password, confirm })); toast('Account created. Welcome, ' + username + '!'); } catch (e) { authErr(e.message); }
};
$('#li-go').onclick = async () => {
  authErr('');
  try { Auth.enter(await Auth.api('/api/login', { id:$('#li-id').value, password:$('#li-pw').value })); toast('Logged in.'); } catch (e) { authErr(e.message); }
};
$('#logout').onclick = () => Auth.out();

/* ---------- Move text, move quality ---------- */
const PN = { P:'Pawn', N:'Knight', B:'Bishop', R:'Rook', Q:'Queen', K:'King' }, VALS = { P:1, N:3, B:3, R:5, Q:9, K:0 };
function moveText(prev, m, next) {
  if (m.castle) return m.castle==='K' ? 'Castle short' : 'Castle long';
  const cap = prev.b[m.to] || m.ep, st = Chess.status(next);
  return PN[prev.b[m.from][1]] + ' ' + (cap ? 'takes ' : '') + nm(m.to) + (m.promo ? '=' + PN[m.promo] : '') + (st && st.winner ? '#' : Chess.inCheck(next) ? '+' : '');
}
const wpc = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
function isSac(prev, m, next) {                          // a piece offered for less than it is worth
  const v = VALS[prev.b[m.from][1]]; if (v < 3) return false;
  const c = prev.b[m.to] ? VALS[prev.b[m.to][1]] : 0, caps = Chess.legal(next).filter(x => x.to===m.to);
  let worst = 0;
  for (const x of caps) {
    const a = VALS[next.b[x.from][1]], defended = Chess.legal(Chess.apply(next, x)).some(y => y.to===m.to);
    worst = Math.max(worst, (v - c) - (defended ? a : 0));
  }
  return worst >= 3;
}
// the played move was the engine's best and the next-best line is much worse
const onlyMove = (top, m) => !!(top && top.length > 1 && top[0].from===m.from && top[0].to===m.to && top[0].cp - top[1].cp >= 150 && Math.abs(top[0].cp) < 90000);
function classify(loss, wpBefore, wpAfter, ply, sac, only) {
  if (sac && loss <= 2 && wpBefore < 92 && wpAfter >= 45) return 'brilliant';
  if (ply < 10 && loss <= 4) return 'book';
  if (loss <= 1.5) return (only || wpBefore < 40) ? 'great' : 'excellent';
  if (loss <= 5) return 'good';
  if (loss <= 10) return 'slip';
  if (loss <= 20) return 'error';
  return 'blunder';
}
function renderMoves(el, list, ix, clickable) {
  const cell = (x, i) => `<span class="m${i===ix ? ' on' : ''}"${clickable ? ` data-i="${i}"` : ''}>${x.cls ? `<span class="mi ${x.cls}">${BADGE[x.cls]}</span>` : ''}${x.t}</span>`;
  let h = '';
  for (let i = 0; i < list.length; i += 2) h += `<div class="mv-row"><span class="n">${i/2+1}.</span>${cell(list[i], i)}${list[i+1] ? cell(list[i+1], i+1) : '<span></span>'}</div>`;
  el.innerHTML = h; el.scrollTop = el.scrollHeight;
}

/* ---------- Analysis (engine arrows, move icons, eval bar) ---------- */
const root = () => ({ s:Chess.start(), last:null, m:null, t:'', cp:null, top:null, cls:null, sac:false, src:null, clsSrc:null });
const ana = { line:[root()], ix:0 };
let showBest = true;
const abd = new Board($('#aboard'), { mode:'both', onMove: aMove });
$('#achatin').disabled = true; $('#achatsend').disabled = true;
function setBar(cp) {
  const pct = wpc(cp), mate = Math.abs(cp) > 90000;
  $('#evalfill').style.height = pct + '%';
  $('#evaltxt').textContent = mate ? 'M' + Math.max(1, Math.ceil((100000 - Math.abs(cp)) / 2)) : (Math.abs(cp)/100).toFixed(1);
  $('#evaltxt').classList.toggle('top', cp < 0);
  $('#evalpct').textContent = Math.round(pct) + '%';
  $('#evalbar').title = `White ${Math.round(pct)}% · Black ${100 - Math.round(pct)}%`;
}
function paintAna() {
  const n = ana.line[ana.ix];
  abd.badges = n.cls && n.m ? { [n.m.to]: n.cls } : {};
  abd.engArrows = showBest && n.top ? n.top.slice(0,3).map(m => [m.from, m.to]) : [];
  abd.render();
  if (n.cp != null) setBar(n.s.turn==='w' ? n.cp : -n.cp);
  const st = Chess.status(n.s);
  $('#anote').textContent = st ? st.text + (st.winner ? ' — ' + (st.winner==='w'?'White':'Black') + ' wins' : '') : (n.s.turn==='w'?'White':'Black') + ' to move';
  renderMoves($('#amoves'), ana.line.slice(1), ana.ix - 1, true);
}
async function analyzeNode(i) {
  const node = ana.line[i], mode_ = Eng.mode();
  if (node.cp == null || !node.top || node.src!==mode_) {
    Eng.stop();
    const r = await Eng.analyze(node.s, { n:3, t:650, stale: () => ana.ix!==i });
    if (!r) return; node.cp = r.cp; node.top = r.top; node.src = Eng.mode();
  }
  if (node.m && i > 0 && (node.cls == null || node.clsSrc!==node.src)) {
    const par = ana.line[i-1];
    if (par.cp == null || !par.top || par.src!==node.src) { const r = await Eng.analyze(par.s, { n:3, t:500 }); if (r) { par.cp = r.cp; par.top = r.top; par.src = node.src; } }
    if (par.cp != null) {
      const before = wpc(par.cp), after = wpc(-node.cp);
      node.cls = classify(Math.max(0, before - after), before, after, i - 1, node.sac, onlyMove(par.top, node.m)); node.clsSrc = node.src;
    }
  }
  if (ana.ix === i) paintAna();
}
function go(i) {
  i = Math.max(0, Math.min(ana.line.length - 1, i)); ana.ix = i;
  const n = ana.line[i];
  abd.s = n.s; abd.last = n.last; abd.sel = null; abd.pre = []; abd.hi.clear(); abd.arrows = []; abd.badges = {}; abd.engArrows = [];
  paintAna(); analyzeNode(i);
}
function aMove(m) {
  const prev = abd.s; ana.line.length = ana.ix + 1; abd.play(m);
  ana.line.push({ ...root(), s:abd.s, last:m, m, t:moveText(prev, m, abd.s), sac:isSac(prev, m, abd.s) });
  ana.ix++; paintAna(); analyzeNode(ana.ix);
}
$('#a-first').onclick = () => go(0); $('#a-prev').onclick = () => go(ana.ix - 1);
$('#a-next').onclick = () => go(ana.ix + 1); $('#a-last').onclick = () => go(ana.line.length - 1);
$('#a-flip').onclick = () => abd.flipBoard();
$('#a-reset').onclick = () => { ana.line = [root()]; go(0); };
$('#a-best').onclick = () => { showBest = !showBest; Store.set('showBest', showBest); $('#a-best').textContent = 'Best moves: ' + (showBest ? 'On' : 'Off'); paintAna(); };
$('#amoves').onclick = e => { const c = e.target.closest('[data-i]'); if (c) go(+c.dataset.i + 1); };
document.addEventListener('keydown', e => {
  if (!$('#analysis').classList.contains('active') || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
  if (e.key==='ArrowLeft') go(ana.ix - 1); else if (e.key==='ArrowRight') go(ana.ix + 1);
  else if (e.key==='Home') go(0); else if (e.key==='End') go(ana.line.length - 1);
});
Eng.ready.then(ok => { if (ok) go(ana.ix); });          // re-run analysis with Stockfish once it has loaded

/* ---------- Network (auto-reconnecting, kept alive) ---------- */
let ws = null, hb_ = null, retry = 0, pendingCbs = [], myCode = null, openGames = [];
const send = o => { if (ws && ws.readyState===1) ws.send(JSON.stringify(o)); };
const wsAuth = () => send({ t:'auth', token: Auth.token || '' });
const msg = t => { $('#pmsg').textContent = t; };
function openWS() {
  if (!location.host || (ws && ws.readyState <= 1)) return;
  ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://') + location.host);
  ws.onopen = () => {
    retry = 0; wsAuth(); msg('');
    clearInterval(hb_); hb_ = setInterval(() => send({ t:'ping' }), 25000);
    if (G && G.kind==='online' && !G.over && G.code) send({ t:'rejoin', code:G.code, pid:G.pid });     // come back to the game in progress
    const cbs = pendingCbs; pendingCbs = []; cbs.forEach(f => f());
  };
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => {
    clearInterval(hb_); ws = null; myCode = null;
    if (G && G.kind==='online' && !G.over && !G.reconnectUntil) G.reconnectUntil = Date.now() + 30000;
    setTimeout(openWS, Math.min(15000, 1000 * Math.pow(2, retry++)));
  };
}
function connect(cb) {
  if (ws && ws.readyState===1) return cb();
  if (!location.host) return msg('Run the server (npm start) and open http://localhost:3000 to play online.');
  pendingCbs.push(cb); openWS();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) openWS(); });

function handle(m) {
  if (m.t==='list') { openGames = m.games; renderCols(); }
  else if (m.t==='created') {
    myCode = m.code; renderCols();
    $('#wtitle').textContent = m.priv ? 'Private game created' : 'Waiting for an opponent…';
    $('#wcode').hidden = !m.priv; $('#wcodebox').textContent = m.code;
    $('#wtc').textContent = `Time control ${m.tc.m}+${m.tc.i}`;
    showPlay('pwait');
  } else if (m.t==='start') { myCode = null; startGame({ mode:'online', color:m.color, tc:m.tc, opp:m.opp, you:m.you, code:m.code, pid:m.pid }); }
  else if (m.t==='move') oppMove(m.m);
  else if (m.t==='resign') finishC(myColor, 'Opponent resigned', 'resign');
  else if (m.t==='timeout') { const w = Chess.canMate(pb.s, myColor); finishC(w ? myColor : null, w ? 'Opponent ran out of time' : 'Timeout vs insufficient material', w ? 'time' : 'draw'); }
  else if (m.t==='draw') {
    toast('Your opponent offers a draw.', { title:'Draw offer', actions:[
      { label:'Accept', fn: () => { send({ t:'drawres', ok:true }); finishC(null, 'Draw by agreement', 'draw'); } },
      { label:'Decline', sec:1, fn: () => send({ t:'drawres', ok:false }) } ], onTimeout: () => send({ t:'drawres', ok:false }) });
  }
  else if (m.t==='drawres') { drawFlag = false; if (m.ok) finishC(null, 'Draw by agreement', 'draw'); else toast('Your opponent declined the draw.'); }
  else if (m.t==='rematch') {
    if (!G || !G.over) return;
    toast('Your opponent wants a rematch.', { title:'Rematch', actions:[
      { label:'Accept', fn: () => { send({ t:'rematchres', ok:true }); startRematch(); } },
      { label:'Decline', sec:1, fn: () => send({ t:'rematchres', ok:false }) } ] });
  }
  else if (m.t==='rematchres') { rematchSent = false; if (m.ok) startRematch(); else toast('Your opponent declined the rematch.'); }
  else if (m.t==='chat') chatAdd(G ? names[other(myColor)] : 'Opponent', m.text);
  else if (m.t==='oppdc') { if (G && !G.over) G.oppDc = Date.now() + (m.secs || 30) * 1000; }
  else if (m.t==='oppback') { if (G) { G.oppDc = null; if (!G.over) toast('Your opponent reconnected.'); } }
  else if (m.t==='abandon') { if (G && !G.over) finishC(myColor, 'Opponent disconnected', 'time'); }
  else if (m.t==='rejoined') { if (G) { G.reconnectUntil = null; toast('Reconnected to your game.'); } }
  else if (m.t==='rejoinfail') { if (G && !G.over) finishC(other(myColor), 'Connection lost', 'time'); }
  else if (m.t==='end') { if (G && G.kind==='online' && !G.over) finishC(myColor, m.reason, 'resign'); else if (!G) { showPlay('plobby'); msg(m.reason); } }
  else if (m.t==='err') msg(m.msg);
}

/* ---------- Lobby ---------- */
const TCOPTS = [[1,0],[2,0],[2,1],[3,0],[3,2],[5,0],[10,10],[15,0]];
let tc = { m:10, i:10 }, lobbyMode = 'human', priv = false;
const paintTc = () => $$('#tcbar button').forEach(b => b.classList.toggle('sel', +b.dataset.m===tc.m && +b.dataset.i===tc.i));
$('#tcbar').innerHTML = TCOPTS.map(([m,i]) => `<button data-m="${m}" data-i="${i}"><b>${m}</b><small>${i ? '+'+i : 'min'}</small></button>`).join('');
$('#tcbar').onclick = e => { const b = e.target.closest('button'); if (!b) return; tc = { m:+b.dataset.m, i:+b.dataset.i }; Store.set('tc', tc); paintTc(); };
const hint = () => ({
  human: priv ? 'Creates a private game and shows a 6-digit code to share. Only someone with the code can join.' : 'Pairs you with the next player on the same time control, or lists your game in the lobby until someone joins. Click any open game above to join it.',
  ai: 'Play against a bot. Pick a strength and press Start.',
  friend: 'Creates a private game and gives you a 6-digit code to share. Already have a code? Enter it and press Join.'
}[lobbyMode]);
function paintLobbyMode() {
  $$('#modes button').forEach(x => x.classList.toggle('on', x.dataset.mode===lobbyMode));
  $('#tcbar').hidden = lobbyMode==='ai'; $('#airow').hidden = lobbyMode!=='ai'; $('#friendrow').hidden = lobbyMode!=='friend'; $('#pubbox').hidden = lobbyMode!=='human';
  $('#privlbl').textContent = priv ? 'Private' : 'Public'; $('#privsw').checked = priv; $('#modehint').textContent = hint();
}
$('#modes').onclick = e => { const b = e.target.closest('button'); if (!b) return; lobbyMode = b.dataset.mode; Store.set('lobbyMode', lobbyMode); paintLobbyMode(); };
$('#privsw').onchange = e => { priv = e.target.checked; Store.set('priv', priv); paintLobbyMode(); };
const LEVELS = [200,400,600,800,1000,1200,1500,1800,2000,2300,2500,2700,3000,3200];
$('#ailv').innerHTML = LEVELS.map(l => `<option value="${l}">Bot ${l}</option>`).join('');
const card = g => `<button class="oc" data-join="${g.code}"><i class="av">${g.name[0]}</i><span class="nm">${g.name}</span><span class="ttc">${g.tc.i ? g.tc.m+'+'+g.tc.i : g.tc.m+'<small>min</small>'}</span></button>`;
function renderCols() {                                   // live open games, refreshed whenever the server sends an update
  const list = openGames.filter(g => g.code!==myCode), by = { Bullet:[], Blitz:[], Rapid:[], Classic:[], Daily:[] };
  list.forEach(g => by[g.tc.m<=2 ? 'Bullet' : g.tc.m<10 ? 'Blitz' : g.tc.m<30 ? 'Rapid' : 'Classic'].push(g));
  by['Smart picks'] = list.slice(-2).reverse();
  $('#cols').innerHTML = ['Bullet','Blitz','Rapid','Classic','Daily','Smart picks'].map(n =>
    `<div class="col"><h3>${n}</h3>${[0,1,2,3,4].map(i => by[n][i] ? card(by[n][i]) : '<div class="slot"></div>').join('')}</div>`).join('');
}
$('#cols').onclick = e => { const b = e.target.closest('[data-join]'); if (b) connect(() => send({ t:'join', code:b.dataset.join })); };
const showPlay = id => ['plobby','pwait'].forEach(v => { $('#'+v).hidden = v!==id; });
$('#startgame').onclick = () => {
  msg('');
  if (lobbyMode==='ai') return startGame({ mode:'bot', lv:+$('#ailv').value, color: Math.random()<.5 ? 'w' : 'b' });
  connect(() => (lobbyMode==='friend' || priv) ? send({ t:'create', priv:true, tc }) : send({ t:'quick', tc }));
};
$('#codein').oninput = e => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,6); };
$('#codego').onclick = () => { const c = $('#codein').value.trim(); if (!/^\d{6}$/.test(c)) return msg('Enter a 6-digit code.'); connect(() => send({ t:'join', code:c })); };
$('#wcancel').onclick = () => { send({ t:'leave' }); myCode = null; showPlay('plobby'); renderCols(); };

/* ---------- Bots + one-computer launchers ---------- */
const BOTS = [['Beginner',[200,400,600,800]], ['Intermediate',[1000,1200,1500,1800]], ['Advanced',[2000,2300,2500]], ['Master',[2700,3000,3200]]];
let botLv = 1000, botColor = 'r', lastBot = null, lastLocal = null, ltc = 0;
$('#botgrid').innerHTML = BOTS.map(([g,ls]) => `<div class="label">${g}</div><div class="tiles">${ls.map(l => `<button class="tile" data-lv="${l}"><b>${l}</b><span>Bot</span></button>`).join('')}</div>`).join('');
const paintBots = () => { $$('#botgrid .tile').forEach(x => x.classList.toggle('sel', +x.dataset.lv===botLv)); $$('#botcolor button').forEach(x => x.classList.toggle('sel', x.dataset.bc===botColor)); };
$('#botgrid').onclick = e => { const b = e.target.closest('.tile'); if (!b) return; botLv = +b.dataset.lv; Store.set('botLv', botLv); paintBots(); };
$('#botcolor').onclick = e => { const b = e.target.closest('button'); if (!b) return; botColor = b.dataset.bc; Store.set('botColor', botColor); paintBots(); };
$('#bot-play').onclick = () => startGame({ mode:'bot', lv:botLv, color: botColor==='r' ? (Math.random()<.5?'w':'b') : botColor });
Eng.onLabel(t => { $('#englabel').textContent = t; }); Eng.init();

const LTC = [[0,0,'none'],[3,0,'min'],[5,0,'min'],[10,0,'min'],[15,10,'+10']];
$('#ltc').innerHTML = LTC.map(([m,i,s],k) => `<button data-k="${k}"><b>${m || 'No'}</b><small>${m ? s : 'clock'}</small></button>`).join('');
const paintLtc = () => $$('#ltc button').forEach(b => b.classList.toggle('sel', +b.dataset.k===ltc));
$('#ltc').onclick = e => { const b = e.target.closest('button'); if (!b) return; ltc = +b.dataset.k; paintLtc(); };
$('#local-play').onclick = () => {
  const w = $('#lname-w').value.trim() || 'White', b = $('#lname-b').value.trim() || 'Black', [m,i] = LTC[ltc];
  Store.set('lnames', { w:$('#lname-w').value, b:$('#lname-b').value });
  startGame({ mode:'local', names:{ w, b }, tc: m ? { m, i } : null });
};

/* ---------- Game (online, bot, one computer) ---------- */
let pb = null, mode = null, origin = 'play', clk = null, timer = null, token = 0, botLv_ = 1000, gh = [], names = { w:'', b:'' }, myColor = 'w', drawFlag = false, rematchSent = false, rules = { hm:0, reps:{} };
const fmt = ms => { ms = Math.max(0, ms); const s = Math.floor(ms/1000); return ms < 10000 ? (ms/1000).toFixed(1) : Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
const other = c => c==='w' ? 'b' : 'w';
const bottom = () => mode==='local' ? (pb.flip ? 'b' : 'w') : myColor;

// material points next to each player: captured pieces plus the lead, like chess.com
const START_CNT = { P:8, N:2, B:2, R:2, Q:1 }, PV = { P:1, N:3, B:3, R:5, Q:9 };
function capHTML(by, s) {
  const op = other(by), cnt = { w:{P:0,N:0,B:0,R:0,Q:0}, b:{P:0,N:0,B:0,R:0,Q:0} }, pts = { w:0, b:0 };
  for (const p of s.b) if (p && p[1]!=='K') { cnt[p[0]][p[1]]++; pts[p[0]] += PV[p[1]]; }
  let h = '';
  for (const t of ['P','N','B','R','Q']) { const miss = Math.max(0, START_CNT[t] - cnt[op][t]); if (miss) h += '<span>' + `<img alt="" src="${PIECE_IMG[op+t]}">`.repeat(miss) + '</span>'; }
  const d = pts[by] - pts[op]; return h + (d>0 ? `<b>+${d}</b>` : '');
}
function paintStrips() {
  const bc = bottom(), tcol = other(bc);
  $('#mename').textContent = names[bc]; $('#oppname').textContent = names[tcol];
  $('#meav').textContent = (names[bc][0] || '?').toUpperCase(); $('#oppav').textContent = (names[tcol][0] || '?').toUpperCase();
  $('#mecap').innerHTML = capHTML(bc, pb.s); $('#oppcap').innerHTML = capHTML(tcol, pb.s);
}

function startGame(o) {
  token++; mode = o.mode; origin = o.mode==='bot' ? 'bots' : o.mode==='local' ? 'local' : 'play';
  lastBot = o.mode==='bot' ? o : null; lastLocal = o.mode==='local' ? o : null; botLv_ = o.lv;
  gh = []; drawFlag = false; rematchSent = false; rules = { hm:0, reps:{} };
  const local = o.mode==='local';
  myColor = local ? 'w' : o.color;
  G = { kind:o.mode, over:false, oppName: o.mode==='bot' ? `Bot ${o.lv}` : (o.opp || 'Opponent'), tc:o.tc, code:o.code, pid:o.pid, reconnectUntil:null, oppDc:null };
  names = local ? { ...o.names } : (myColor==='w' ? { w:o.you || 'You', b:G.oppName } : { w:G.oppName, b:o.you || 'You' });
  msg(''); showPlay('plobby'); $('#endm').hidden = true; $('#dcnote').hidden = true;
  pb = new Board(freshBoard('gboard'), { mode: local ? 'both' : 'online', color:myColor, onMove:userMove });
  $('#gme').textContent = local ? 'Two players, one board' : 'You are ' + (myColor==='w' ? 'White' : 'Black');
  clk = o.tc ? { t:{ w:o.tc.m*60000, b:o.tc.m*60000 }, inc:o.tc.i, turn:'w', stamp:Date.now() } : null;
  $('#meclock').style.display = $('#oppclock').style.display = clk ? '' : 'none';
  clearInterval(timer); timer = setInterval(tick, 200);
  $('#gresign').hidden = $('#gdraw').hidden = false; $('#gagain').hidden = true; $('#gflip').hidden = !local;
  $('#gchatlog').innerHTML = ''; $('#gchatin').disabled = $('#gchatsend').disabled = o.mode!=='online';
  $('#gchatin').placeholder = o.mode==='online' ? 'Say something…' : 'Chat is for online games';
  rules.reps[Chess.key(pb.s)] = 1;
  openTab('game', true); Sound.play('start'); paintStrips(); renderMoves($('#gmoves'), gh, -1, false); turnText(); tick();
  if (o.mode==='bot' && myColor==='b') botTurn();
}

function tick() {
  updatePill();
  if (G && G.kind==='online' && !G.over) {                // 30-second grace period when either side loses connection
    const n = $('#dcnote');
    if (G.reconnectUntil) {
      const s = Math.ceil((G.reconnectUntil - Date.now()) / 1000); n.hidden = false;
      n.textContent = `Connection lost. Reconnecting… you have ${Math.max(0, s)}s to return before you lose.`;
      if (s <= 0) return finishC(other(myColor), 'Connection lost', 'time');
    } else if (G.oppDc) {
      const s = Math.ceil((G.oppDc - Date.now()) / 1000); n.hidden = false;
      n.textContent = `Your opponent lost connection. They have ${Math.max(0, s)}s to return or you win.`;
    } else n.hidden = true;
  }
  if (!clk || done() || !pb) return;
  const el = Date.now() - clk.stamp, t = c => clk.t[c] - (clk.turn===c ? el : 0), bc = bottom(), tcol = other(bc);
  $('#meclock').textContent = fmt(t(bc)); $('#oppclock').textContent = fmt(t(tcol));
  $('#meclock').classList.toggle('on', clk.turn===bc); $('#oppclock').classList.toggle('on', clk.turn===tcol);
  if (mode!=='local' && clk.turn===myColor) {
    const sec = Math.ceil(t(myColor)/1000);
    if (t(myColor) > 0 && t(myColor) < 10000 && sec!==tick.last) { tick.last = sec; Sound.play('tick'); }
  }
  const mover = clk.turn;
  if (t(mover) <= 0 && (mode==='local' || mover===myColor)) flag(mover);
}
function flag(c) {                                         // c ran out of time
  const win = other(c);
  if (mode==='online') send({ t:'timeout' });
  if (!Chess.canMate(pb.s, win)) return finishC(null, 'Timeout vs insufficient material', 'draw');
  finishC(win, (mode==='local' ? names[c] : 'You') + ' ran out of time', 'time');
}
function clockSwitch() {
  if (!clk) return;
  const now = Date.now();
  clk.t[clk.turn] = clk.t[clk.turn] - (now - clk.stamp) + clk.inc*1000; clk.turn = other(clk.turn); clk.stamp = now;
}
// draws: threefold repetition (or perpetual check when the repeating side was giving check) and the fifty-move rule
function ruleDraw(prev, m) {
  const cap = prev.b[m.to] || m.ep, pawn = prev.b[m.from][1]==='P';
  rules.hm = (cap || pawn) ? 0 : rules.hm + 1;
  const k = Chess.key(pb.s); rules.reps[k] = (rules.reps[k] || 0) + 1;
  if (rules.reps[k] >= 3) {
    const l = gh.slice(-6);
    if (l.length >= 6 && ([0,2,4].every(i => l[i].chk) || [1,3,5].every(i => l[i].chk))) return 'Draw by perpetual check';
    return 'Draw by threefold repetition';
  }
  if (rules.hm >= 100) return 'Draw by fifty-move rule';
  return null;
}
function record(prev, m, mover) { gh.push({ s:prev, m, c:mover, t:moveText(prev, m, pb.s), chk:Chess.inCheck(pb.s) }); }
function userMove(m) {
  if (mode==='online' && G.reconnectUntil) return toast('Reconnecting… your move was not sent.');
  const prev = pb.s, mover = prev.turn;
  if (mode==='online') send({ t:'move', m });
  pb.play(m); record(prev, m, mover); clockSwitch(); after(prev, m);
  if (!done() && mode==='bot') botTurn();
}
function oppMove(m) {
  if (!pb || done()) return;
  const prev = pb.s, mover = prev.turn;
  pb.play(m); record(prev, m, mover); clockSwitch(); after(prev, m);
  if (done()) return;
  const pm = pb.tryPre();
  if (pm) { pb.skipAnim = true; userMove(pm); } else pb.render();
}
function botTurn() {
  const t = token, t0 = Date.now(), target = 1000 + Math.random() * 2000;      // bots answer after 1-3 seconds
  Eng.move(pb.s, botLv_).then(m => {
    if (t!==token || done() || !m) return;
    setTimeout(() => { if (t===token && !done()) oppMove(m); }, Math.max(0, target - (Date.now() - t0)));
  });
}
function turnText() {
  const w = pb.s.turn;
  $('#gturn').textContent = mode==='local' ? names[w] + ' to move' :
    (w===myColor ? 'Your move' : (mode==='bot' ? 'Bot is thinking…' : "Opponent's move") + (pb.pre.length ? ` (${pb.pre.length} premove${pb.pre.length>1?'s':''})` : ''));
}
function after(prev, m) {
  paintStrips(); renderMoves($('#gmoves'), gh, gh.length - 1, false);
  const st = Chess.status(pb.s), dr = prev ? ruleDraw(prev, m) : null;
  if (st) return finishC(st.winner || null, st.text, st.winner ? 'mate' : 'draw');
  if (dr) return finishC(null, dr, 'draw');
  turnText();
}

/* ---------- Chat, draw, resign ---------- */
function chatAdd(from, text, sys) {
  const log = $('#gchatlog'), d = document.createElement('div'); d.className = sys ? 'msg sys' : 'msg';
  if (sys) d.textContent = text; else { const b = document.createElement('b'); b.textContent = from + ': '; d.append(b, document.createTextNode(text)); }
  log.append(d); log.scrollTop = log.scrollHeight;
}
function sendChat() {
  if (mode!=='online' || done()) return;
  const t = $('#gchatin').value.trim(); if (!t) return;
  send({ t:'chat', text:t }); chatAdd(names[myColor], t); $('#gchatin').value = '';
}
$('#gchatsend').onclick = sendChat; $('#gchatin').onkeydown = e => { if (e.key==='Enter') sendChat(); };

$('#gresign').onclick = () => {
  if (done()) return;
  if (mode==='online') send({ t:'resign' });
  const loser = mode==='local' ? pb.s.turn : myColor;
  finishC(other(loser), (mode==='local' ? names[loser] : 'You') + ' resigned', 'resign');
};
$('#gdraw').onclick = () => {
  if (done() || drawFlag) return;
  if (mode==='online') { send({ t:'draw' }); drawFlag = true; toast('Draw offer sent.'); setTimeout(() => { drawFlag = false; }, 20000); }
  else if (mode==='bot') {
    drawFlag = true; toast('Draw offer sent…');
    Eng.eval(pb.s).then(cp => {
      drawFlag = false; if (done()) return;
      const bot = other(myColor), botCp = pb.s.turn===bot ? cp : -cp;
      if (botCp <= 40) finishC(null, 'Draw by agreement', 'draw'); else toast('The bot declined your draw offer.');
    });
  } else {
    const a = pb.s.turn;
    toast(`${names[a]} offers a draw. ${names[other(a)]}, do you accept?`, { title:'Draw offer', actions:[
      { label:'Accept', fn: () => finishC(null, 'Draw by agreement', 'draw') }, { label:'Decline', sec:1 } ] });
  }
};
$('#gflip').onclick = () => { pb.flipBoard(); paintStrips(); };

/* ---------- End of game ---------- */
function finishC(winner, reason, kind) {                  // winner: 'w' | 'b' | null (draw)
  if (!G || G.over) return;
  G.over = true; G.reconnectUntil = null; G.oppDc = null; $('#dcnote').hidden = true;
  if (pb) { pb.active = false; pb.pre = []; pb.render(); }
  clearInterval(timer);
  const res = winner===null ? 'draw' : (mode==='local' ? 'win' : winner===myColor ? 'win' : 'loss');
  $('#gturn').textContent = (winner===null ? 'Draw' : mode==='local' ? names[winner] + ' wins' : res==='win' ? 'You won' : 'You lost') + ' — ' + reason;
  $('#gresign').hidden = $('#gdraw').hidden = true; $('#gagain').hidden = mode==='online';
  updatePill();
  if (!$('#game').classList.contains('active')) toast($('#gturn').textContent, { title:'Game over' });
  if (mode==='online') { const tk = token; setTimeout(() => { if (tk===token && G && G.over) send({ t:'leave' }); }, 120000); }   // keep the room open for a rematch
  showEnd(winner, res, reason, kind);
}
function showEnd(winner, res, reason, kind) {
  const tk = token, wk = pb.s.b.indexOf('wK'), bk = pb.s.b.indexOf('bK'), kingOf = c => c==='w' ? wk : bk;
  pb.badges = {}; pb.fall = {};
  if (winner===null) { pb.badges[wk] = pb.badges[bk] = 'draw'; }
  else {
    const lose = other(winner); pb.badges[kingOf(winner)] = 'crown';
    pb.badges[kingOf(lose)] = kind==='mate' ? 'mate' : kind==='time' ? 'clock' : 'flag'; pb.fall[kingOf(lose)] = 1;
  }
  pb.render(); Sound.play(res);
  $('#endcard').className = 'endcard ' + (winner===null ? 'draw' : res);
  $('#endtitle').textContent = winner===null ? 'Draw' : mode==='local' ? names[winner] + ' wins!' : res==='win' ? 'You won!' : 'You lost';
  $('#endsub').textContent = reason; $('#arc').style.strokeDashoffset = 226.2; $('#rnum').textContent = '--';
  $('#rlabel').textContent = 'Analysing the game…'; $('#rmeta').innerHTML = ''; $('#clsbox').innerHTML = ''; $('#confetti').innerHTML = '';
  $('#endnew').textContent = mode==='online' ? 'Back to lobby' : 'New game';
  setTimeout(() => { if (tk!==token) return; $('#endm').hidden = false; if (winner!==null && (res==='win' || mode==='local')) confetti(); review(tk); }, 900);
}
function confetti() {                                      // falling chess pieces (the HayChess touch)
  const keys = Object.keys(PIECE_ORIG);
  $('#confetti').innerHTML = Array.from({ length:34 }, () => {
    const k = keys[(Math.random()*keys.length)|0], dur = 2.2 + Math.random()*2.2;
    return `<img alt="" src="${PIECE_ORIG[k]}" style="left:${Math.random()*92}%;animation-duration:${dur}s;animation-delay:${Math.random()*.9}s;--rot:${(Math.random()*720-360)|0}deg">`;
  }).join('');
}
function setRating(n, label, meta) {
  $('#rlabel').textContent = label; $('#rmeta').innerHTML = meta || '';
  if (n==null) return;
  $('#arc').style.strokeDashoffset = 226.2 * (1 - n/100);
  const t0 = performance.now();
  (function step(t) { const k = Math.min(1, (t - t0) / 1200); $('#rnum').textContent = Math.round(n*k); if (k<1) requestAnimationFrame(step); })(t0);
}
// rate each side 1-100 and count every move type (brilliant ... blunder)
async function review(tk) {
  if (gh.length < 2) return setRating(null, 'Game too short to analyse');
  const pos = gh.map(h => h.s).concat([pb.s]), ev = [], tops = [];
  for (let i = 0; i < pos.length; i++) {
    if (tk!==token) return;
    const r = await Eng.analyze(pos[i], { n:2, t:130 });
    ev.push(r ? r.cp : 0); tops.push(r ? r.top : []);
    $('#rlabel').textContent = `Analysing the game… ${Math.round((i+1)/pos.length*100)}%`;
  }
  if (tk!==token) return;
  const acc = { w:[], b:[] }, cnt = { w:{}, b:{} };
  CLS.forEach(([k]) => { cnt.w[k] = 0; cnt.b[k] = 0; });
  gh.forEach((h, i) => {
    const before = wpc(ev[i]), after = wpc(-ev[i+1]), loss = Math.max(0, before - after);
    acc[h.c].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)));
    h.cls = classify(loss, before, after, i, isSac(h.s, h.m, pos[i+1]), onlyMove(tops[i], h.m)); cnt[h.c][h.cls]++;
  });
  renderMoves($('#gmoves'), gh, gh.length - 1, false);
  const avg = a => a.length ? a.reduce((x,y) => x+y, 0) / a.length : 0, rate = a => Math.max(1, Math.min(100, Math.round(avg(a))));
  const me = mode==='local' ? 'w' : myColor, op = other(me), mine = rate(acc[me]), theirs = rate(acc[op]);
  const label = mode==='local' ? 'Game review' : mine>=90 ? 'Outstanding' : mine>=75 ? 'Strong play' : mine>=60 ? 'Solid' : mine>=40 ? 'Shaky' : 'Rough game';
  setRating(mode==='local' ? Math.round((mine+theirs)/2) : mine, label, mode==='local' ? `${names.w} ${mine} · ${names.b} ${theirs}` : `You ${mine} · Opponent ${theirs}`);
  const h1 = mode==='local' ? names.w : 'You', h2 = mode==='local' ? names.b : 'Opp';
  $('#clsbox').innerHTML = `<div class="crow h"><span></span><span>Move type</span><b>${h1.slice(0,6)}</b><b>${h2.slice(0,6)}</b></div>` +
    CLS.map(([k,n]) => `<div class="crow"><span class="bdg-i ${k}">${BADGE[k]}</span><span>${n}</span><b>${cnt[me][k]}</b><b>${cnt[op][k]}</b></div>`).join('');
}

function leaveGame() {
  if (mode==='online') send({ t:'leave' });
  token++; clearInterval(timer); G = null; pb = null; clk = null;
  $('#endm').hidden = true; $('#dcnote').hidden = true; showPlay('plobby'); openTab(origin, true); updatePill();
}
function startRematch() {
  startGame({ mode:'online', color:other(myColor), tc:G.tc, opp:G.oppName, you:names[myColor], code:G.code, pid:G.pid });
}
function rematch() {
  if (!G) return;
  if (mode==='bot') return startGame({ mode:'bot', lv:lastBot.lv, color:other(myColor) });
  if (mode==='local') return startGame({ mode:'local', names:{ w:names.b, b:names.w }, tc:lastLocal.tc });
  if (rematchSent) return toast('Rematch offer already sent.');
  send({ t:'rematch' }); rematchSent = true; toast('Rematch offer sent.'); setTimeout(() => { rematchSent = false; }, 20000);
}
const newGame = () => { if (mode==='bot' && lastBot) startGame({ mode:'bot', lv:lastBot.lv, color: Math.random()<.5 ? 'w' : 'b' }); else if (mode==='local' && lastLocal) startGame({ ...lastLocal }); else leaveGame(); };
$('#gagain').onclick = newGame; $('#endnew').onclick = newGame; $('#endrematch').onclick = rematch;
$('#endx').onclick = () => { $('#endm').hidden = true; };
$('#endan').onclick = () => {
  if (!pb) return;
  ana.line = [root()];
  gh.forEach((h, i) => ana.line.push({ ...root(), s: gh[i+1] ? gh[i+1].s : pb.s, last:h.m, m:h.m, t:h.t, cls:h.cls || null }));
  abd.flip = mode!=='local' && myColor==='b';
  $('#endm').hidden = true;
  if (!done()) return;
  if (mode==='online') send({ t:'leave' });
  G = null; pb = null; clk = null; openTab('analysis', true); go(ana.line.length - 1);
};

/* ---------- Load saved settings, start up ---------- */
function loadSettings() {
  theme = { ...T0, ...Store.get('theme', {}) }; applyTheme(); buildStudio(); syncStudio(); recolor(); paintMyThemes();
  $('#presetsel').value = '';
  botLv = Store.get('botLv', 1000); botColor = Store.get('botColor', 'r'); paintBots();
  tc = Store.get('tc', tc); paintTc(); lobbyMode = Store.get('lobbyMode', 'human'); priv = Store.get('priv', false); paintLobbyMode();
  showBest = Store.get('showBest', true); $('#a-best').textContent = 'Best moves: ' + (showBest ? 'On' : 'Off');
  const ln = Store.get('lnames', null); if (ln) { $('#lname-w').value = ln.w; $('#lname-b').value = ln.b; }
  Learn.render();
}
paintLtc();
Learn.init();
loadSettings();
go(0);
renderCols();
openWS();
Auth.init();
routeNow();
