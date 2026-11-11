Put Stockfish.js here to power the bots (1500+), the analysis arrows and the game review.

1. Open the Stockfish.js releases page: https://github.com/nmrugg/stockfish.js/releases
2. Under the newest release, download the two "lite-single" files, for example:
     stockfish-19-lite-single.js
     stockfish-19-lite-single.wasm
   (stockfish-18-lite-single.js / .wasm also works.)
3. Put BOTH files in this folder (public/js/stockfish/) without renaming them, commit, and redeploy.

The Bots tab will then say "Engine: Stockfish". Without these files HayChess uses its built-in engine.
Use the "lite single" build: it is small and runs without special server headers. Do not use the 100 MB "single" or multi-threaded builds.
Stockfish.js is licensed GPLv3 (see the release page); keep its license with the files.
