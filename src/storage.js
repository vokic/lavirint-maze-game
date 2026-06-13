const KEY = "maze.best";

// Shape: { [bestKey]: { ms, steps } }
// bestKey = difficulty (random mode) | `daily:<date>:<difficulty>` (daily mode)
export function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveBest(best) {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch { /* storage blocked — records just won't persist */ }
}

export function bestKey(mode, dateKey, difficulty) {
  return mode === "daily" ? `daily:${dateKey}:${difficulty}` : difficulty;
}
