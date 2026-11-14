// Runs the official Stockfish (https://github.com/official-stockfish/Stockfish) on the server and talks to it over UCI.
// The binary is found in ./engine, taken from STOCKFISH_PATH, or downloaded from the official GitHub releases on start-up.
const { spawn, execFile } = require('child_process'), fs = require('fs'), path = require('path'), https = require('https'), http = require('http');
const DIR = process.env.ENGINE_DIR || path.join(__dirname, 'engine');
const POOL = Math.max(1, +process.env.ENGINE_POOL || 1);
const MATE = 100000;
let state = 'starting', name = '', bin = null, procs = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isBin = f => { try { const s = fs.statSync(f); return s.isFile() && s.size > 200000 && !/\.(tar|zip|txt|md|gz)$/i.test(f); } catch (e) { return false; } };
function walk(d, out = []) { try { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); }); } catch (e) {} return out; }

// start the program once, say "uci", and see if it answers (a wrong-CPU build crashes here)
function probe(file) {
  return new Promise(res => {
    try { fs.chmodSync(file, 0o755); } catch (e) {}
    let p, done = false, buf = '', id = '';
    const fin = ok => { if (done) return; done = true; try { p && p.kill(); } catch (e) {} res(ok ? id || 'Stockfish' : null); };
    try { p = spawn(file, [], { stdio:['pipe','pipe','ignore'] }); } catch (e) { return fin(false); }
    p.on('error', () => fin(false)); p.on('exit', () => fin(false));
    p.stdout.on('data', d => { buf += d; const m = buf.match(/id name ([^\r\n]+)/); if (m) id = m[1]; if (/uciok/.test(buf)) fin(true); });
    p.stdin.on('error', () => {}); p.stdin.write('uci\n'); setTimeout(() => fin(false), 8000);
  });
}
function cpuVariant() {                                    // choose the fastest official build this CPU can run
  let flags = ''; try { flags = fs.readFileSync('/proc/cpuinfo', 'utf8'); } catch (e) {}
  if (/\bavx2\b/.test(flags)) return 'x86-64-avx2';
  if (/\bsse4_1\b/.test(flags) && /\bpopcnt\b/.test(flags)) return 'x86-64-sse41-popcnt';
  return 'x86-64';
}
function get(url, hops = 0) {
  return new Promise((res, rej) => {
    (url.startsWith('https') ? https : http).get(url, { headers:{ 'User-Agent':'HayChess' } }, r => {
      if ([301,302,303,307,308].includes(r.statusCode) && r.headers.location && hops < 8) { r.resume(); return res(get(new URL(r.headers.location, url).href, hops + 1)); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      res(r);
    }).on('error', rej);
  });
}
async function download(url) {
  fs.mkdirSync(DIR, { recursive:true });
  const tar = path.join(DIR, 'download.tar'), r = await get(url);
  await new Promise((res, rej) => { const w = fs.createWriteStream(tar); r.pipe(w); w.on('finish', res); w.on('error', rej); r.on('error', rej); });
  await new Promise((res, rej) => execFile('tar', ['-xf', tar, '-C', DIR], e => e ? rej(e) : res()));
  try { fs.unlinkSync(tar); } catch (e) {}
}

/* ---------- one Stockfish process, one job at a time ---------- */
class Proc {
  constructor(file) { this.file = file; this.q = []; this.busy = false; this.cur = null; this.spawn(); }
  spawn() {
    this.buf = ''; this.line = null;
    this.p = spawn(this.file, [], { stdio:['pipe','pipe','ignore'] });
    this.p.stdin.on('error', () => {});
    this.p.stdout.on('data', d => { this.buf += d; let i; while ((i = this.buf.indexOf('\n')) >= 0) { const l = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); if (this.line) this.line(l); } });
    this.p.on('exit', () => { const c = this.cur; this.cur = null; this.busy = false; if (c) { clearTimeout(c.tm); c.res(null); } setTimeout(() => { this.spawn(); this.pump(); }, 400); });
    this.p.stdin.write('uci\nsetoption name Threads value 1\nsetoption name Hash value 32\nisready\n');
  }
  exec(job) { return new Promise(res => { job.res = res; this.q.push(job); this.pump(); }); }
  pump() {
    if (this.busy || !this.q.length) return;
    const j = this.q.shift(); if (j.aborted) { j.res(null); return this.pump(); }
    this.busy = true; this.cur = j; const lines = [];
    j.tm = setTimeout(() => { try { this.p.kill(); } catch (e) {} }, j.timeout || 20000);
    this.line = l => { lines.push(l); if (l.startsWith('bestmove')) { clearTimeout(j.tm); this.cur = null; this.busy = false; this.line = null; j.res(lines); this.pump(); } };
    j.cmds.forEach(c => this.p.stdin.write(c + '\n'));
  }
  stop() { if (this.busy) this.p.stdin.write('stop\n'); }
  get load() { return this.q.length + (this.busy ? 1 : 0); }
}
const pick = () => procs.reduce((a, b) => b.load < a.load ? b : a);
function run(cmds, timeout, abortHook) {
  const proc = pick(), job = { cmds, timeout, aborted:false };
  if (abortHook) abortHook(() => { job.aborted = true; if (proc.cur === job) proc.stop(); });
  return proc.exec(job);
}
function parse(lines) {
  const out = {};
  for (const l of lines || []) {
    if (!l.startsWith('info') || !l.includes(' pv ')) continue;
    const mp = +((l.match(/ multipv (\d+)/) || [])[1] || 1), sc = l.match(/ score (cp|mate) (-?\d+)/), pv = (l.match(/ pv (\S+)/) || [])[1];
    if (sc && pv) { const v = +sc[2]; out[mp] = { uci:pv, cp: sc[1]==='cp' ? v : (v > 0 ? 1 : -1) * (MATE - Math.abs(v) * 2) }; }
  }
  return out;
}
const bestOf = lines => { const b = (lines || []).find(l => l.startsWith('bestmove')); return b ? b.split(' ')[1] : null; };
const okFen = f => typeof f === 'string' && f.length < 100 && /^[prnbqkPRNBQK1-8\/]+ [wb] [KQkq-]+ [a-h1-8-]+( \d+ \d+)?$/.test(f);
const busy = () => procs.every(p => p.load > 12);

