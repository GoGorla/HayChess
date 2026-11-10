importScripts('chess.js', 'engine.js');
onmessage = e => postMessage(Engine.pick(e.data.s, e.data.level));
