importScripts('chess.js', 'engine.js');
onmessage = e => {
  const d = e.data;
  if (d.type === 'eval') postMessage({ id: d.id, cp: Engine.evalPos(d.s, d.d, d.t).cp });
  else postMessage(Engine.pick(d.s, d.level));
};
