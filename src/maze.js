import { MAX_ROUTE } from "./constants.js";

// Deterministic PRNG — same seed always produces the same maze (daily mode)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Recursive backtracker. Cells hold {N,S,E,W}: true = passage open on that side.
export function generateMaze(rows, cols, rng = Math.random) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ N: false, S: false, E: false, W: false }))
  );
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  function carve(r, c) {
    visited[r][c] = true;
    const dirs = [
      { dr: -1, dc: 0, d: "N", od: "S" },
      { dr: 1, dc: 0, d: "S", od: "N" },
      { dr: 0, dc: 1, d: "E", od: "W" },
      { dr: 0, dc: -1, d: "W", od: "E" },
    ];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const { dr, dc, d, od } of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        cells[r][c][d] = true;
        cells[nr][nc][od] = true;
        carve(nr, nc);
      }
    }
  }
  carve(0, 0);
  return cells;
}

// Shortest route from (r1,c1) to (r2,c2) avoiding walls and visitedSet.
// maxLen caps the lookahead during drag; pass Infinity for hints.
export function bfsRoute(maze, r1, c1, r2, c2, visitedSet, ROWS, COLS, maxLen = MAX_ROUTE) {
  if (r1 === r2 && c1 === c2) return [];
  const DIRS = [[-1, 0, "N"], [1, 0, "S"], [0, 1, "E"], [0, -1, "W"]];
  const queue = [[r1, c1, []]];
  const seen = new Set([`${r1},${c1}`]);
  while (queue.length) {
    const [r, c, path] = queue.shift();
    if (path.length >= maxLen) continue;
    for (const [dr, dc, d] of DIRS) {
      const nr = r + dr, nc = c + dc, key = `${nr},${nc}`;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen.has(key) || visitedSet.has(key) || !maze[r][c][d]) continue;
      const np = [...path, { r: nr, c: nc }];
      if (nr === r2 && nc === c2) return np;
      seen.add(key);
      queue.push([nr, nc, np]);
    }
  }
  return null;
}

export function isStuck(maze, r, c, visitedSet, ROWS, COLS) {
  const DIRS = [[-1, 0, "N"], [1, 0, "S"], [0, 1, "E"], [0, -1, "W"]];
  for (const [dr, dc, d] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visitedSet.has(`${nr},${nc}`) && maze[r][c][d]) return false;
  }
  return true;
}
