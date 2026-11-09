# HayChess

Free chess teaching site with live play and an analysis board.

## Structure
- `server.js` – Node server: serves `public/` and runs the WebSocket matchmaking/relay (public lobby + private 6-digit codes)
- `public/index.html` – all tabs (Home, Play, Analysis, Learn, About)
- `public/css/style.css` – ice/navy theme + board styling
- `public/js/chess.js` – rules engine (legal moves, castling, en passant, promotion, check/mate/stalemate)
- `public/js/board.js` – board UI (click-to-move, premoves, right-click highlights and orange arrows)
- `public/js/app.js` – tabs, lobby, online game and analysis wiring

## Run locally
```
npm install
npm start        # http://localhost:3000
```
Open it in two browser windows to test a match.

## Put it on GitHub
```
git init && git add . && git commit -m "HayChess"
git branch -M main
git remote add origin https://github.com/<you>/haychess.git
git push -u origin main
```
GitHub Pages only hosts static files, so multiplayer needs the Node server hosted somewhere
(Render, Railway, Fly.io — connect the repo, start command `npm start`). The site and server
run together from that one host.

## Controls
- Click a piece, then a square to move. When it is not your turn, the same clicks set a **premove** (click an empty square to cancel).
- Right-click a square = orange highlight. Right-click-drag = orange arrow. Any left click clears them.