// strength of the limited-strength mode: Stockfish picks its move at depth 1 + level, so we stop the search there
const levelOf = elo => { const e = (elo - 1320) / (3190 - 1320); return Math.max(0, Math.min(19, ((37.2473 * e - 40.8525) * e + 22.2943) * e - 0.311438)); };
// below Stockfish's lowest rating we sample from its ranked moves; flatter sampling = weaker play
const WEAK = { 200:[256,1,1e9], 400:[256,1,350], 600:[64,1,220], 800:[32,2,160], 1000:[16,2,120], 1200:[10,3,85] };   // [lines, depth, temperature in centipawns]

async function move({ fen, level }, hook) {
  if (state !== 'ready' || !okFen(fen)) return null;
  level = +level || 1000;
  const base = ['setoption name Skill Level value 20'];
  if (level < 1320) {
    const [mp, d, T] = WEAK[level] || WEAK[1000];
    const L = await run([...base, 'setoption name UCI_LimitStrength value false', 'setoption name MultiPV value ' + mp, 'position fen ' + fen, 'go depth ' + d], 8000, hook);
    const r = parse(L), ks = Object.keys(r); if (!ks.length) return bestOf(L) && { best: bestOf(L) };
    const top = Math.max(...ks.map(k => Math.max(-1500, Math.min(1500, r[k].cp)))), w = ks.map(k => Math.exp((Math.max(-1500, Math.min(1500, r[k].cp)) - top) / T));
    let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; for (; i < w.length - 1; i++) { x -= w[i]; if (x <= 0) break; }
    return { best: r[ks[i]].uci };
  }
  if (level >= 3200) {
    const L = await run([...base, 'setoption name UCI_LimitStrength value false', 'setoption name MultiPV value 1', 'position fen ' + fen, 'go depth 22 movetime 2300'], 9000, hook);
    return { best: bestOf(L) };
  }
  const D = 1 + Math.floor(levelOf(level));
  const L = await run(['setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value ' + Math.max(1320, Math.min(3190, level)), 'setoption name MultiPV value 1', 'position fen ' + fen, `go depth ${D} movetime 2500`], 9000, hook);
  return { best: bestOf(L) };
}
// full-strength analysis: best lines with their evaluations (side to move, centipawns)
async function analyze({ fen, n = 3, depth = 20, movetime = 3500 }, hook) {
  if (state !== 'ready' || !okFen(fen)) return null;
  n = Math.max(1, Math.min(5, +n || 3)); depth = Math.min(24, +depth || 20); movetime = Math.min(6000, +movetime || 3500);
  const L = await run(['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20', 'setoption name MultiPV value ' + n, 'position fen ' + fen, `go depth ${depth} movetime ${movetime}`], movetime + 6000, hook);
  if (!L) return null;
  const r = parse(L), top = Object.keys(r).map(Number).sort((a, b) => a - b).map(k => r[k]);
  return { cp: top.length ? top[0].cp : 0, top };
}
// accuracy needs the best AND the worst available move: a deep look for the best, a shallow look at every move for the worst
async function review({ fen }, hook) {
  const a = await analyze({ fen, n:2, depth:12, movetime:1500 }, hook); if (!a) return null;
  const L = await run(['setoption name UCI_LimitStrength value false', 'setoption name MultiPV value 256', 'position fen ' + fen, 'go depth 2'], 8000, hook);
  const r = parse(L), cps = Object.values(r).map(x => x.cp);
  return { ...a, worst: cps.length ? Math.min(...cps) : a.cp };
}

async function init() {
  try {
    const found = () => process.env.STOCKFISH_PATH ? [process.env.STOCKFISH_PATH] : walk(DIR).filter(isBin).sort();
    let list = found();
    if (!list.length && process.platform === 'linux' && process.arch === 'x64') {
      const urls = process.env.STOCKFISH_URL ? [process.env.STOCKFISH_URL]
        : ['https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-' + cpuVariant() + '.tar', 'https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-x86-64.tar'];
      for (const u of urls) { try { console.log('Downloading Stockfish:', u); await download(u); list = found(); if (list.length) break; } catch (e) { console.log('Stockfish download failed:', e.message); } }
    }
    for (const f of list) { const id = await probe(f); if (id) { bin = f; name = id; break; } }
    if (!bin) { state = 'missing'; console.log('Stockfish not available; the built-in engine will be used.'); return; }
    procs = Array.from({ length: POOL }, () => new Proc(bin));
    await sleep(600); state = 'ready'; console.log('Stockfish ready:', name);
  } catch (e) { state = 'failed'; console.log('Stockfish setup failed:', e.message); }
}
module.exports = { init, move, analyze, review, busy, status: () => ({ state, name }), levelOf };
