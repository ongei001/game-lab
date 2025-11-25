# Family Feud Live – Game Design Document

## Overview
Family Feud Live is a browser-hosted, team-based party game designed for remote play during video calls (Zoom, Teams, Meet). A host spins up a session, shares a short join code with participants, and controls pacing (round start/stop, question selection). Players join from their browsers, are assigned to teams automatically or by the host, and compete to uncover top survey answers before the countdown expires. The app is intentionally lightweight: a static Vite front-end plus a minimal WebSocket server keeps all clients in sync in real time.

## Roles
- **Host**
  - Creates the session (generates a join code).
  - Shares the code verbally or in chat.
  - Starts rounds, selects questions, ends rounds, and can reassign teams.
  - Watches strikes, revealed answers, and scores to keep pace lively.
- **Players**
  - Join by entering the code and their display name.
  - Submit answers during the countdown for the current question.
  - See team scores, strikes, revealed answers, and the timer.

## Core Rules
1. Host creates a session and shares the join code.
2. Players join; they are auto-balanced between Team A and Team B (host can override).
3. Host picks a survey question and starts a round with a configurable timer (e.g., 45 seconds).
4. During the countdown, players submit text answers. The server matches answers (case-insensitive substring match) against the predefined survey list.
5. Correct answers reveal on the board and add their point value to the answering team’s score. A short “correct” sound plays for everyone.
6. Incorrect answers add a strike to that team (up to three). A “strike” sound plays.
7. When the timer expires or the host ends the round, play moves to an intermission screen showing the updated scores; a transition sound plays.
8. Host can start the next round with a new question. Game can continue indefinitely or until a target score/time agreed verbally.

## Game Flow & Screens
1. **Landing / Lobby**
   - Host: “Start as Host” button creates a session and reveals the join code.
   - Player: “Join with Code” form accepts code + display name.
   - Lobby roster shows connected players and their teams; host controls to swap team assignment per player.
2. **Round In Progress**
   - Question prompt shown to all.
   - Countdown timer visible; subtle pulse animation as it nears zero.
   - Answer form for players (disabled for host by default unless host also plays).
   - Revealed answers list with points and which team uncovered them.
   - Strikes per team displayed as ❌ icons.
3. **Intermission / Round Recap**
   - Displays total scores and last question results.
   - Host selects next question and timer length, then starts the next round.

## Interaction Design
- **Join Code Sharing:** Host reads or pastes the short code (e.g., “F3D7”) into the video chat. Players type it into their join form.
- **Team Assignment:** Auto-balanced by join order; host can click a player in the lobby roster to move them between Team A/B.
- **Answering:** Players type and submit; submissions are matched against survey answers. Duplicate or already-revealed answers are ignored silently.
- **Timer:** Host selects duration; a bar and numeric countdown display to everyone. When zero is reached, the server ends the round.
- **Sounds:**
  - Correct answer chime.
  - Wrong/strike buzzer.
  - Transition stinger when rounds end/start.
- **Accessibility:** High-contrast layout, keyboard-submit for answers, visible focus states.

## Data Model (high level)
- **Game**: `{ code, hostId, phase, questionIndex, roundEndsAt, revealedAnswers[], teams{A,B}, players[] }`
- **Player**: `{ id, name, team }`
- **Answer**: `{ text, points, revealedBy? }`
- **Message Types (WebSocket)**: `create`, `join`, `set-team`, `start-round`, `answer`, `finish-round`, `next-question`, and periodic `state` broadcasts.

## Hosting & Running
1. Install dependencies: `npm install` (once).
2. Start the WebSocket server: `npm run server` (defaults to `ws://localhost:8787`).
3. Start the Vite dev server: `npm run dev -- --host` (or `npm run build && npm run preview` for production).
4. Share the join code shown on the host console/UI; players navigate to the same URL and enter the code.
5. For production hosting, serve the built `dist/` directory behind any static server (Netlify, Vercel, S3) and run the `server/server.js` process on a small Node host reachable at `WS_URL` (configure `VITE_SOCKET_URL`).

## Zoom/Call Tips
- Host shares screen so everyone sees the board; players also join individually to submit answers.
- Use the intermission view to chat, joke, and verify scores.
- Keep the question bank short to maintain pace; rotating host can reset scores with a manual refresh.

