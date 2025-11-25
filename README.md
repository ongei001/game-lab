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
