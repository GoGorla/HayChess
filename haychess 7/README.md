# HayChess

Free chess site: live games, bots, one-computer play, analysis, a Learn path and accounts.

## Structure
- `server.js` – Node server: static files, accounts API, game rooms (WebSocket), engine API; every page address serves the app
- `engine-server.js` – runs the **official Stockfish** (https://github.com/official-stockfish/Stockfish) and answers bot, analysis and review requests
- `public/` – the website (`index.html`, `css/`, `js/`, `favicon.svg`)
  - `js/chess.js` rules · `board.js` board · `engine-client.js` talks to the server's Stockfish (built-in engine as a fallback) · `learn.js` lessons · `app.js` the app

## Run
```
npm install
npm start        # http://localhost:3000
```

## Stockfish (official)
On start-up the server looks for a Stockfish program in `./engine`. If there is none (Linux x64) it downloads the
fastest official build for its CPU from the Stockfish GitHub releases and unpacks it. Nothing needs to be uploaded to GitHub.
- `STOCKFISH_PATH` – use a program you already have (Windows/Mac development)
- `STOCKFISH_URL` – download a specific release .tar instead
- `ENGINE_DIR` – where the program is stored · `ENGINE_POOL` – how many engine processes to run (default 1)
Without Stockfish the site falls back to a small built-in engine and says so on the Bots tab.

## Accounts and saved games
- Accounts live in one readable file, `data/accounts.json` (username, email, hashed password). Set `DATA_DIR` to a persistent disk
  so they survive restarts; hosts with a temporary disk (Render free) can erase the file on redeploy.
- Every game has its own link, `/game/code/<10 digits>`, so a refreshed page returns to the same game.
