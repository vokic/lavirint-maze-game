import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import {
  PAD, LEVELS, DIFF_COLORS, BACKTRACK_WINDOW,
  STUCK_FEEDBACK_MS, VIBRATE_PATTERN,
  HINT_CELLS, HINT_PENALTY_MS, HINT_SHOW_MS,
} from "./constants.js";
import { generateMaze, bfsRoute, isStuck, mulberry32 } from "./maze.js";
import { todayKey, dailyNumber, dailySeed } from "./daily.js";
import { sound } from "./audio.js";
import { loadBest, saveBest, bestKey } from "./storage.js";

function makeMaze(difficulty, mode) {
  const { rows, cols } = LEVELS[difficulty];
  const rng = mode === "daily" ? mulberry32(dailySeed(todayKey(), difficulty)) : Math.random;
  return generateMaze(rows, cols, rng);
}

function Icon({ name, size = 13, color, style }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true"
      style={{ fontSize: size, lineHeight: 1, color, ...style }}>{name}</span>
  );
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function App() {
  const [difficulty, setDifficulty] = useState("easy");
  const [mode, setMode] = useState("random");
  const { rows: ROWS, cols: COLS, cell: CELL } = LEVELS[difficulty];

  const [maze, setMaze] = useState(() => makeMaze("easy", "random"));
  const [path, setPath] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [won, setWon] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [hint, setHint] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [finalMs, setFinalMs] = useState(null);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [best, setBest] = useState(() => loadBest());
  const [muted, setMutedState] = useState(() => sound.isMuted());
  // Save Trace OFF = the trace vanishes when the finger/mouse lifts (one-stroke play)
  const [saveTrace, setSaveTrace] = useState(() => {
    try { return localStorage.getItem("maze.saveTrace") === "1"; } catch { return false; }
  });
  const [copied, setCopied] = useState(false);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const svgRef = useRef(null);
  const pathRef = useRef([]);
  const stuckRef = useRef(false);
  const hintTimerRef = useRef(null);

  const svgW = COLS * CELL + PAD * 2;
  const svgH = ROWS * CELL + PAD * 2;

  const resetRun = () => {
    pathRef.current = []; setPath([]); setWon(false); setDragging(false);
    setStuck(false); stuckRef.current = false;
    setHint(null); clearTimeout(hintTimerRef.current);
    setStartedAt(null); setFinalMs(null); setPenaltyMs(0);
    setHintsUsed(0); setIsNewBest(false);
  };
  const startFresh = () => {
    setStartedAt(null); setFinalMs(null); setPenaltyMs(0);
    setHintsUsed(0); setIsNewBest(false);
  };

  const changeDifficulty = (d) => {
    if (d === difficulty) return;
    setDifficulty(d); setMaze(makeMaze(d, mode)); resetRun();
  };
  // Difficulty never advances on its own — next maze stays on the chosen level
  const nextLevel = () => {
    if (mode === "daily") changeMode("random"); // the day's maze is done — continue in random
    else reset();
  };
  const replay = () => resetRun(); // same maze, fresh attempt
  const changeMode = (m) => {
    if (m === mode) return;
    setMode(m); setMaze(makeMaze(difficulty, m)); resetRun();
  };
  const reset = () => { setMaze(makeMaze(difficulty, mode)); resetRun(); };
  const clearPath = () => resetRun();

  // Timer starts on the first traced cell of an attempt
  useEffect(() => {
    if (path.length > 0 && startedAt == null && !won) setStartedAt(Date.now());
  }, [path, startedAt, won]);

  const running = startedAt != null && !won;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNowTs(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);
  const elapsedMs = finalMs != null
    ? finalMs
    : (running ? Math.max(0, nowTs - startedAt) : 0) + penaltyMs;

  // Win: freeze time, save record, fanfare (layout effect = banner never paints without the time)
  useLayoutEffect(() => {
    if (!won) return;
    const ms = (startedAt != null ? Date.now() - startedAt : 0) + penaltyMs;
    setFinalMs(ms);
    const steps = pathRef.current.length - 1;
    const key = bestKey(mode, todayKey(), difficulty);
    setBest((b) => {
      const cur = b[key];
      if (cur && cur.ms <= ms) return b;
      setIsNewBest(true);
      const nb = { ...b, [key]: { ms, steps } };
      saveBest(nb);
      return nb;
    });
    sound.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  // Win overlay appears after a beat so the finished path stays visible first
  useEffect(() => {
    if (!won) { setShowWinOverlay(false); return; }
    const id = setTimeout(() => setShowWinOverlay(true), 600);
    return () => clearTimeout(id);
  }, [won]);

  const confetti = useMemo(() => {
    if (!showWinOverlay) return null;
    const colors = ["#00ffb4", "#00b4ff", "#ffaa00", "#ff4488", "#cc44ff", "#ffcc00"];
    return Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 2.2 + Math.random() * 2,
      color: colors[i % colors.length],
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
    }));
  }, [showWinOverlay]);

  // Enter / Space on the win screen jumps to the next level
  useEffect(() => {
    if (!showWinOverlay) return;
    const onKey = (e) => {
      if (e.code !== "Enter" && e.code !== "Space") return;
      e.preventDefault();
      nextLevel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const triggerStuck = useCallback(() => {
    if (stuckRef.current) return;
    stuckRef.current = true;
    setStuck(true);
    sound.stuck();
    if (navigator.vibrate) navigator.vibrate(VIBRATE_PATTERN);
    setTimeout(() => { setStuck(false); stuckRef.current = false; }, STUCK_FEEDBACK_MS);
  }, []);

  const getCell = useCallback((cx, cy) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width) return null;
    const scale = rect.width / svgW; // SVG scales down via viewBox on narrow screens
    const x = (cx - rect.left) / scale - PAD;
    const y = (cy - rect.top) / scale - PAD;
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
  }, [ROWS, COLS, CELL, svgW]);

  const handleStart = useCallback((cx, cy) => {
    const cell = getCell(cx, cy);
    if (!cell) return;
    const vIdx = pathRef.current.findIndex((p) => p.r === cell.r && p.c === cell.c);
    if (vIdx >= 0) {
      if (won) startFresh();
      const next = pathRef.current.slice(0, vIdx + 1);
      pathRef.current = next; setPath([...next]);
      setDragging(true); setWon(false); setStuck(false); stuckRef.current = false;
      return;
    }
    if (cell.r === 0 && cell.c === 0) {
      if (won) startFresh();
      const init = [{ r: 0, c: 0 }];
      pathRef.current = init; setPath(init);
      setDragging(true); setWon(false); setStuck(false); stuckRef.current = false;
    }
  }, [getCell, won]);

  const handleMove = useCallback((cx, cy) => {
    if (!dragging) return;
    const cell = getCell(cx, cy);
    if (!cell) return;
    const prev = pathRef.current;
    if (!prev.length) return;
    const last = prev[prev.length - 1];
    if (last.r === cell.r && last.c === cell.c) return;

    const vIdx = prev.findIndex((p) => p.r === cell.r && p.c === cell.c);
    if (vIdx >= 0) {
      // Backtracking retraces the tail cell by cell; a pointer crossing
      // the middle of the path mid-drag is accidental — ignore it
      if (vIdx >= prev.length - 1 - BACKTRACK_WINDOW) {
        const next = prev.slice(0, vIdx + 1);
        pathRef.current = next; setPath([...next]);
        setStuck(false); stuckRef.current = false;
      }
      return;
    }

    const visitedSet = new Set(prev.map((p) => `${p.r},${p.c}`));
    const route = bfsRoute(maze, last.r, last.c, cell.r, cell.c, visitedSet, ROWS, COLS);

    if (route && route.length > 0) {
      const next = [...prev, ...route];
      pathRef.current = next; setPath([...next]);
      setStuck(false); stuckRef.current = false;
      sound.step();
      const fin = route[route.length - 1];
      if (fin.r === ROWS - 1 && fin.c === COLS - 1) { setWon(true); setDragging(false); }
    } else if (isStuck(maze, last.r, last.c, visitedSet, ROWS, COLS)) {
      triggerStuck();
    }
  }, [dragging, getCell, maze, ROWS, COLS, triggerStuck]);

  const handleEnd = useCallback(() => {
    setDragging(false);
    // Trace is not kept between strokes unless Save Trace is on (timer keeps running)
    if (!saveTrace && !won && pathRef.current.length) {
      pathRef.current = []; setPath([]);
      setStuck(false); stuckRef.current = false;
    }
  }, [saveTrace, won]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => handleMove(e.clientX, e.clientY);
    const onUp = () => handleEnd();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, handleMove, handleEnd]);

  // Keyboard: arrows / WASD move one cell; stepping onto the previous cell backtracks
  const moveDir = useCallback((d) => {
    if (won) return;
    const DELTA = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };
    let prev = pathRef.current;
    if (!prev.length) prev = [{ r: 0, c: 0 }];
    const last = prev[prev.length - 1];
    const [dr, dc] = DELTA[d];
    const nr = last.r + dr, nc = last.c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    if (!maze[last.r][last.c][d]) return;
    const isBack = prev.length > 1 && prev[prev.length - 2].r === nr && prev[prev.length - 2].c === nc;
    let next;
    if (isBack) {
      next = prev.slice(0, prev.length - 1);
    } else {
      if (prev.some((p) => p.r === nr && p.c === nc)) return;
      next = [...prev, { r: nr, c: nc }];
    }
    pathRef.current = next; setPath([...next]);
    setStuck(false); stuckRef.current = false;
    sound.step();
    const fin = next[next.length - 1];
    if (fin.r === ROWS - 1 && fin.c === COLS - 1) { setWon(true); setDragging(false); return; }
    if (!isBack) {
      const visitedSet = new Set(next.map((p) => `${p.r},${p.c}`));
      if (isStuck(maze, fin.r, fin.c, visitedSet, ROWS, COLS)) triggerStuck();
    }
  }, [won, maze, ROWS, COLS, triggerStuck]);

  useEffect(() => {
    const KEYMAP = {
      ArrowUp: "N", KeyW: "N", ArrowDown: "S", KeyS: "S",
      ArrowLeft: "W", KeyA: "W", ArrowRight: "E", KeyD: "E",
    };
    const onKey = (e) => {
      const d = KEYMAP[e.code];
      if (!d) return;
      e.preventDefault();
      moveDir(d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveDir]);

  // Hint: light up the next cells of the true shortest route (walls only,
  // ignores the traced path — leading back through it means "backtrack")
  const showHint = () => {
    if (won) return;
    const prev = pathRef.current;
    const from = prev.length ? prev[prev.length - 1] : { r: 0, c: 0 };
    const route = bfsRoute(maze, from.r, from.c, ROWS - 1, COLS - 1, new Set(), ROWS, COLS, Infinity);
    if (!route || !route.length) return;
    setHint(route.slice(0, HINT_CELLS));
    setPenaltyMs((p) => p + HINT_PENALTY_MS);
    setHintsUsed((h) => h + 1);
    sound.hint();
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(null), HINT_SHOW_MS);
  };

  const toggleMute = () => {
    sound.setMuted(!muted);
    setMutedState(!muted);
  };

  const toggleSaveTrace = () => {
    setSaveTrace((s) => {
      const next = !s;
      try { localStorage.setItem("maze.saveTrace", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const shareDaily = async () => {
    const steps = pathRef.current.length - 1;
    let txt = `MAZE Daily #${dailyNumber()} · ${LEVELS[difficulty].label} · ${fmtTime(finalMs ?? 0)} · ${steps} steps`;
    if (hintsUsed > 0) txt += ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}`;
    try {
      if (navigator.share) { await navigator.share({ text: txt }); return; }
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* share cancelled or clipboard blocked */ }
  };

  // Walls dedup by geometry — neighbours describe the same wall from both sides
  const walls = useMemo(() => {
    const wallSet = new Set(), out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = PAD + c * CELL, y = PAD + r * CELL, cell = maze[r][c];
      const add = (x1, y1, x2, y2) => {
        const key = `${x1},${y1},${x2},${y2}`;
        if (!wallSet.has(key)) { wallSet.add(key); out.push({ key, x1, y1, x2, y2 }); }
      };
      if (!cell.N) add(x, y, x + CELL, y);
      if (!cell.S) add(x, y + CELL, x + CELL, y + CELL);
      if (!cell.W) add(x, y, x, y + CELL);
      if (!cell.E) add(x + CELL, y, x + CELL, y + CELL);
    }
    return out;
  }, [maze, ROWS, COLS, CELL]);

  const startPt = { x: PAD + CELL / 2, y: PAD + CELL / 2 };
  const endPt = { x: PAD + (COLS - 1) * CELL + CELL / 2, y: PAD + (ROWS - 1) * CELL + CELL / 2 };
  const polyPts = path.map((p) => `${PAD + p.c * CELL + CELL / 2},${PAD + p.r * CELL + CELL / 2}`).join(" ");
  const lastCell = path.length > 0 ? path[path.length - 1] : null;
  const lastPt = lastCell ? { x: PAD + lastCell.c * CELL + CELL / 2, y: PAD + lastCell.r * CELL + CELL / 2 } : null;

  const dotR = Math.max(1.5, CELL / 18);
  const nodeR = Math.max(7, CELL / 5);
  const pathW = Math.max(1.5, CELL / 16);
  const glowW = Math.max(4, CELL / 7);
  const wallW = CELL >= 50 ? 2 : CELL >= 30 ? 1.5 : 1;
  const accent = DIFF_COLORS[difficulty];

  const bestEntry = best[bestKey(mode, todayKey(), difficulty)];
  const steps = Math.max(0, path.length - 1);

  const btnStyle = (active, color) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "8px 18px",
    background: active ? `${color}22` : "transparent",
    color: active ? color : `${color}88`,
    border: `1px solid ${active ? color : color + "44"}`,
    borderRadius: 6, cursor: "pointer",
    fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "'Courier New', monospace",
    transition: "all 0.2s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#080c14", fontFamily: "'Courier New',monospace",
      userSelect: "none", padding: 16, gap: 0 }}>

      {/* Title */}
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: "#3a5a7a", textTransform: "uppercase", marginBottom: 3 }}>
          {mode === "daily" ? `daily maze #${dailyNumber()}` : "trace the path"}
        </div>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#e0f0ff", letterSpacing: 2 }}>MAZE</div>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button style={btnStyle(mode === "random", "#3a7aaa")} onClick={() => changeMode("random")}>Random</button>
        <button style={btnStyle(mode === "daily", "#00ffb4")} onClick={() => changeMode("daily")}>Daily #{dailyNumber()}</button>
      </div>

      {/* Difficulty selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {Object.entries(LEVELS).map(([key, { label }]) => (
          <button key={key} style={btnStyle(difficulty === key, DIFF_COLORS[key])}
            onClick={() => changeDifficulty(key)}>{label}</button>
        ))}
      </div>

      {/* Maze SVG */}
      <div style={{ width: "100%", maxWidth: svgW, borderRadius: 10, background: "#0d1520", overflow: "hidden",
        transition: "border-color 0.2s,box-shadow 0.2s",
        border: `1px solid ${stuck ? "rgba(255,80,80,0.5)" : "#1a2d45"}`,
        boxShadow: stuck
          ? "0 0 30px rgba(255,60,60,0.2),0 16px 48px rgba(0,0,0,0.7)"
          : "0 0 32px rgba(0,120,255,0.07),0 16px 48px rgba(0,0,0,0.7)" }}>
        <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: "block", width: "100%", height: "auto", touchAction: "none", cursor: "crosshair" }}
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onTouchStart={(e) => { e.preventDefault(); handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchEnd={handleEnd}
          onTouchCancel={handleEnd}>
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="glowS"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="glowR"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={won ? "#00ffb4" : accent} />
              <stop offset="100%" stopColor={won ? "#00ff80" : "#7b61ff"} />
            </linearGradient>
          </defs>

          {/* Visited-cell highlights */}
          {path.map((p) => (
            <rect key={`bg${p.r},${p.c}`} x={PAD + p.c * CELL + 1} y={PAD + p.r * CELL + 1}
              width={CELL - 2} height={CELL - 2} fill="rgba(0,180,255,0.05)" />
          ))}

          {/* Hint cells */}
          {hint && hint.map((p, i) => (
            <circle key={`h${i}`} cx={PAD + p.c * CELL + CELL / 2} cy={PAD + p.r * CELL + CELL / 2}
              r={Math.max(3, CELL / 6)} fill="rgba(255,204,0,0.15)" stroke="#ffcc00"
              strokeWidth={1} opacity={Math.max(0.25, 1 - i * 0.15)} />
          ))}

          {/* Path */}
          {path.length > 1 && <>
            <polyline points={polyPts} fill="none" stroke={won ? "#00ffb4" : stuck ? "#ff4040" : accent}
              strokeWidth={glowW} strokeLinecap="round" strokeLinejoin="round" opacity={0.12} />
            <polyline points={polyPts} fill="none" stroke={won ? "#00ffb4" : stuck ? "#ff6060" : "url(#pg)"}
              strokeWidth={pathW} strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
          </>}

          {/* Path dots */}
          {path.map((p, i) => {
            if (i === 0) return null;
            const x = PAD + p.c * CELL + CELL / 2, y = PAD + p.r * CELL + CELL / 2;
            return <circle key={`d${i}`} cx={x} cy={y} r={dotR} fill={won ? "#00ffb4" : accent + "bb"} />;
          })}

          {/* Stuck ring */}
          {stuck && lastPt && <circle cx={lastPt.x} cy={lastPt.y} r={nodeR * 0.9}
            fill="none" stroke="#ff4040" strokeWidth={1.5} filter="url(#glowR)"
            style={{ animation: "stuckPulse 0.3s ease infinite" }} />}

          {/* Walls */}
          {walls.map(({ key, x1, y1, x2, y2 }) => (
            <line key={key} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#1e3550" strokeWidth={wallW} strokeLinecap="square" />
          ))}

          {/* Border */}
          <rect x={PAD} y={PAD} width={COLS * CELL} height={ROWS * CELL} fill="none" stroke="#2a4a6a" strokeWidth={2} />

          {/* Current position */}
          {lastPt && path.length > 1 && !won && <circle cx={lastPt.x} cy={lastPt.y} r={nodeR * 0.6}
            fill={stuck ? "rgba(255,60,60,0.25)" : accent + "33"}
            stroke={stuck ? "#ff6060" : accent} strokeWidth={1.2} filter="url(#glow)" />}

          {/* S node */}
          <circle cx={startPt.x} cy={startPt.y} r={nodeR} fill="rgba(0,255,100,0.1)" stroke="#00ff80" strokeWidth={1.5} />
          <text x={startPt.x} y={startPt.y + 4} textAnchor="middle" fontSize={Math.max(9, CELL / 6)} fill="#00ff80">S</text>

          {/* E node */}
          <circle cx={endPt.x} cy={endPt.y} r={nodeR}
            fill={won ? "rgba(0,255,180,0.2)" : "rgba(255,200,0,0.08)"}
            stroke={won ? "#00ffb4" : "#ffcc00"} strokeWidth={1.5} filter={won ? "url(#glowS)" : undefined} />
          <text x={endPt.x} y={endPt.y + 4} textAnchor="middle" fontSize={Math.max(9, CELL / 6)} fill={won ? "#00ffb4" : "#ffcc00"}>E</text>
        </svg>
      </div>

      {/* Status */}
      <div style={{ marginTop: 12, fontSize: 10, color: stuck ? "#ff6060" : "#2a4a6a",
        letterSpacing: 2, textAlign: "center", transition: "color 0.2s", minHeight: 18 }}>
        {stuck ? "DEAD END — BACKTRACK" :
          path.length === 0 ? "DRAG FROM  S  TO REACH  E  (OR USE ARROWS / WASD)" :
          won ? "PATH FOUND — WELL DONE" :
          `CELLS TRACED: ${path.length}`}
      </div>

      {/* Stats */}
      <div style={{ marginTop: 6, fontSize: 10, color: "#3a5a7a", letterSpacing: 2, textAlign: "center", minHeight: 16 }}>
        TIME {fmtTime(elapsedMs)} · STEPS {steps}
        {bestEntry && <> · BEST {fmtTime(bestEntry.ms)}</>}
        {hintsUsed > 0 && <> · HINTS {hintsUsed}</>}
      </div>

      {/* Controls */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {mode === "random" && (
          <button style={btnStyle(false, "#3a7aaa")} onClick={reset}>
            <Icon name="refresh" />New Maze
          </button>
        )}
        <button style={btnStyle(false, "#3a7a3a")} onClick={clearPath}>
          <Icon name="undo" />Reset Path
        </button>
        <button style={btnStyle(false, "#aa8a3a")} onClick={showHint}>
          <Icon name="lightbulb" />Hint +10s
        </button>
        <button style={btnStyle(false, "#5a5a7a")} onClick={toggleMute}>
          <Icon name={muted ? "volume_off" : "volume_up"} />{muted ? "Sound: Off" : "Sound: On"}
        </button>
        <button style={btnStyle(saveTrace, "#5a7a9a")} onClick={toggleSaveTrace}
          title="On: the trace stays when you lift your finger. Off: lifting clears it — solve in one stroke.">
          <Icon name="save" />{saveTrace ? "Save Trace: On" : "Save Trace: Off"}
        </button>
      </div>

      {/* Win overlay — backdrop click dismisses so the maze can be admired */}
      {showWinOverlay && (
        <div onClick={() => setShowWinOverlay(false)}
          style={{ position: "fixed", inset: 0, zIndex: 10, background: "rgba(8,12,20,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.3s ease", overflow: "hidden" }}>

          {confetti.map((p, i) => (
            <div key={i} style={{ position: "absolute", top: "-6vh", left: `${p.left}%`,
              width: p.w, height: p.h, background: p.color, borderRadius: 2,
              animation: `confettiFall ${p.dur}s linear ${p.delay}s forwards`, opacity: 0 }} />
          ))}

          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", background: "#0d1520", borderRadius: 16,
              border: "1px solid rgba(0,255,180,0.4)", padding: "32px 40px", textAlign: "center",
              boxShadow: "0 0 60px rgba(0,255,180,0.15), 0 24px 64px rgba(0,0,0,0.8)",
              animation: "popIn 0.35s ease", maxWidth: "90vw" }}>

            <div style={{ animation: "trophyBounce 0.6s ease", marginBottom: 8 }}>
              <Icon name="emoji_events" size={48} color="#ffcc00"
                style={{ filter: "drop-shadow(0 0 12px rgba(255,204,0,0.45))" }} />
            </div>
            <div style={{ fontSize: 18, letterSpacing: 5, color: "#00ffb4", marginBottom: 6 }}>✦ ESCAPED ✦</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#5a7a9a", marginBottom: 4 }}>
              {LEVELS[difficulty].label.toUpperCase()}{mode === "daily" && ` · DAILY #${dailyNumber()}`}
            </div>

            <div style={{ fontSize: 13, letterSpacing: 2, color: "#e0f0ff", margin: "14px 0" }}>
              TIME {fmtTime(finalMs ?? 0)} · {steps} STEPS
              {hintsUsed > 0 && <> · {hintsUsed} HINT{hintsUsed > 1 ? "S" : ""}</>}
            </div>
            {isNewBest
              ? <div style={{ fontSize: 12, letterSpacing: 3, color: "#ffcc00", marginBottom: 18 }}>★ NEW BEST ★</div>
              : bestEntry && <div style={{ fontSize: 10, letterSpacing: 2, color: "#3a5a7a", marginBottom: 18 }}>BEST {fmtTime(bestEntry.ms)}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={btnStyle(false, "#3a7aaa")} onClick={replay}>
                <Icon name="replay" />Replay
              </button>
              <button style={btnStyle(true, "#00ffb4")} onClick={nextLevel}>
                {mode === "daily" ? "Random Mode" : "Next Maze"}
                <Icon name="arrow_forward" />
              </button>
              {mode === "daily" && (
                <button style={btnStyle(false, "#00b4ff")} onClick={shareDaily}>
                  <Icon name={copied ? "check" : "share"} />{copied ? "Copied!" : "Share"}
                </button>
              )}
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#2a4a6a", marginTop: 14 }}>PRESS ENTER FOR NEXT</div>
          </div>
        </div>
      )}
    </div>
  );
}
