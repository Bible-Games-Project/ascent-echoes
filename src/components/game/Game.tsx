import { useEffect, useRef, useState } from "react";
import {
  buildLevelQuestions,
  timePerQuestionForLevel,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
  type GameQuestion,
} from "./questionBank";
import {
  fetchRank,
  fetchTop10,
  fetchPlayerEntry,
  getLocalBest,
  getPlayerName,
  NAME_MAX,
  NAME_MIN,
  setPlayerName as savePlayerName,
  submitIfBest,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

type GameState = "start" | "playing" | "gameover";
type Lane = 0 | 1 | 2; // 0 left, 1 center, 2 right

function formatRunTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (m > 0) return `${m}:${pad(s)}`;
  return pad(s);
}

interface FallingDecision {
  y: number; // world Y position of the falling object (in screen px)
  safe: Lane;
  question: string;
  answers: [string, string, string];
  resolved: boolean;
  // Resolution visuals (single falling object)
  outcome: null | "correct" | "wrong";
  outcomeAnim: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

type PowerupType = "star" | "heart" | "slow" | "hint" | "apple" | "broken";

interface Powerup {
  y: number;
  lane: Lane;
  type: PowerupType;
  taken: boolean;
  bobSeed: number;
}

const multiplierForStreak = (s: number): number => {
  if (s >= 30) return 5;
  if (s >= 20) return 4;
  if (s >= 10) return 3;
  if (s >= 5) return 2;
  return 1;
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>("start");
  const [health, setHealth] = useState(3);
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<[string, string, string] | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplierToast, setMultiplierToast] = useState<number | null>(null);
  const [hintLane, setHintLane] = useState<Lane | null>(null);
  const [distortion, setDistortion] = useState(0);
  const [runTime, setRunTime] = useState(0);
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("dunewalker_lang");
      if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Language;
    } catch { /* ignore */ }
    return "en";
  });

  // Leaderboard / player identity
  const [playerName, setPlayerNameState] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [topTen, setTopTen] = useState<LeaderboardEntry[] | null>(null);
  const [worldRank, setWorldRank] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [enteredTop10, setEnteredTop10] = useState(false);
  const [isWorldRecord, setIsWorldRecord] = useState(false);

  const stateRef = useRef<GameState>("start");
  const healthRef = useRef(3);
  const progressRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestRef = useRef(0);
  const levelRef = useRef(1);
  const runTimeRef = useRef(0);
  const languageRef = useRef<Language>(language);
  const usedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => {
    languageRef.current = language;
    try { localStorage.setItem("dunewalker_lang", language); } catch { /* ignore */ }
  }, [language]);

  useEffect(() => {
    try {
      const b = parseInt(localStorage.getItem("dunewalker_best") || "0", 10);
      if (!isNaN(b)) { bestRef.current = b; setBestScore(b); }
    } catch { /* ignore */ }
  }, []);

  // On mount: load player name; if none, prompt before letting them start.
  useEffect(() => {
    const n = getPlayerName();
    setPlayerNameState(n);
    if (!n) setShowNamePrompt(true);
  }, []);

  // When game ends: submit if new best, refresh leaderboard + rank.
  useEffect(() => {
    if (state !== "gameover") return;
    let cancelled = false;
    const prevBest = getLocalBest();
    const finalScore = scoreRef.current;
    setIsNewBest(false);
    setEnteredTop10(false);
    setIsWorldRecord(false);
    setWorldRank(null);
    (async () => {
      // Always sync the player's best to the server so the global leaderboard
      // reflects them. The RPC uses GREATEST, so resubmitting is idempotent.
      let bestForRank = Math.max(prevBest, finalScore);
      if (bestForRank > 0) {
        const res = await submitIfBest(bestForRank);
        if (cancelled) return;
        if (res.best > 0) {
          bestForRank = res.best;
          bestRef.current = res.best;
          setBestScore(res.best);
        }
        if (finalScore > prevBest) setIsNewBest(true);
        if (res.rank != null) {
          setWorldRank(res.rank);
          setEnteredTop10(res.rank <= 10);
          setIsWorldRecord(res.rank === 1);
        }
      }

      // Always refresh the top 10 (after any submission) for display.
      const top = await fetchTop10();
      if (cancelled) return;

      // Make sure the current player appears in the displayed ranking.
      let merged: LeaderboardEntry[] = top;
      const playerEntry = await fetchPlayerEntry();
      if (!cancelled && playerEntry && playerEntry.best_score > 0) {
        const inTop = top.some((e) => e.player_id === playerEntry.player_id);
        if (!inTop) {
          merged = [...top, playerEntry]
            .sort((a, b) => b.best_score - a.best_score)
            .slice(0, 11);
        }
      }
      if (cancelled) return;
      setTopTen(merged);
      console.debug("[leaderboard] render entries:", merged.length,
        "playerFound:", !!playerEntry, "ranking:", merged);

      // Compute rank from the player's authoritative best if not already set.
      if (worldRank == null && bestForRank > 0) {
        const r = await fetchRank(bestForRank);
        if (!cancelled && r != null) setWorldRank(r);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let W = 0;
    let H = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ----- World state -----
    let bgDrift = 0; // for subtle background animation
    let slowTimer = 0;
    let distortTimer = 0;
    let hintActive: Lane | null = null;
    let shake = 0;
    let flash = 0;
    let invuln = 0;
    let turboHeld = false;
    const TURBO_MULT = 3;

    // Player (bottom of screen)
    const PLAYER_Y_FRAC = 0.82;
    const RESOLVE_LINE_FRAC = 0.78; // where falling objects resolve
    const laneX = (lane: Lane) => W * [0.2, 0.5, 0.8][lane];
    const playerY = () => H * PLAYER_Y_FRAC;

    const player = {
      lane: 1 as Lane,
      targetLane: 1 as Lane,
      x: 0,
      knock: 0, // y knockback
    };

    // Decisions queue: a flat list, only the first unresolved one is "active"
    // and visibly falling. The next one spawns after the current resolves.
    let queue: FallingDecision[] = [];
    let activeIdx = 0;
    const powerups: Powerup[] = [];
    let questionTimer = 0;
    let powerupTimer = 0;
    const currentQuestionRef = { current: null as string | null };

    const fallSpeed = () => {
      // Time per question maps to how long the object takes to fall from
      // top to resolve line. Distance ≈ H * (RESOLVE_LINE_FRAC + 0.1).
      const t = timePerQuestionForLevel(levelRef.current);
      const dist = H * (RESOLVE_LINE_FRAC + 0.1);
      const base = dist / Math.max(1, t);
      const slowMul = slowTimer > 0 ? 0.5 : 1;
      const turboMul = turboHeld ? TURBO_MULT : 1;
      return base * slowMul * turboMul;
    };

    const pickType = (): PowerupType => {
      const r = Math.random();
      if (r < 0.45) return Math.random() < 0.5 ? "star" : "heart";
      if (r < 0.9) return Math.random() < 0.5 ? "slow" : "hint";
      return Math.random() < 0.5 ? "apple" : "broken";
    };

    const spawnPowerup = () => {
      powerups.push({
        y: -40,
        lane: Math.floor(Math.random() * 3) as Lane,
        type: pickType(),
        taken: false,
        bobSeed: Math.random() * Math.PI * 2,
      });
    };

    let bonusesThisLevel = 0;
    let bonusSinceDecision = false;

    const buildLevel = (lvl: number) => {
      const qs: GameQuestion[] = buildLevelQuestions(lvl, languageRef.current, usedIdsRef.current);
      queue = qs.map((item) => ({
        y: -120,
        safe: item.safe as Lane,
        question: item.prompt,
        answers: item.answers,
        resolved: false,
        outcome: null,
        outcomeAnim: 0,
      }));
      activeIdx = 0;
      powerups.length = 0;
      questionTimer = timePerQuestionForLevel(lvl);
      powerupTimer = 1.2 + Math.random() * 1.5;
      bonusesThisLevel = 0;
      bonusSinceDecision = false;
      currentQuestionRef.current = null;
      setCurrentQuestion(null);
      setCurrentAnswers(null);
      setProgress(0);
      progressRef.current = 0;
      // questionTimer still drives internal pacing/difficulty; no visual timer to update
    };

    // Particles
    const particles: Particle[] = [];
    const spawnDust = (x: number, y: number, n = 1) => {
      for (let i = 0; i < n; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 60,
          vy: -10 - Math.random() * 20,
          life: 0, max: 0.6 + Math.random() * 0.6,
          color: "rgba(255, 220, 170, 0.6)", size: 1 + Math.random() * 2,
        });
      }
    };
    const spawnImpact = (x: number, y: number) => {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 220;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.5 + Math.random() * 0.5, color: "rgba(255, 120, 80, 0.9)", size: 2 + Math.random() * 3 });
      }
    };
    const spawnPickupBurst = (x: number, y: number, color: string) => {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 140;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.5 + Math.random() * 0.4, color, size: 1.5 + Math.random() * 2 });
      }
    };

    // ----- Background -----
    const drawSky = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#ffb178");
      g.addColorStop(0.4, "#ff8c61");
      g.addColorStop(0.75, "#c75b7a");
      g.addColorStop(1, "#5b3a78");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const sunY = H * 0.4;
      const sunX = W * 0.72;
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.6);
      sg.addColorStop(0, "rgba(255, 240, 200, 0.9)");
      sg.addColorStop(0.15, "rgba(255, 200, 140, 0.5)");
      sg.addColorStop(1, "rgba(255, 140, 100, 0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);

      ctx.beginPath();
      ctx.fillStyle = "#fff2c8";
      ctx.arc(sunX, sunY, Math.min(W, H) * 0.09, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawDunes = (offset: number, amp: number, baseY: number, color: string, freq: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const y = baseY + Math.sin((x + offset) * freq) * amp + Math.sin((x + offset) * freq * 2.3) * amp * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };

    const drawBackground = () => {
      drawSky();
      drawDunes(-bgDrift * 0.4, 18, H * 0.62, "rgba(120, 60, 100, 0.55)", 0.006);
      drawDunes(-bgDrift * 0.7, 26, H * 0.7, "rgba(80, 40, 80, 0.7)", 0.009);
      drawDunes(-bgDrift * 1.0, 34, H * 0.78, "rgba(50, 25, 60, 0.85)", 0.012);
    };

    // Single ground platform at bottom
    const drawGround = () => {
      const platTop = H * PLAYER_Y_FRAC + 22;
      const platH = 18;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, platTop + platH, W, 8);
      const g = ctx.createLinearGradient(0, platTop, 0, platTop + platH);
      g.addColorStop(0, "#3a2540");
      g.addColorStop(1, "#1a0f25");
      ctx.fillStyle = g;
      ctx.fillRect(0, platTop, W, platH);
      ctx.fillStyle = "rgba(255, 180, 120, 0.5)";
      ctx.fillRect(0, platTop, W, 2);

      // Subtle lane guide lines rising from platform
      for (let i = 0; i < 3; i++) {
        const lx = laneX(i as Lane);
        const lg = ctx.createLinearGradient(lx, 0, lx, platTop);
        lg.addColorStop(0, "rgba(255, 230, 180, 0)");
        lg.addColorStop(1, "rgba(255, 230, 180, 0.08)");
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 24, 0, 48, platTop);
      }
    };

    // Single falling "question" rune - one and only one interactive object.
    const RUNE_R = 22;
    const drawRune = (cx: number, cy: number, glow: number) => {
      // outer halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, RUNE_R * 2.4);
      halo.addColorStop(0, `rgba(255, 220, 160, ${0.45 * glow})`);
      halo.addColorStop(1, "rgba(255, 220, 160, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - RUNE_R * 2.4, cy - RUNE_R * 2.4, RUNE_R * 4.8, RUNE_R * 4.8);
      // stone body
      const g = ctx.createLinearGradient(cx, cy - RUNE_R, cx, cy + RUNE_R);
      g.addColorStop(0, "#7a5840");
      g.addColorStop(1, "#2a1810");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, RUNE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 230, 180, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // sigil
      ctx.strokeStyle = `rgba(255, 240, 200, ${0.85 * glow})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 6);
      ctx.lineTo(cx + 8, cy - 6);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.moveTo(cx - 6, cy + 6);
      ctx.lineTo(cx + 6, cy + 6);
      ctx.stroke();
    };

    const drawActiveDecision = (dt: number) => {
      const d = queue[activeIdx];
      if (!d) return;
      const cx = W / 2; // falls down the center column
      if (d.outcome) {
        d.outcomeAnim = Math.min(1, d.outcomeAnim + dt * 3.2);
        const a = 1 - d.outcomeAnim;
        ctx.globalAlpha = a;
        if (d.outcome === "correct") {
          // soft expanding ring at player position
          const px = player.x;
          const py = playerY() - 18;
          ctx.strokeStyle = "rgba(255, 240, 180, 0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 20 + d.outcomeAnim * 40, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // shattered fragments at impact
          for (let s = 0; s < 6; s++) {
            const ang = (s / 6) * Math.PI * 2;
            const r = d.outcomeAnim * 36;
            const fx = cx + Math.cos(ang) * r;
            const fy = d.y + Math.sin(ang) * r;
            ctx.fillStyle = "#3a2a22";
            ctx.fillRect(fx - 5, fy - 6, 10, 12);
          }
        }
        ctx.globalAlpha = 1;
        return;
      }
      const glow = 0.7 + 0.3 * Math.sin(performance.now() / 220);
      drawRune(cx, d.y, glow);
    };

    // ----- Powerups -----
    const drawPowerupIcon = (type: PowerupType) => {
      switch (type) {
        case "star": {
          ctx.fillStyle = "#ffe27a";
          ctx.strokeStyle = "rgba(120,80,0,0.6)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const ang = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 === 0 ? 12 : 5;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke(); break;
        }
        case "heart": {
          ctx.fillStyle = "#ff5c6c";
          ctx.strokeStyle = "rgba(80,10,20,0.7)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.bezierCurveTo(12, -2, 8, -12, 0, -5);
          ctx.bezierCurveTo(-8, -12, -12, -2, 0, 8);
          ctx.closePath(); ctx.fill(); ctx.stroke(); break;
        }
        case "slow": {
          ctx.fillStyle = "#bfe7ff";
          ctx.strokeStyle = "rgba(20,60,90,0.8)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-9, -10); ctx.lineTo(9, -10); ctx.lineTo(-9, 10); ctx.lineTo(9, 10);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "rgba(20,60,90,0.85)";
          ctx.fillRect(-10, -12, 20, 2);
          ctx.fillRect(-10, 10, 20, 2); break;
        }
        case "hint": {
          ctx.fillStyle = "#fff6c8";
          ctx.strokeStyle = "rgba(150,110,20,0.7)";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, -2, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "rgba(120,80,20,0.85)";
          ctx.fillRect(-5, 7, 10, 3);
          ctx.fillRect(-3, 10, 6, 2);
          ctx.strokeStyle = "rgba(255,240,180,0.85)";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12 - 2);
            ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16 - 2);
            ctx.stroke();
          }
          break;
        }
        case "apple": {
          ctx.fillStyle = "#7a1f2a";
          ctx.strokeStyle = "rgba(20,0,5,0.9)";
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.beginPath(); ctx.arc(7, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#3a2010"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, -13); ctx.stroke();
          ctx.fillStyle = "rgba(120, 200, 80, 0.6)";
          ctx.beginPath(); ctx.arc(-4, 10, 2, 0, Math.PI * 2); ctx.fill(); break;
        }
        case "broken": {
          ctx.fillStyle = "#2a0810";
          ctx.strokeStyle = "rgba(255,80,80,0.9)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.bezierCurveTo(12, -2, 8, -12, 0, -5);
          ctx.bezierCurveTo(-8, -12, -12, -2, 0, 8);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = "rgba(255,200,200,0.95)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -6); ctx.lineTo(-2, -2); ctx.lineTo(2, 1); ctx.lineTo(-1, 5);
          ctx.stroke(); break;
        }
      }
    };

    const drawPowerups = () => {
      const t = performance.now() / 1000;
      powerups.forEach((p) => {
        if (p.taken) return;
        if (p.y < -30 || p.y > H + 30) return;
        const sx = laneX(p.lane) + Math.sin(t * 2.4 + p.bobSeed) * 4;
        const haloColor =
          p.type === "star" ? "rgba(255, 230, 140, 0.55)" :
          p.type === "heart" ? "rgba(255, 120, 130, 0.5)" :
          p.type === "slow" ? "rgba(160, 220, 255, 0.5)" :
          p.type === "hint" ? "rgba(255, 250, 200, 0.55)" :
          p.type === "apple" ? "rgba(180, 90, 90, 0.5)" :
          "rgba(60, 20, 30, 0.6)";
        const halo = ctx.createRadialGradient(sx, p.y, 0, sx, p.y, 28);
        halo.addColorStop(0, haloColor);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(sx - 28, p.y - 28, 56, 56);
        ctx.save();
        ctx.translate(sx, p.y);
        drawPowerupIcon(p.type);
        ctx.restore();
      });
    };

    const applyPowerup = (p: Powerup) => {
      const px = laneX(player.lane);
      const py = playerY();
      switch (p.type) {
        case "star":
          invuln = Math.max(invuln, 7);
          spawnPickupBurst(px, py, "rgba(255, 230, 140, 0.9)");
          break;
        case "heart": {
          const nh = Math.min(3, healthRef.current + 1);
          healthRef.current = nh; setHealth(nh);
          spawnPickupBurst(px, py, "rgba(255, 140, 150, 0.9)");
          break;
        }
        case "slow":
          slowTimer = Math.max(slowTimer, 4);
          spawnPickupBurst(px, py, "rgba(160, 220, 255, 0.9)");
          break;
        case "hint": {
          const d = queue[activeIdx];
          if (d) { hintActive = d.safe; setHintLane(d.safe); }
          spawnPickupBurst(px, py, "rgba(255, 250, 200, 0.9)");
          break;
        }
        case "apple":
          distortTimer = Math.max(distortTimer, 3.5);
          setDistortion(1);
          spawnPickupBurst(px, py, "rgba(180, 90, 90, 0.8)");
          break;
        case "broken":
          damage(px, py);
          spawnPickupBurst(px, py, "rgba(255, 80, 80, 0.95)");
          break;
      }
    };

    // ----- Player draw (robed traveler, facing forward) -----
    const drawPlayer = () => {
      const x = player.x;
      const y = playerY() + player.knock;
      const flicker = invuln > 0 && Math.floor(invuln * 20) % 2 === 0;

      const gg = ctx.createRadialGradient(x, y, 0, x, y, 60);
      gg.addColorStop(0, "rgba(255, 220, 160, 0.5)");
      gg.addColorStop(1, "rgba(255, 220, 160, 0)");
      ctx.fillStyle = gg;
      ctx.fillRect(x - 60, y - 60, 120, 120);

      if (flicker) return;

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y + 22, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#d94f4f";
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 20);
      ctx.lineTo(x - 10, y - 8);
      ctx.quadraticCurveTo(x, y - 22, x + 10, y - 8);
      ctx.lineTo(x + 14, y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f2c94c";
      ctx.fillRect(x - 14, y + 16, 28, 3);
      ctx.fillStyle = "#f4d5b3";
      ctx.beginPath();
      ctx.arc(x, y - 18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a83838";
      ctx.beginPath();
      ctx.arc(x, y - 18, 6, Math.PI * 0.1, Math.PI * 0.9);
      ctx.fill();
    };

    const drawParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt;
        const a = 1 - p.life / p.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // ----- Loop -----
    let raf = 0;
    let last = performance.now();

    const reset = () => {
      player.lane = 1;
      player.targetLane = 1;
      player.x = laneX(1);
      player.knock = 0;
      shake = 0; flash = 0; invuln = 0;
      slowTimer = 0; distortTimer = 0;
      hintActive = null;
      particles.length = 0;
      setHealth(3); healthRef.current = 3;
      setProgress(0); progressRef.current = 0;
      scoreRef.current = 0; setScore(0);
      streakRef.current = 0; setStreak(0);
      setHintLane(null); setDistortion(0); setMultiplierToast(null);
      setCurrentQuestion(null); setCurrentAnswers(null);
      levelRef.current = 1; setLevel(1);
      runTimeRef.current = 0; setRunTime(0);
      usedIdsRef.current = new Set();
      buildLevel(1);
    };

    function damage(sxImpact: number, syImpact: number) {
      if (invuln > 0) return;
      const nh = Math.max(0, healthRef.current - 1);
      healthRef.current = nh; setHealth(nh);
      shake = 18; flash = 0.4; invuln = 1.2;
      player.knock = -10;
      spawnImpact(sxImpact, syImpact);
      streakRef.current = 0; setStreak(0);
      if (nh <= 0) {
        if (scoreRef.current > bestRef.current) {
          bestRef.current = scoreRef.current;
          setBestScore(scoreRef.current);
          try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
        }
        stateRef.current = "gameover"; setState("gameover");
      }
    }

    const onDecisionResolvedAdvance = () => {
      const newProg = progressRef.current + 1;
      progressRef.current = newProg;
      setProgress(newProg);
      activeIdx += 1;
      if (activeIdx >= queue.length) {
        // Level complete
        if (scoreRef.current > bestRef.current) {
          bestRef.current = scoreRef.current;
          setBestScore(scoreRef.current);
          try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
        }
        const nextLvl = levelRef.current + 1;
        levelRef.current = nextLvl;
        setLevel(nextLvl);
        buildLevel(nextLvl);
        return;
      }
      // Reset timer + hint for the next decision
      questionTimer = timePerQuestionForLevel(levelRef.current);
      hintActive = null;
      setHintLane(null);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      bgDrift += dt * 18;

      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake = Math.max(0, shake - dt * 60);
      }

      drawBackground();

      if (stateRef.current === "playing") {
        if (slowTimer > 0) slowTimer -= dt;
        if (distortTimer > 0) { distortTimer -= dt; if (distortTimer <= 0) setDistortion(0); }

        // Run-time counter (player performance)
        runTimeRef.current += dt;
        setRunTime(runTimeRef.current);

        // Player lane lerp
        const tgtX = laneX(player.targetLane);
        const dx = tgtX - player.x;
        player.x += dx * Math.min(1, dt * 14);
        if (Math.abs(dx) < 0.5) { player.x = tgtX; player.lane = player.targetLane; }
        if (player.knock < 0) {
          player.knock += dt * 40;
          if (player.knock > 0) player.knock = 0;
        }
        if (invuln > 0) invuln -= dt;
        if (Math.random() < dt * 8) spawnDust(player.x + (Math.random() - 0.5) * 12, playerY() + 22, 1);

        // Active decision falls
        const d = queue[activeIdx];
        if (d && !d.resolved) {
          d.y += fallSpeed() * dt;
          // Question timer (visual feedback)
          questionTimer -= dt;
          // Resolve when object reaches resolve line
          if (d.y >= H * RESOLVE_LINE_FRAC) {
            d.resolved = true;
            const lane = player.lane;
            const correct = lane === d.safe;
            d.outcome = correct ? "correct" : "wrong";
            d.outcomeAnim = 0;
            if (correct) {
              for (let i = 0; i < 12; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = 60 + Math.random() * 80;
                particles.push({
                  x: player.x, y: playerY() - 10,
                  vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
                  life: 0, max: 0.6, color: "rgba(255, 240, 180, 0.9)",
                  size: 1.5 + Math.random() * 1.5,
                });
              }
              const prevMult = multiplierForStreak(streakRef.current);
              const newStreak = streakRef.current + 1;
              streakRef.current = newStreak; setStreak(newStreak);
              const newMult = multiplierForStreak(newStreak);
              scoreRef.current += 10 * newMult; setScore(scoreRef.current);
              if (newMult > prevMult) {
                setMultiplierToast(newMult);
                setTimeout(() => setMultiplierToast(null), 1400);
              }
            } else {
              damage(player.x, playerY());
            }
            onDecisionResolvedAdvance();
          }
        }

        // Bonus spawn rules:
        //  - max 3 bonuses per 10-question level
        //  - max 1 bonus between two consecutive questions
        //  - never spawn when the active question is near its impact zone
        powerupTimer -= dt;
        if (powerupTimer <= 0) {
          const ad = queue[activeIdx];
          const safeZone = ad && !ad.resolved && ad.y > 0 && ad.y < H * 0.45;
          if (safeZone && bonusesThisLevel < 3 && !bonusSinceDecision) {
            spawnPowerup();
            bonusesThisLevel += 1;
            bonusSinceDecision = true;
          }
          powerupTimer = 1.4 + Math.random() * 1.6;
        }

        // Power-ups fall and collide
        const ps = fallSpeed() * 0.9;
        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i];
          if (p.taken) { powerups.splice(i, 1); continue; }
          p.y += ps * dt;
          // Pickup test (lane match, near player Y)
          if (!p.taken && p.lane === player.lane && p.y >= playerY() - 16 && p.y <= playerY() + 24) {
            p.taken = true;
            applyPowerup(p);
            powerups.splice(i, 1);
            continue;
          }
          // Off-screen below
          if (p.y > H + 40) powerups.splice(i, 1);
        }

        // Sync question UI
        const currQ = d ? d.question : null;
        const currA = d ? d.answers : null;
        if (currQ !== currentQuestionRef.current) {
          currentQuestionRef.current = currQ;
          setCurrentQuestion(currQ);
          setCurrentAnswers(currA);
        }
      }

      drawGround();
      drawPowerups();
      drawActiveDecision(dt);
      drawPlayer();
      drawParticles(dt);

      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 70, 60, ${flash})`;
        ctx.fillRect(0, 0, W, H);
        flash = Math.max(0, flash - dt * 1.5);
      }

      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };

    (canvas as unknown as { __reset?: () => void }).__reset = reset;

    // ----- Input -----
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const moveLane = (dir: -1 | 1) => {
      if (stateRef.current !== "playing") return;
      const next = Math.max(0, Math.min(2, player.targetLane + dir)) as Lane;
      player.targetLane = next;
    };
    const tapLane = (clientX: number) => {
      if (stateRef.current !== "playing") return;
      const rect = canvas.getBoundingClientRect();
      const rel = (clientX - rect.left) / rect.width;
      const lane: Lane = rel < 1 / 3 ? 0 : rel < 2 / 3 ? 1 : 2;
      player.targetLane = lane;
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = performance.now();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt2 = performance.now() - touchStartTime;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax > 30 && ax > ay) {
        moveLane(dx < 0 ? -1 : 1);
      } else if (dt2 < 300 && ax < 20 && ay < 20) {
        tapLane(t.clientX);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") moveLane(-1);
      else if (e.key === "ArrowRight" || e.key === "d") moveLane(1);
      else if (e.key === "1") player.targetLane = 0;
      else if (e.key === "2") player.targetLane = 1;
      else if (e.key === "3") player.targetLane = 2;
    };
    const onMouseDown = (e: MouseEvent) => { tapLane(e.clientX); };

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);

    player.x = laneX(1);

    raf = requestAnimationFrame((t) => { last = t; loop(t); });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const startGame = () => {
    if (!playerName) { setShowNamePrompt(true); return; }
    const c = canvasRef.current as unknown as { __reset?: () => void } | null;
    c?.__reset?.();
    setState("playing");
    stateRef.current = "playing";
  };

  const handleSaveName = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return;
    const saved = savePlayerName(trimmed);
    setPlayerNameState(saved);
    setShowNamePrompt(false);
    setShowSettings(false);
  };

  return (
    <div className="relative h-[100svh] w-screen overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none transition-[filter] duration-300"
        style={{
          touchAction: "none",
          filter: distortion > 0 ? "blur(2px) hue-rotate(-15deg) contrast(1.05)" : "none",
          transform: distortion > 0 ? `translateX(${Math.sin(Date.now() / 90) * 3}px)` : "none",
        }}
      />

      {state === "playing" && (
        <>
          {/* Top bar: hearts + score + level + timer */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (<Heart key={i} filled={i < health} />))}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                <span className="text-amber-200/70">SCORE</span>
                <span className="text-amber-50 tabular-nums">{score}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                <span className="text-amber-200/70">STREAK</span>
                <span className="text-amber-50 tabular-nums">{streak}</span>
                {streak > 0 && <span>🔥</span>}
                <span className={"ml-1 rounded-full px-1.5 py-0.5 tabular-nums " + (multiplierForStreak(streak) > 1 ? "bg-amber-300/30 text-amber-100 ring-1 ring-amber-200/40" : "text-amber-100/60")}>
                  x{multiplierForStreak(streak)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                <span className="text-amber-200/70">LEVEL </span>
                <span className="text-amber-50 tabular-nums">{level}</span>
                {level >= 11 && <span className="ml-1 text-amber-300/80">∞</span>}
              </div>
              <div className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-amber-100 backdrop-blur">
                {progress} / 10
              </div>
              <div className="rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-widest backdrop-blur tabular-nums bg-black/45 text-amber-100">
                ⏱ {formatRunTime(runTime)}
              </div>
            </div>
          </div>

          {/* Question - top center */}
          {currentQuestion && (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center px-3 animate-fade-in">
              <div
                className="rounded-2xl border border-amber-200/30 bg-black/55 px-5 py-3 text-center font-light tracking-wide text-amber-50 backdrop-blur-md shadow-[0_0_24px_rgba(255,200,140,0.2)] max-w-[94%]"
                style={{
                  fontFamily: '"Cormorant Garamond", "Cormorant", Georgia, serif',
                  fontSize: "clamp(18px, 4.6vw, 30px)",
                  lineHeight: 1.25,
                  letterSpacing: "0.02em",
                  fontWeight: 500,
                }}
              >
                {currentQuestion}
              </div>
            </div>
          )}

          {/* Answers are encoded into the falling objects only — no UI buttons. */}

          {multiplierToast !== null && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 animate-fade-in">
              <div className="rounded-full bg-amber-300/20 px-6 py-2 text-2xl font-light tracking-[0.3em] text-amber-100 ring-1 ring-amber-200/50 backdrop-blur-md shadow-[0_0_40px_rgba(255,200,140,0.5)]">
                x{multiplierToast} ACTIVE
              </div>
            </div>
          )}
        </>
      )}

      {state === "start" && (
        <Overlay>
          <h1 className="text-4xl font-light tracking-[0.25em] text-amber-50 drop-shadow-[0_2px_24px_rgba(255,180,120,0.5)]">
            DUNEWALKER
          </h1>
          <p className="mt-3 max-w-xs text-center text-sm font-light tracking-wide text-amber-100/80">
            Three lanes. Falling fates. Move left or right to land the right answer.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-amber-200/70">Language</span>
            <div className="flex max-w-[320px] flex-wrap justify-center gap-1.5">
              {LANGUAGES.map((lng) => (
                <button
                  key={lng}
                  onClick={() => setLanguage(lng)}
                  className={
                    "rounded-full border px-3 py-1 text-[11px] tracking-wider transition " +
                    (language === lng
                      ? "border-amber-200/80 bg-amber-100/20 text-amber-50 shadow-[0_0_18px_rgba(255,200,140,0.4)]"
                      : "border-amber-200/20 bg-black/30 text-amber-100/70 hover:border-amber-200/50 hover:text-amber-50")
                  }
                >
                  {LANGUAGE_LABELS[lng]}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={startGame}
            className="mt-8 rounded-full bg-amber-100 px-8 py-3 text-sm font-medium tracking-[0.2em] text-stone-900 shadow-[0_0_40px_rgba(255,200,140,0.5)] transition-transform hover:scale-105 active:scale-95"
          >
            BEGIN
          </button>
          {playerName && (
            <p className="mt-3 text-[11px] tracking-[0.25em] text-amber-100/70">
              PLAYER · <span className="text-amber-50">{playerName}</span>
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={async () => {
                setShowLeaderboard(true);
                const t = await fetchTop10();
                let merged: LeaderboardEntry[] = t;
                const me = await fetchPlayerEntry();
                if (me && me.best_score > 0 && !t.some((e) => e.player_id === me.player_id)) {
                  merged = [...t, me].sort((a, b) => b.best_score - a.best_score).slice(0, 11);
                }
                console.debug("[leaderboard] menu entries:", merged.length,
                  "playerFound:", !!me, "ranking:", merged);
                setTopTen(merged);
              }}
              className="rounded-full border border-amber-200/30 bg-black/30 px-4 py-1.5 text-[10px] tracking-[0.25em] text-amber-100/80 backdrop-blur hover:border-amber-200/60 hover:text-amber-50"
            >
              LEADERBOARD
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-full border border-amber-200/30 bg-black/30 px-4 py-1.5 text-[10px] tracking-[0.25em] text-amber-100/80 backdrop-blur hover:border-amber-200/60 hover:text-amber-50"
            >
              SETTINGS
            </button>
          </div>
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay>
          <p className="text-xs uppercase tracking-[0.4em] text-rose-200/80">The wind took you</p>
          <h1 className="mt-3 text-4xl font-light tracking-[0.2em] text-amber-50">FALLEN</h1>
          <p className="mt-1 text-xs text-amber-100/60">
            Level {level}{level >= 11 ? " (endless)" : ""}
          </p>
          {isWorldRecord && (
            <div className="mt-3 rounded-full bg-amber-300/30 px-4 py-1 text-[11px] tracking-[0.35em] text-amber-50 ring-1 ring-amber-200/70 shadow-[0_0_30px_rgba(255,210,140,0.7)] animate-pulse">
              ★ NEW WORLD RECORD ★
            </div>
          )}
          {!isWorldRecord && enteredTop10 && (
            <div className="mt-3 rounded-full bg-amber-200/20 px-4 py-1 text-[11px] tracking-[0.3em] text-amber-50 ring-1 ring-amber-200/60 animate-pulse">
              NEW TOP 10 WORLD RANK
            </div>
          )}
          {!isWorldRecord && !enteredTop10 && isNewBest && (
            <div className="mt-3 rounded-full bg-amber-100/15 px-4 py-1 text-[11px] tracking-[0.3em] text-amber-100 ring-1 ring-amber-200/40">
              NEW PERSONAL BEST
            </div>
          )}
          <div className="mt-5 grid grid-cols-3 gap-6 text-center">
            <Stat label="SCORE" value={score} />
            <Stat label="BEST" value={bestScore} />
            <Stat label="WORLD RANK" value={worldRank ?? 0} prefix="#" />
          </div>
          <LeaderboardList
            entries={topTen}
            currentName={playerName}
          />
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={startGame}
              className="rounded-full bg-amber-100 px-8 py-3 text-sm font-medium tracking-[0.2em] text-stone-900 shadow-[0_0_40px_rgba(255,200,140,0.5)] transition-transform hover:scale-105 active:scale-95"
            >
              TRY AGAIN
            </button>
            <button
              onClick={() => { setState("start"); stateRef.current = "start"; }}
              className="rounded-full border border-amber-200/40 bg-black/30 px-6 py-3 text-xs font-medium tracking-[0.2em] text-amber-100/90 backdrop-blur transition hover:border-amber-200/70 hover:text-amber-50"
            >
              MAIN MENU
            </button>
          </div>
        </Overlay>
      )}

      {showNamePrompt && (
        <NamePromptOverlay
          initial={playerName ?? ""}
          onSave={handleSaveName}
          onCancel={playerName ? () => setShowNamePrompt(false) : undefined}
        />
      )}

      {showSettings && (
        <SettingsOverlay
          name={playerName ?? ""}
          onChangeName={() => { setShowSettings(false); setShowNamePrompt(true); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showLeaderboard && (
        <Overlay>
          <h2 className="text-2xl font-light tracking-[0.25em] text-amber-50">LEADERBOARD</h2>
          <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70">TOP 10 WORLDWIDE</p>
          <LeaderboardList entries={topTen} currentName={playerName} />
          <button
            onClick={() => setShowLeaderboard(false)}
            className="mt-6 rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
          >
            CLOSE
          </button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      {children}
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        d="M12 21s-7-4.5-9.5-9.2C.9 8.5 2.6 5 6 5c2 0 3.4 1 4 2.2C10.6 6 12 5 14 5c3.4 0 5.1 3.5 3.5 6.8C19 16.5 12 21 12 21z"
        fill={filled ? "#ffdca8" : "rgba(255,220,170,0.18)"}
        stroke="rgba(255,220,170,0.9)"
        strokeWidth={1.2}
      />
    </svg>
  );
}

function Stat({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] tracking-[0.3em] text-amber-200/70">{label}</span>
      <span className="mt-1 text-2xl font-light tabular-nums text-amber-50">
        {value > 0 || !prefix ? `${prefix ?? ""}${value}` : "—"}
      </span>
    </div>
  );
}

function LeaderboardList({
  entries,
  currentName,
}: {
  entries: LeaderboardEntry[] | null;
  highlightId?: string;
  currentName: string | null;
}) {
  if (entries === null) {
    return (
      <div className="mt-5 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/20 bg-black/40 px-4 py-3 text-center text-[11px] tracking-[0.25em] text-amber-100/60 backdrop-blur">
        LOADING…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="mt-5 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/20 bg-black/40 px-4 py-3 text-center text-[11px] tracking-[0.25em] text-amber-100/60 backdrop-blur">
        NO SCORES YET
      </div>
    );
  }
  return (
    <div className="mt-5 w-[300px] max-w-[92vw] rounded-2xl border border-amber-200/25 bg-black/45 p-2 backdrop-blur-md">
      <ol className="flex flex-col">
        {entries.map((e, idx) => {
          const mine = currentName != null && e.name === currentName;
          return (
            <li
              key={e.player_id}
              className={
                "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm tracking-wide " +
                (mine
                  ? "bg-amber-200/25 text-amber-50 ring-1 ring-amber-200/60 shadow-[0_0_18px_rgba(255,200,140,0.35)]"
                  : "text-amber-100/85")
              }
            >
              <span className="w-10 tabular-nums text-amber-200/80">#{idx + 1}</span>
              <span className="flex-1 truncate px-2">{e.name}</span>
              <span className="tabular-nums text-amber-50">{e.best_score}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NamePromptOverlay({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel?: () => void;
}) {
  const [val, setVal] = useState(initial);
  const trimmed = val.trim();
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in px-4">
      <h2 className="text-xl font-light tracking-[0.25em] text-amber-50 text-center">
        CHOOSE YOUR PLAYER NAME
      </h2>
      <p className="mt-2 text-[10px] tracking-[0.3em] text-amber-200/70">
        {NAME_MIN}–{NAME_MAX} CHARACTERS
      </p>
      <input
        autoFocus
        value={val}
        maxLength={NAME_MAX}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && valid) onSave(val); }}
        className="mt-5 w-[260px] max-w-[80vw] rounded-full border border-amber-200/40 bg-black/40 px-4 py-2.5 text-center text-lg tracking-[0.15em] text-amber-50 outline-none backdrop-blur placeholder:text-amber-100/30 focus:border-amber-200/80"
        placeholder="Your name"
        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
      />
      <div className="mt-6 flex items-center gap-3">
        <button
          disabled={!valid}
          onClick={() => onSave(val)}
          className={
            "rounded-full px-7 py-2.5 text-xs font-medium tracking-[0.25em] transition-transform " +
            (valid
              ? "bg-amber-100 text-stone-900 shadow-[0_0_30px_rgba(255,200,140,0.4)] hover:scale-105 active:scale-95"
              : "cursor-not-allowed bg-amber-100/30 text-stone-900/50")
          }
        >
          CONFIRM
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-full border border-amber-200/40 bg-black/30 px-5 py-2.5 text-xs tracking-[0.25em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
          >
            CANCEL
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsOverlay({
  name,
  onChangeName,
  onClose,
}: {
  name: string;
  onChangeName: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
      <h2 className="text-xl font-light tracking-[0.25em] text-amber-50">SETTINGS</h2>
      <div className="mt-5 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/25 bg-black/45 p-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-amber-200/70">PLAYER NAME</div>
            <div className="mt-1 text-base text-amber-50">{name || "—"}</div>
          </div>
          <button
            onClick={onChangeName}
            className="rounded-full border border-amber-200/40 bg-black/30 px-3 py-1.5 text-[10px] tracking-[0.25em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
          >
            CHANGE
          </button>
        </div>
      </div>
      <button
        onClick={onClose}
        className="mt-6 rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
      >
        CLOSE
      </button>
    </div>
  );
}
