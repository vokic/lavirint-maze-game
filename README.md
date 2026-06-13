# MAZE

A finger-drag maze game built with **Vite + React** and rendered as SVG. Trace the path from **S** to **E**.

## Features

- **4 difficulties** — Easy (6×6), Medium (10×10), Advanced (15×15), Crazy (28×28)
- **Two modes** — Random, and a seeded **Daily** maze (same maze for everyone on a given date) with a shareable result
- **Drag or keyboard** — mouse/touch drag, or arrows / WASD to move one cell at a time
- **Timer, step counter, best times** per difficulty (saved in `localStorage`)
- **Hint** — lights up the next cells of the shortest route (+10s penalty)
- **Sound** (Web Audio) and haptic feedback on dead ends, both toggleable
- **Save Trace** option — keep the trace between strokes, or clear it on lift for one-stroke play
- **Win screen** with confetti, Replay / Next Maze, and Material Symbols icons
- Responsive SVG that fits narrow phones

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # serve the build locally
```

## Deploy

Drag the `dist/` folder to a Netlify drop zone, or connect the repo for auto-deploy.

See [HANDOFF.md](HANDOFF.md) for architecture notes and next steps.
