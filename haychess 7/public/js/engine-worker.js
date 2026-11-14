importScripts('chess.js', 'engine.js');
onmessage = e => {
  const d = e.data;
  if (d.type === 'eval') postMessage({ id: d.id, cp: Engine.evalPos(d.s, d.d, d.t).cp });
  else if (d.type === 'analyze') postMessage({ id: d.id, ...Engine.analyze(d.s, d.d, d.t) });
  else if (d.type === 'worst') postMessage({ id: d.id, cp: Engine.worst(d.s) });
  else postMessage({ id: d.id, move: Engine.pick(d.s, d.level) });
};
