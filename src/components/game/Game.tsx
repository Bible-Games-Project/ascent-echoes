import { useEffect, useRef, useState } from "react";
import {
  buildLevelQuestions,
  timePerQuestionForLevel,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
  type GameQuestion,
} from "./questionBank";

type GameState = "start" | "playing" | "gameover";
type Lane = 0 | 1 | 2; // 0 top, 1 middle, 2 bottom

interface DecisionPoint {
  x: number; // world x where the gate is
  safe: Lane;
  question: string;
  answers: [string, string, string];
  triggered: boolean;
  resolved: boolean;
  // Per-lane door animation state. 0 = fully closed, 1 = fully open/broken.
  doorAnim: [number, number, number];
  // Per-lane outcome once contact occurs: "open" (safe slide-away) or
  // "broken" (wrong-lane impact). null until contact.
  doorOutcome: [null | "open" | "broken", null | "open" | "broken", null | "open" | "broken"];
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

type PowerupType =
  | "star"
  | "heart"
  | "slow"
  | "hint"
  | "apple"
  | "broken";

interface Powerup {
  x: number;
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
  const [progress, setProgress] = useState(0); // 0..10 within current level
  const [level, setLevel] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<[string, string, string] | null>(null);
  const [isLandscape, setIsLandscape] = useState(true);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplierToast, setMultiplierToast] = useState<number | null>(null);
  const [hintLane, setHintLane] = useState<Lane | null>(null);
  const [distortion, setDistortion] = useState(0); // 0..1 strength
  const [timeLeft, setTimeLeft] = useState(0);
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("dunewalker_lang");
      if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Language;
    } catch { /* ignore */ }
    return "en";
  });

  // Mutable game refs to avoid React re-renders inside the loop.
  const stateRef = useRef<GameState>("start");
  const healthRef = useRef(3);
  const progressRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestRef = useRef(0);
  const levelRef = useRef(1);
  const languageRef = useRef<Language>(language);
  const usedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    healthRef.current = health;
  }, [health]);
  useEffect(() => {
    languageRef.current = language;
    try { localStorage.setItem("dunewalker_lang", language); } catch { /* ignore */ }
  }, [language]);

  // Load best score from localStorage
  useEffect(() => {
    try {
      const b = parseInt(localStorage.getItem("dunewalker_best") || "0", 10);
      if (!isNaN(b)) {
        bestRef.current = b;
        setBestScore(b);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
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
    let worldX = 0; // total distance scrolled
    const baseScrollSpeed = 180; // px/sec
    let scrollSpeed = baseScrollSpeed;
    let slowTimer = 0; // seconds remaining of time-slow
    let distortTimer = 0; // seconds remaining of distortion
    let hintActive: Lane | null = null;
    let hintForX = 0; // decision x the hint is bound to
    let shake = 0;
    let flash = 0;
    let invuln = 0;

    // Player
    const player = {
      lane: 1 as Lane,
      targetLane: 1 as Lane,
      y: 0,
      vy: 0,
      jumping: false,
      pushBack: 0, // pixels of left-edge pressure
    };

    const laneY = (lane: Lane) => {
      // top, middle, bottom positions as fractions of height
      const ys = [0.35, 0.58, 0.82];
      return H * ys[lane];
    };

    // Build decision points (world-space x positions)
    const FIRST_DP = 700;
    const DP_SPACING = 900;
    let decisions: DecisionPoint[] = [];
    let FINISH_X = 0;
    const powerups: Powerup[] = [];
    let questionTimer = 0;
    let activeDecision: DecisionPoint | null = null;
    const currentQuestionRef = { current: null as string | null };

    const pickType = (): PowerupType => {
      // 70% positive, 20% utility (slow/hint), 10% negative
      const r = Math.random();
      if (r < 0.45) return Math.random() < 0.5 ? "star" : "heart";
      if (r < 0.7) return Math.random() < 0.5 ? "slow" : "hint";
      if (r < 0.9) return Math.random() < 0.5 ? "slow" : "hint"; // utility
      return Math.random() < 0.5 ? "apple" : "broken";
    };

    const buildLevel = (lvl: number) => {
      const qs: GameQuestion[] = buildLevelQuestions(lvl, languageRef.current, usedIdsRef.current);
      decisions = qs.map((item, i) => ({
        x: FIRST_DP + i * DP_SPACING,
        safe: item.safe as Lane,
        question: item.prompt,
        answers: item.answers,
        triggered: false,
        resolved: false,
        doorAnim: [0, 0, 0],
        doorOutcome: [null, null, null],
      }));
      FINISH_X = decisions[decisions.length - 1].x + 800;
      powerups.length = 0;
      for (let i = 0; i < decisions.length - 1; i++) {
        const a = decisions[i].x;
        const b = decisions[i + 1].x;
        const count = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let k = 0; k < count; k++) {
          const t = (k + 1) / (count + 1);
          const px = a + (b - a) * t + (Math.random() - 0.5) * 80;
          powerups.push({
            x: px,
            lane: Math.floor(Math.random() * 3) as Lane,
            type: pickType(),
            taken: false,
            bobSeed: Math.random() * Math.PI * 2,
          });
        }
      }
      worldX = 0;
      player.pushBack = 0;
      activeDecision = null;
      questionTimer = 0;
      currentQuestionRef.current = null;
      setCurrentQuestion(null);
      setCurrentAnswers(null);
      setProgress(0);
      progressRef.current = 0;
      setTimeLeft(timePerQuestionForLevel(lvl));
    };

    // Particles (dust / impact)
    const particles: Particle[] = [];
    const spawnDust = (x: number, y: number, n = 1) => {
      for (let i = 0; i < n; i++) {
        particles.push({
          x,
          y,
          vx: -40 - Math.random() * 60,
          vy: -10 - Math.random() * 20,
          life: 0,
          max: 0.6 + Math.random() * 0.6,
          color: "rgba(255, 220, 170, 0.6)",
          size: 1 + Math.random() * 2,
        });
      }
    };

    // ----- Draw power-ups -----
    const drawPowerups = (dt: number) => {
      const t = performance.now() / 1000;
      powerups.forEach((p) => {
        if (p.taken) return;
        const sx = worldToScreen(p.x);
        if (sx < -80 || sx > W + 80) return;
        const baseY = laneY(p.lane);
        const y = baseY - 8 + Math.sin(t * 2.4 + p.bobSeed) * 4;

        // Soft halo
        const halo = ctx.createRadialGradient(sx, y, 0, sx, y, 28);
        const haloColor =
          p.type === "star"
            ? "rgba(255, 230, 140, 0.55)"
            : p.type === "heart"
            ? "rgba(255, 120, 130, 0.5)"
            : p.type === "slow"
            ? "rgba(160, 220, 255, 0.5)"
            : p.type === "hint"
            ? "rgba(255, 250, 200, 0.55)"
            : p.type === "apple"
            ? "rgba(180, 90, 90, 0.5)"
            : "rgba(60, 20, 30, 0.6)";
        halo.addColorStop(0, haloColor);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(sx - 28, y - 28, 56, 56);

        ctx.save();
        ctx.translate(sx, y);
        drawPowerupIcon(p.type);
        ctx.restore();
      });
    };

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
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "heart": {
          ctx.fillStyle = "#ff5c6c";
          ctx.strokeStyle = "rgba(80,10,20,0.7)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.bezierCurveTo(12, -2, 8, -12, 0, -5);
          ctx.bezierCurveTo(-8, -12, -12, -2, 0, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "slow": {
          // Hourglass
          ctx.fillStyle = "#bfe7ff";
          ctx.strokeStyle = "rgba(20,60,90,0.8)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-9, -10);
          ctx.lineTo(9, -10);
          ctx.lineTo(-9, 10);
          ctx.lineTo(9, 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "rgba(20,60,90,0.85)";
          ctx.fillRect(-10, -12, 20, 2);
          ctx.fillRect(-10, 10, 20, 2);
          break;
        }
        case "hint": {
          // Lightbulb / divine glyph
          ctx.fillStyle = "#fff6c8";
          ctx.strokeStyle = "rgba(150,110,20,0.7)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, -2, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "rgba(120,80,20,0.85)";
          ctx.fillRect(-5, 7, 10, 3);
          ctx.fillRect(-3, 10, 6, 2);
          // Rays
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
          // Corrupted apple - dark crimson with bite
          ctx.fillStyle = "#7a1f2a";
          ctx.strokeStyle = "rgba(20,0,5,0.9)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 2, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // bite (negative space)
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.beginPath();
          ctx.arc(7, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          // stem
          ctx.strokeStyle = "#3a2010";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(3, -13);
          ctx.stroke();
          // sickly glow drip
          ctx.fillStyle = "rgba(120, 200, 80, 0.6)";
          ctx.beginPath();
          ctx.arc(-4, 10, 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "broken": {
          // Broken/cracked dark heart
          ctx.fillStyle = "#2a0810";
          ctx.strokeStyle = "rgba(255,80,80,0.9)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.bezierCurveTo(12, -2, 8, -12, 0, -5);
          ctx.bezierCurveTo(-8, -12, -12, -2, 0, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // crack
          ctx.strokeStyle = "rgba(255,200,200,0.95)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(-2, -2);
          ctx.lineTo(2, 1);
          ctx.lineTo(-1, 5);
          ctx.stroke();
          break;
        }
      }
    };

    const spawnPickupBurst = (x: number, y: number, color: string) => {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 140;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 0.5 + Math.random() * 0.4,
          color,
          size: 1.5 + Math.random() * 2,
        });
      }
    };

    const applyPowerup = (p: Powerup) => {
      const px = W * PLAYER_SCREEN_X_FRAC;
      const py = player.y;
      switch (p.type) {
        case "star":
          invuln = Math.max(invuln, 7);
          spawnPickupBurst(px, py, "rgba(255, 230, 140, 0.9)");
          break;
        case "heart": {
          const nh = Math.min(3, healthRef.current + 1);
          healthRef.current = nh;
          setHealth(nh);
          spawnPickupBurst(px, py, "rgba(255, 140, 150, 0.9)");
          break;
        }
        case "slow":
          slowTimer = Math.max(slowTimer, 4);
          spawnPickupBurst(px, py, "rgba(160, 220, 255, 0.9)");
          break;
        case "hint": {
          const next = decisions.find((d) => !d.resolved);
          if (next) {
            hintActive = next.safe;
            hintForX = next.x;
            setHintLane(next.safe);
          }
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
    const spawnImpact = (x: number, y: number) => {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 220;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 0.5 + Math.random() * 0.5,
          color: "rgba(255, 120, 80, 0.9)",
          size: 2 + Math.random() * 3,
        });
      }
    };

    // Parallax layers - stylized desert / dune silhouettes
    const drawSky = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#ffb178");
      g.addColorStop(0.4, "#ff8c61");
      g.addColorStop(0.75, "#c75b7a");
      g.addColorStop(1, "#5b3a78");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Sun
      const sunY = H * 0.55;
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
        const y =
          baseY +
          Math.sin((x + offset) * freq) * amp +
          Math.sin((x + offset) * freq * 2.3) * amp * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };

    const drawBackground = () => {
      drawSky();
      // far dunes
      drawDunes(-worldX * 0.08, 18, H * 0.55, "rgba(120, 60, 100, 0.55)", 0.006);
      drawDunes(-worldX * 0.16, 26, H * 0.62, "rgba(80, 40, 80, 0.7)", 0.009);
      drawDunes(-worldX * 0.3, 34, H * 0.7, "rgba(50, 25, 60, 0.85)", 0.012);
    };

    // Draw 3 platform ribbons across screen
    const drawPlatforms = () => {
      const lanes: Lane[] = [0, 1, 2];
      lanes.forEach((l) => {
        const y = laneY(l);
        const platTop = y + 22;
        const platH = 18;
        // Soft shadow under platform
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, platTop + platH, W, 8);
        // Platform body
        const g = ctx.createLinearGradient(0, platTop, 0, platTop + platH);
        g.addColorStop(0, "#3a2540");
        g.addColorStop(1, "#1a0f25");
        ctx.fillStyle = g;
        ctx.fillRect(0, platTop, W, platH);
        // Top rim glow
        ctx.fillStyle = "rgba(255, 180, 120, 0.5)";
        ctx.fillRect(0, platTop, W, 2);
      });
    };

    // Convert world X to screen X. Player stays at fixed screen X (left-third).
    const PLAYER_SCREEN_X_FRAC = 0.28;
    const worldToScreen = (wx: number) => {
      const playerScreenX = W * PLAYER_SCREEN_X_FRAC;
      // worldX represents distance scrolled. Object at world x appears at
      // playerScreenX + (x - worldX) + player.pushBack
      return playerScreenX + (wx - worldX) + player.pushBack;
    };

    // Doors per decision point: one door per lane. The safe-lane door slides
    // open on contact; wrong-lane doors stay shut and shatter on impact.
    const DOOR_W = 46;
    const DOOR_H = 70;
    const drawDecisions = (dt: number) => {
      decisions.forEach((d) => {
        const sx = worldToScreen(d.x);
        if (sx < -200 || sx > W + 200) return;

        // Vertical light pillar marking the gate
        const pg = ctx.createLinearGradient(sx, 0, sx, H);
        pg.addColorStop(0, "rgba(255, 230, 180, 0.0)");
        pg.addColorStop(0.5, "rgba(255, 230, 180, 0.18)");
        pg.addColorStop(1, "rgba(255, 230, 180, 0.0)");
        ctx.fillStyle = pg;
        ctx.fillRect(sx - 30, 0, 60, H);

        const lanes: Lane[] = [0, 1, 2];
        lanes.forEach((l) => {
          const y = laneY(l);
          const baseY = y + 22; // platform top
          const outcome = d.doorOutcome[l];

          // Advance per-lane animation
          if (outcome) {
            d.doorAnim[l] = Math.min(1, d.doorAnim[l] + dt * (outcome === "broken" ? 2.2 : 3.2));
          }
          const anim = d.doorAnim[l];
          // Fully done & open/broken: skip drawing
          if (outcome && anim >= 1) return;

          const topY = baseY - DOOR_H;
          // Door frame (stone arch)
          ctx.fillStyle = "rgba(20, 12, 28, 0.55)";
          ctx.fillRect(sx - DOOR_W / 2 - 4, topY - 6, DOOR_W + 8, 6);

          if (outcome === "open") {
            // Safe door: slides upward and fades away on contact
            const slide = anim * (DOOR_H + 20);
            const a = 1 - anim;
            ctx.globalAlpha = a;
            drawDoorPanel(sx, topY - slide, DOOR_W, DOOR_H, true);
            ctx.globalAlpha = 1;
            return;
          }
          if (outcome === "broken") {
            // Wrong door: shatter outward
            const a = 1 - anim;
            ctx.globalAlpha = a;
            const shards = 5;
            for (let i = 0; i < shards; i++) {
              const ang = (i / shards) * Math.PI * 2;
              const r = anim * 40;
              const px = sx + Math.cos(ang) * r;
              const py = (topY + DOOR_H / 2) + Math.sin(ang) * r;
              ctx.fillStyle = "#3a2a22";
              ctx.fillRect(px - 6, py - 8, 12, 16);
            }
            ctx.globalAlpha = 1;
            return;
          }

          // Closed door (pre-contact). Safe-lane door is slightly warmer / glowing.
          drawDoorPanel(sx, topY, DOOR_W, DOOR_H, l === d.safe);
        });
      });
    };

    const drawDoorPanel = (cx: number, topY: number, w: number, h: number, safe: boolean) => {
      const x = cx - w / 2;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + 2, topY + h, w - 4, 4);
      // Body gradient
      const g = ctx.createLinearGradient(x, topY, x, topY + h);
      if (safe) {
        g.addColorStop(0, "#8a6a4a");
        g.addColorStop(1, "#3a2618");
      } else {
        g.addColorStop(0, "#5a4536");
        g.addColorStop(1, "#2a1a14");
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, topY, w, h);
      // Arched top
      ctx.beginPath();
      ctx.fillStyle = g as unknown as string;
      ctx.arc(cx, topY, w / 2, Math.PI, 0);
      ctx.fill();
      // Plank lines
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx, topY + h);
      ctx.stroke();
      // Hinges / studs
      ctx.fillStyle = "rgba(255,210,160,0.55)";
      ctx.beginPath();
      ctx.arc(x + 6, topY + 10, 2, 0, Math.PI * 2);
      ctx.arc(x + w - 6, topY + 10, 2, 0, Math.PI * 2);
      ctx.arc(x + 6, topY + h - 10, 2, 0, Math.PI * 2);
      ctx.arc(x + w - 6, topY + h - 10, 2, 0, Math.PI * 2);
      ctx.fill();
      // Glow rim for safe door
      if (safe) {
        ctx.strokeStyle = "rgba(255, 230, 180, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, topY, w, h);
      } else {
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, topY, w, h);
      }
    };

    // Draw stylized robed traveler
    const drawPlayer = () => {
      const x = W * PLAYER_SCREEN_X_FRAC + player.pushBack;
      const y = player.y;
      const flicker = invuln > 0 && Math.floor(invuln * 20) % 2 === 0;

      // Glow
      const gg = ctx.createRadialGradient(x, y, 0, x, y, 60);
      gg.addColorStop(0, "rgba(255, 220, 160, 0.5)");
      gg.addColorStop(1, "rgba(255, 220, 160, 0)");
      ctx.fillStyle = gg;
      ctx.fillRect(x - 60, y - 60, 120, 120);

      if (flicker) return;

      // Shadow on platform
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y + 22, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Robe
      ctx.fillStyle = "#d94f4f";
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 20);
      ctx.lineTo(x - 8, y - 8);
      ctx.quadraticCurveTo(x, y - 22, x + 8, y - 8);
      ctx.lineTo(x + 12, y + 20);
      ctx.closePath();
      ctx.fill();
      // Robe trim
      ctx.fillStyle = "#f2c94c";
      ctx.fillRect(x - 12, y + 16, 24, 3);
      // Head
      ctx.fillStyle = "#f4d5b3";
      ctx.beginPath();
      ctx.arc(x, y - 18, 6, 0, Math.PI * 2);
      ctx.fill();
      // Hood line
      ctx.fillStyle = "#a83838";
      ctx.beginPath();
      ctx.arc(x, y - 18, 6, Math.PI * 0.1, Math.PI * 0.9);
      ctx.fill();
      // Scarf trailing right (wind from forward motion)
      ctx.strokeStyle = "#f2c94c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 14);
      ctx.quadraticCurveTo(x + 22, y - 10, x + 30 + Math.sin(performance.now() / 120) * 4, y - 6);
      ctx.stroke();
    };

    const drawParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) {
          particles.splice(i, 1);
          continue;
        }
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

    // ----- Game loop -----
    let raf = 0;
    let last = performance.now();

    const reset = () => {
      worldX = 0;
      player.lane = 1;
      player.targetLane = 1;
      player.y = laneY(1);
      player.vy = 0;
      player.jumping = false;
      player.pushBack = 0;
      shake = 0;
      flash = 0;
      invuln = 0;
      slowTimer = 0;
      distortTimer = 0;
      hintActive = null;
      hintForX = 0;
      scrollSpeed = baseScrollSpeed;
      particles.length = 0;
      setHealth(3);
      healthRef.current = 3;
      setProgress(0);
      progressRef.current = 0;
      scoreRef.current = 0;
      setScore(0);
      streakRef.current = 0;
      setStreak(0);
      setHintLane(null);
      setDistortion(0);
      setMultiplierToast(null);
      setCurrentQuestion(null);
      setCurrentAnswers(null);
      levelRef.current = 1;
      setLevel(1);
      usedIdsRef.current = new Set();
      buildLevel(1);
    };

    const damage = (sxImpact: number, syImpact: number) => {
      if (invuln > 0) return;
      const nh = Math.max(0, healthRef.current - 1);
      healthRef.current = nh;
      setHealth(nh);
      shake = 18;
      flash = 0.4;
      invuln = 1.2;
      player.pushBack += 80;
      spawnImpact(sxImpact, syImpact);
      // Reset streak on any damage
      streakRef.current = 0;
      setStreak(0);
      if (nh <= 0) {
        // Persist best score
        if (scoreRef.current > bestRef.current) {
          bestRef.current = scoreRef.current;
          setBestScore(scoreRef.current);
          try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
        }
        stateRef.current = "gameover";
        setState("gameover");
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Always render background even on menus
      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake = Math.max(0, shake - dt * 60);
      }

      drawBackground();

      if (stateRef.current === "playing") {
        // Slow / distortion timers
        if (slowTimer > 0) slowTimer -= dt;
        if (distortTimer > 0) {
          distortTimer -= dt;
          if (distortTimer <= 0) setDistortion(0);
        }
        scrollSpeed = slowTimer > 0 ? baseScrollSpeed * 0.45 : baseScrollSpeed;
        // Scroll world
        worldX += scrollSpeed * dt;
        // Knockback recovers back to 0
        if (player.pushBack !== 0) {
          const dir = player.pushBack > 0 ? -1 : 1;
          player.pushBack += dir * 80 * dt;
          if (Math.abs(player.pushBack) < 1) player.pushBack = 0;
        }

        // Lane transition
        const tgtY = laneY(player.targetLane);
        const dy = tgtY - player.y;
        player.y += dy * Math.min(1, dt * 12);
        if (Math.abs(dy) < 0.5) {
          player.y = tgtY;
          player.lane = player.targetLane;
        }

        // Jump arc
        if (player.jumping) {
          player.vy += 1800 * dt; // gravity
          player.y += player.vy * dt;
          const groundY = laneY(player.lane);
          if (player.y >= groundY) {
            player.y = groundY;
            player.jumping = false;
            player.vy = 0;
            spawnDust(W * PLAYER_SCREEN_X_FRAC, player.y + 22, 8);
          }
        }

        if (invuln > 0) invuln -= dt;

        // Continuous foot dust
        if (Math.random() < dt * 20 && !player.jumping) {
          spawnDust(W * PLAYER_SCREEN_X_FRAC - 6, player.y + 22, 1);
        }

        // Decision detection. The active question is ALWAYS the next
        // unresolved decision — it stays on screen until that door is hit
        // or passed through, then the following question takes over.
        let activeQ: string | null = null;
        let activeA: [string, string, string] | null = null;
        const nextUnresolved = decisions.find((d) => !d.resolved);
        if (nextUnresolved) {
          activeQ = nextUnresolved.question;
          activeA = nextUnresolved.answers;
        }
        // Per-question countdown timer. Resets when the active decision
        // changes; expiry forces a wrong-answer outcome on the current lane.
        if (nextUnresolved !== activeDecision) {
          activeDecision = nextUnresolved ?? null;
          questionTimer = activeDecision ? timePerQuestionForLevel(levelRef.current) : 0;
          setTimeLeft(questionTimer);
        }
        if (activeDecision && !activeDecision.resolved) {
          questionTimer -= dt;
          setTimeLeft(Math.max(0, questionTimer));
          if (questionTimer <= 0) {
            const d = activeDecision;
            d.resolved = true;
            // Shatter all three doors on time-out and damage player.
            d.doorOutcome = ["broken", "broken", "broken"];
            const playerX = W * PLAYER_SCREEN_X_FRAC;
            damage(playerX, player.y);
            if (hintActive !== null && d.x === hintForX) {
              hintActive = null;
              setHintLane(null);
            }
            const newProg = progressRef.current + 1;
            progressRef.current = newProg;
            setProgress(newProg);
          }
        }
        decisions.forEach((d) => {
          // Physical collision: trigger only when the door's screen-x reaches
          // the player's screen-x. The player's door is the one in their lane.
          const playerX = W * PLAYER_SCREEN_X_FRAC;
          const doorScreenX = worldToScreen(d.x);
          if (!d.resolved && doorScreenX <= playerX) {
            d.resolved = true;
            const lane = player.lane;
            const safelyJumped = player.jumping && player.y < laneY(lane) - 30;
            const correct = lane === d.safe || safelyJumped;
            // The door in the player's lane reacts physically at contact.
            d.doorOutcome[lane] = correct ? "open" : "broken";
            // Other doors stay shut and just scroll past unseen.
            if (!correct) {
              damage(playerX, player.y);
            } else {
              // Safe - small celebratory sparkle
              for (let i = 0; i < 12; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = 60 + Math.random() * 80;
                particles.push({
                  x: W * PLAYER_SCREEN_X_FRAC,
                  y: player.y - 10,
                  vx: Math.cos(a) * s,
                  vy: Math.sin(a) * s - 40,
                  life: 0,
                  max: 0.6,
                  color: "rgba(255, 240, 180, 0.9)",
                  size: 1.5 + Math.random() * 1.5,
                });
              }
              // Score & streak
              const prevMult = multiplierForStreak(streakRef.current);
              const newStreak = streakRef.current + 1;
              streakRef.current = newStreak;
              setStreak(newStreak);
              const newMult = multiplierForStreak(newStreak);
              const gain = 10 * newMult;
              scoreRef.current += gain;
              setScore(scoreRef.current);
              if (newMult > prevMult) {
                setMultiplierToast(newMult);
                setTimeout(() => setMultiplierToast(null), 1400);
              }
            }
            // Clear hint when its target resolves
            if (hintActive !== null && d.x === hintForX) {
              hintActive = null;
              setHintLane(null);
            }
            const newProg = progressRef.current + 1;
            progressRef.current = newProg;
            setProgress(newProg);
          }
        });
        // Powerup pickup detection (player passes through it)
        const playerX = W * PLAYER_SCREEN_X_FRAC;
        powerups.forEach((p) => {
          if (p.taken) return;
          const sx = worldToScreen(p.x);
          if (sx <= playerX + 14 && sx >= playerX - 24 && p.lane === player.lane) {
            p.taken = true;
            applyPowerup(p);
          } else if (sx < playerX - 60) {
            // missed - simply mark taken to avoid re-checking
            p.taken = true;
          }
        });
        if (activeQ !== currentQuestionRef.current) {
          currentQuestionRef.current = activeQ;
          setCurrentQuestion(activeQ);
          setCurrentAnswers(activeA);
        }

        // Level complete when player has crossed the finish marker.
        // Endless mode: bump level, rebuild decisions, keep playing.
        if (worldX > FINISH_X - W * PLAYER_SCREEN_X_FRAC && healthRef.current > 0) {
          if (scoreRef.current > bestRef.current) {
            bestRef.current = scoreRef.current;
            setBestScore(scoreRef.current);
            try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
          }
          const nextLvl = levelRef.current + 1;
          levelRef.current = nextLvl;
          setLevel(nextLvl);
          buildLevel(nextLvl);
        }
      }

      drawPlatforms();
      drawPowerups(dt);
      drawDecisions(dt);
      drawPlayer();
      drawParticles(dt);

      // Damage flash overlay
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 70, 60, ${flash})`;
        ctx.fillRect(0, 0, W, H);
        flash = Math.max(0, flash - dt * 1.5);
      }

      // Vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();

      raf = requestAnimationFrame(loop);
    };

    // Expose reset for external triggers
    (canvas as unknown as { __reset?: () => void }).__reset = reset;

    // ----- Input -----
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;

    const moveLane = (dir: -1 | 1) => {
      if (stateRef.current !== "playing") return;
      const next = Math.max(0, Math.min(2, player.targetLane + dir)) as Lane;
      player.targetLane = next;
    };
    const jump = () => {
      if (stateRef.current !== "playing") return;
      if (player.jumping) return;
      player.jumping = true;
      player.vy = -640;
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
      if (ay > 30 && ay > ax) {
        moveLane(dy < 0 ? -1 : 1);
      } else if (dt2 < 300 && ax < 20 && ay < 20) {
        jump();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") moveLane(-1);
      else if (e.key === "ArrowDown" || e.key === "s") moveLane(1);
      else if (e.key === " ") jump();
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);

    // initial player Y
    player.y = laneY(1);

    raf = requestAnimationFrame((t) => {
      last = t;
      loop(t);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const startGame = () => {
    const c = canvasRef.current as unknown as { __reset?: () => void } | null;
    c?.__reset?.();
    setState("playing");
    stateRef.current = "playing";
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

      {/* HUD: hearts + progress */}
      {state === "playing" && (
        <>
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <Heart key={i} filled={i < health} />
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tracking-widest text-amber-100 backdrop-blur">
              <span className="text-amber-200/70">SCORE</span>
              <span className="text-amber-50 tabular-nums">{score}</span>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tracking-widest text-amber-100 backdrop-blur">
              <span className="flex items-center gap-1">
                <span className="text-amber-200/70">STREAK</span>
                <span className="text-amber-50 tabular-nums">{streak}</span>
                {streak > 0 && <span>🔥</span>}
              </span>
              <span
                className={
                  "rounded-full px-2 py-0.5 tabular-nums " +
                  (multiplierForStreak(streak) > 1
                    ? "bg-amber-300/30 text-amber-100 ring-1 ring-amber-200/40"
                    : "text-amber-100/60")
                }
              >
                x{multiplierForStreak(streak)}
              </span>
            </div>
          </div>
          <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
            <div className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium tracking-widest text-amber-100 backdrop-blur">
              <span className="text-amber-200/70">LEVEL </span>
              <span className="text-amber-50 tabular-nums">{level}</span>
              {level >= 11 && <span className="ml-1 text-amber-300/80">∞</span>}
            </div>
            <div className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium tracking-wider text-amber-100 backdrop-blur">
              {progress} / 10
            </div>
            <div
              className={
                "rounded-full px-3 py-1 text-[11px] font-medium tracking-widest backdrop-blur tabular-nums " +
                (timeLeft <= 2
                  ? "bg-rose-500/30 text-rose-100 ring-1 ring-rose-300/50"
                  : "bg-black/45 text-amber-100")
              }
            >
              ⏱ {timeLeft.toFixed(1)}s
            </div>
          </div>
          {multiplierToast !== null && (
            <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 animate-fade-in">
              <div className="rounded-full bg-amber-300/20 px-6 py-2 text-2xl font-light tracking-[0.3em] text-amber-100 ring-1 ring-amber-200/50 backdrop-blur-md shadow-[0_0_40px_rgba(255,200,140,0.5)]">
                x{multiplierToast} ACTIVE
              </div>
            </div>
          )}
          {currentQuestion && (
            <div className="pointer-events-none absolute left-1/2 top-10 z-10 -translate-x-1/2 animate-fade-in max-w-[85%]">
              <div
                className="rounded-2xl border border-amber-200/30 bg-black/45 px-7 py-3 text-center font-light tracking-wide text-amber-50 backdrop-blur-md shadow-[0_0_24px_rgba(255,200,140,0.2)]"
                style={{
                  fontFamily: '"Cormorant Garamond", "Cormorant", Georgia, serif',
                  fontSize: "clamp(20px, 3.2vw, 34px)",
                  lineHeight: 1.25,
                  letterSpacing: "0.02em",
                  fontWeight: 500,
                }}
              >
                {currentQuestion}
              </div>
            </div>
          )}
          {currentAnswers && (
            <div className="pointer-events-none absolute inset-y-0 right-3 z-10 w-[52%] max-w-[440px] animate-fade-in">
              {([0, 1, 2] as const).map((i) => {
                const topPct = [35, 58, 82][i];
                const isHint = hintLane === i;
                return (
                  <div
                    key={i}
                    className="absolute right-0 -translate-y-1/2"
                    style={{ top: `${topPct}%` }}
                  >
                    <div
                      className={
                        "rounded-2xl border px-5 py-2.5 text-right font-light tracking-wide backdrop-blur-md " +
                        (isHint
                          ? "border-amber-200/80 bg-amber-200/15 text-amber-50 shadow-[0_0_36px_rgba(255,220,140,0.7)] animate-pulse"
                          : "border-amber-200/30 bg-black/50 text-amber-50 shadow-[0_0_16px_rgba(255,200,140,0.15)]")
                      }
                      style={{
                        fontFamily: '"Cormorant Garamond", "Cormorant", Georgia, serif',
                        fontSize: "clamp(18px, 2.6vw, 28px)",
                        lineHeight: 1.2,
                        letterSpacing: "0.02em",
                        fontWeight: 500,
                      }}
                    >
                      {currentAnswers[i]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {state === "start" && (
        <Overlay>
          <h1 className="text-5xl font-light tracking-[0.25em] text-amber-50 drop-shadow-[0_2px_24px_rgba(255,180,120,0.5)]">
            DUNEWALKER
          </h1>
          <p className="mt-3 max-w-xs text-center text-sm font-light tracking-wide text-amber-100/80">
            Ten choices between you and the horizon. Swipe to climb or descend. Tap to leap.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-amber-200/70">Language</span>
            <div className="flex max-w-[520px] flex-wrap justify-center gap-1.5">
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
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay>
          <p className="text-xs uppercase tracking-[0.4em] text-rose-200/80">The wind took you</p>
          <h1 className="mt-3 text-4xl font-light tracking-[0.2em] text-amber-50">FALLEN</h1>
          <p className="mt-2 text-sm text-amber-100/70">
            You reached {progress} of 10 gates.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-6 text-center">
            <Stat label="SCORE" value={score} />
            <Stat label="BEST" value={bestScore} />
            <Stat label="STREAK" value={streak} />
          </div>
          <button
            onClick={startGame}
            className="mt-8 rounded-full bg-amber-100 px-8 py-3 text-sm font-medium tracking-[0.2em] text-stone-900 shadow-[0_0_40px_rgba(255,200,140,0.5)] transition-transform hover:scale-105 active:scale-95"
          >
            TRY AGAIN
          </button>
        </Overlay>
      )}

      {/* Orientation lock: force landscape only */}
      {!isLandscape && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,220,170,0.9)" strokeWidth="1.5" className="mb-5 rotate-90">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <circle cx="12" cy="18" r="1" fill="rgba(255,220,170,0.9)" />
          </svg>
          <h2 className="text-xl font-light tracking-[0.25em] text-amber-50">ROTATE DEVICE</h2>
          <p className="mt-2 text-xs font-light tracking-wider text-amber-100/60">Landscape orientation required</p>
        </div>
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
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
      <path
        d="M12 21s-7-4.5-9.5-9.2C.9 8.5 2.6 5 6 5c2 0 3.4 1 4 2.2C10.6 6 12 5 14 5c3.4 0 5.1 3.5 3.5 6.8C19 16.5 12 21 12 21z"
        fill={filled ? "#ffdca8" : "rgba(255,220,170,0.18)"}
        stroke="rgba(255,220,170,0.9)"
        strokeWidth={1.2}
      />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] tracking-[0.3em] text-amber-200/70">{label}</span>
      <span className="mt-1 text-2xl font-light tabular-nums text-amber-50">{value}</span>
    </div>
  );
}