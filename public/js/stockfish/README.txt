Put Stockfish.js here to power the bots, the analysis best-move arrows and the move-quality icons.

1. Open https://github.com/nmrugg/stockfish.js/releases and pick the newest release.
2. Download the two "lite-single" files, for example:
     stockfish-19-lite-single.js
     stockfish-19-lite-single.wasm   (about 1.8 MB)
3. Put BOTH files in this folder (public/js/stockfish/), commit, and let the site redeploy.

The server finds the files by itself (any name starting with "stockfish" that contains "single" or "asm").
The Bots tab will say "Engine: Stockfish" once it has loaded.
Do not use the multi-thread builds (they need special server headers) or the 100 MB full-size build.
Stockfish.js is licensed GPLv3; keep the license with the files.
