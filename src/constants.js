export const PAD = 20;

// BFS lookahead cap while dragging — prevents "cheating" with one fast swipe
export const MAX_ROUTE = 6;

// While dragging, crossing your own path trims it ONLY within this many cells
// of the tail — passing over the middle of the path is accidental and ignored
export const BACKTRACK_WINDOW = 6;

export const STUCK_FEEDBACK_MS = 700;
export const VIBRATE_PATTERN = [60, 40, 60];

export const HINT_CELLS = 5;
export const HINT_PENALTY_MS = 10000;
export const HINT_SHOW_MS = 2000;

export const LEVELS = {
  easy:     { label: "Easy",     rows: 6,  cols: 6,  cell: 72 },
  medium:   { label: "Medium",   rows: 10, cols: 10, cell: 50 },
  advanced: { label: "Advanced", rows: 15, cols: 15, cell: 36 },
  crazy:    { label: "Crazy",    rows: 28, cols: 28, cell: 20 },
};

export const DIFF_COLORS = { easy: "#00b4ff", medium: "#ffaa00", advanced: "#ff4488", crazy: "#cc44ff" };

// Daily maze #1 = 2026-01-01 (local date)
export const DAILY_EPOCH_UTC = Date.UTC(2026, 0, 1);
