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

### Quick play link
- Local dev: after running the steps above, open the Vite URL (usually [http://localhost:5173](http://localhost:5173)) and share that link with players on your Zoom/Meet call. They use the same link, enter the join code shown on the host screen, and they're in.
- Production/hosted: deploy `dist/` to any static host (e.g., Netlify, GitHub Pages) and keep `node server/server.js` running at a reachable address. Share the hosted URL with your group; the flow is the same—host starts a lobby, players open the link, and enter the code.

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
# Game Lab 🎮

A playground repository for experimenting with game ideas, mechanics, and small prototypes. The repo now ships with a lightweight TypeScript + Vite starter so you can jump straight into gameplay code.

## Features

- 🧩 Minimal 2D engine loop (update + draw) wired to an HTML canvas
- ⌨️ Keyboard input helper with WASD/arrow support
- 🧪 Testing + linting with Vitest and ESLint
- 🗂️ Ready-made folders for assets, docs, and future games

## Getting started

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Run unit tests: `npm test`
4. Lint TypeScript: `npm run lint`

> Tip: Press `R` or click **Reset Scene** in the demo to re-center the orb.

## Project structure

```text
src/
  engine/      # reusable systems (game loop, input, scenes)
  common/      # small helpers (math, types, utilities)
  games/       # each prototype/game in its own module
assets/
  sprites/     # 2D sprites & atlases
  audio/       # sound effects & music
  fonts/
  shaders/
docs/
  design/      # design docs & diagrams
  notes/       # ideas and logs
tests/         # integration/visual tests can live here
```

## Next steps

- Add more scene examples (tilemaps, physics toys, UI overlays)
- Expand the engine with sprites, tweens, audio, and ECS-style entities
- Wire up CI to run `npm test` and `npm run lint`
