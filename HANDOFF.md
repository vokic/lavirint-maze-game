# Maze Game — Claude Code Handoff

## What this is

A finger-drag maze game, now a proper **Vite + React** project (migrated from the old single-file `index.html` with in-browser Babel — the original is preserved at `legacy/index.html`).

## Current state

Working features:
- 4 difficulty levels: Easy (6×6), Medium (10×10), Advanced (15×15), Crazy (28×28)
- **Two modes**: Random (new maze on demand) and **Daily** (seeded maze — everyone gets the same maze for a given local date + difficulty; share button on win)
- Drag to trace path — BFS auto-fills up to 6 cells ahead so fast swipes don't skip
- **Keyboard play**: arrows / WASD move one cell; stepping onto the previous cell backtracks
- Backtrack by dragging back over any visited cell, or click any visited cell to resume from there
- Wall collisions are silent — only buzz + red ring + sound when genuinely stuck (no valid moves)
- **Timer + step counter** — starts on first traced cell; per-difficulty (and per-daily) best times in `localStorage` (`maze.best`)
- **Hint button** — lights up the next 5 cells of the true shortest route, +10s timer penalty, hint count shown in stats and daily share text
- **Sound** — Web Audio chirps for step / stuck / hint / win, mute toggle persisted in `localStorage` (`maze.muted`)
- Mobile touch support + `navigator.vibrate` on dead end
- **Responsive SVG** — `viewBox` + `width:100%`, so Crazy (28×28) fits narrow phones; pointer coords are rescaled in `getCell`
- Per-difficulty accent colors (blue / amber / pink / purple)

## File structure

```
index.html          ← Vite shell (root div + module script; analytics placeholder comment)
vite.config.js      ← @vitejs/plugin-react
package.json        ← react 19, vite 8
src/
  main.jsx          ← createRoot + global CSS import
  App.jsx           ← the whole UI component (state, input, SVG rendering)
  maze.js           ← generateMaze (recursive backtracker, accepts rng), bfsRoute (maxLen param), isStuck, mulberry32 PRNG
  constants.js      ← LEVELS, DIFF_COLORS, PAD, MAX_ROUTE, stuck/hint tunables
  daily.js          ← todayKey, dailyNumber (epoch 2026-01-01), dailySeed (FNV-1a of "date:difficulty")
  audio.js          ← lazy AudioContext, tone() helper, sound.{step,stuck,hint,win,setMuted}
  storage.js        ← loadBest/saveBest/bestKey for localStorage records
  styles.css        ← reset + popIn/stuckPulse keyframes
legacy/index.html   ← the original single-file version (reference only)
HANDOFF.md          ← this file
```

## Architecture notes

- `generateMaze(rows, cols, rng)` — pass `mulberry32(seed)` for deterministic mazes (daily mode), defaults to `Math.random`
- `bfsRoute(..., maxLen)` — `MAX_ROUTE=6` during drag (anti-cheat), `Infinity` for hints/shortest-path
- Walls are deduped **by geometry** in a `useMemo` (shared walls between neighbours render once)
- `pathRef`/`stuckRef` mirror state for use inside event handlers (stale-closure avoidance)
- Timer: `startedAt` set by an effect when the path first becomes non-empty; win effect freezes `finalMs` (= elapsed + hint penalties) and updates records
- Best-time keys: `easy|medium|advanced|crazy` for random mode, `daily:<YYYY-MM-DD>:<difficulty>` for daily

## Ideas to build next

- **PWA** — manifest + service worker (vite-plugin-pwa), then wrap for Google Play via TWA/Bubblewrap
- **Monetization** — Poki/CrazyGames SDK (interstitial between mazes, rewarded ad for hint), AdSense on own domain
- **Analytics** — Plausible or GA4 snippet (placeholder comment in index.html)
- **Water maze** — gyroscope (`DeviceOrientationEvent`) tilts the board
- **Animated path drawing** — path segment draws with a short transition instead of snapping
- **Corridor highlight on hover** — show reachable cells from current position
- **More modes** — time attack (most mazes in 60s), fog of war, same-seed multiplayer race
- **Themes** — selectable palettes (the accent system already parameterizes color)

### Known rough edges
- `stuckRef` debounce is 700ms (`STUCK_FEEDBACK_MS`) — could feel too long on Crazy level
- Daily mode uses the *local* date, so players in different timezones roll over at different moments

## Dev & deploy

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # serve the build locally
# deploy: drag dist/ to Netlify drop zone, or connect repo for auto-deploy
```
