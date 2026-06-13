let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem("maze.muted") === "1";
} catch { /* storage blocked — keep sound on */ }

function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur, type = "sine", gain = 0.04, delay = 0) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sound = {
  isMuted: () => muted,
  setMuted(m) {
    muted = m;
    try { localStorage.setItem("maze.muted", m ? "1" : "0"); } catch { /* ignore */ }
  },
  step()  { tone(520, 0.05, "square", 0.012); },
  stuck() { tone(140, 0.18, "sawtooth", 0.04); },
  hint()  { tone(700, 0.1, "sine", 0.03); },
  win()   { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.18, "triangle", 0.05, i * 0.09)); },
};
