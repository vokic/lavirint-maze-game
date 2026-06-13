import { DAILY_EPOCH_UTC } from "./constants.js";

// Local calendar date as "YYYY-MM-DD" — everyone on the same date gets the same maze
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dailyNumber(key = todayKey()) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - DAILY_EPOCH_UTC) / 86400000) + 1;
}

// FNV-1a hash of "date:difficulty" → 32-bit seed
export function dailySeed(key, difficulty) {
  const s = `${key}:${difficulty}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
