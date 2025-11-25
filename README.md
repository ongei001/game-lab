# Family Feud Live (Game Lab)

A lightweight, browser-based Family Feud style game built for remote play over Zoom, Teams, and Meet. A host spins up a session with a short join code, players join from their browsers, and everyone stays in sync through a tiny WebSocket server.

## How to run locally

1. Install dependencies
   ```bash
   npm install
   ```
2. Start the real-time WebSocket server (default: `ws://localhost:8787`)
   ```bash
   npm run server
   ```
3. Start the Vite dev server (serves the front-end)
   ```bash
   npm run dev -- --host
   ```
4. Open the printed URL in your browser. Host clicks **Start as host** to generate a code, players enter that code plus their name.

> Production hosting: `npm run build` to create `dist/`, serve it with any static host, and run `node server/server.js` on a small Node process reachable by clients. Set `VITE_SOCKET_URL` if the WebSocket server is on another host/port.

## Gameplay overview
- Host controls question selection, round start/stop, and can move players between Team A/B.
- Players join with the code, see the current question, and submit answers during the countdown.
- Answers are matched (case-insensitive) against a built-in survey list. Correct answers reveal on the board and add their point value to the answering team. Wrong answers add strikes.
- Sounds play for correct answers, strikes, and transitions to keep energy up during calls.
- Scores persist across rounds until you refresh.

## Project layout
- `src/` – Vite TypeScript front-end (UI, sounds, WebSocket client)
- `server/` – Minimal WebSocket server and survey question bank
- `docs/design/family-feud.md` – Full rules, flow, and UX notes
- `assets/`, `docs/notes`, `tests/` – Ready for future expansions

## Zoom tips
- Share your screen so everyone sees the board; players still join separately to submit answers.
- Use the intermission state to banter and confirm scores.
- Keep the timer tight (30–60 seconds) to maintain pacing.
