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
type Lane = 0 | 1 | 2; // 0 left, 1 center, 2 right

interface FallingDecision {
  y: number; // world Y position of the falling object (in screen px)
  safe: Lane;
  question: string;
  answers: [string, string, string];
  resolved: boolean;
  // Per-lane visual state
  doorAnim: [number, number, number];
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
      return slowTimer > 0 ? base * 0.5 : base;
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

    const buildLevel = (lvl: number) => {
      const qs: GameQuestion[] = buildLevelQuestions(lvl, languageRef.current, usedIdsRef.current);
      queue = qs.map((item) => ({
        y: -120,
        safe: item.safe as Lane,
        question: item.prompt,
        answers: item.answers,
        resolved: false,
        doorAnim: [0, 0, 0],
        doorOutcome: [null, null, null],
      }));
      activeIdx = 0;
      powerups.length = 0;
      questionTimer = timePerQuestionForLevel(lvl);
      powerupTimer = 1.2 + Math.random() * 1.5;
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

    // Falling object (door panel) per lane of active decision
    const DOOR_W = 56;
    const DOOR_H = 70;
    const drawDoorPanel = (cx: number, topY: number, w: number, h: number, safe: boolean) => {
      const x = cx - w / 2;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + 2, topY + h, w - 4, 4);
      const g = ctx.createLinearGradient(x, topY, x, topY + h);
      if (safe) { g.addColorStop(0, "#8a6a4a"); g.addColorStop(1, "#3a2618"); }
      else { g.addColorStop(0, "#5a4536"); g.addColorStop(1, "#2a1a14"); }
      ctx.fillStyle = g;
      ctx.fillRect(x, topY, w, h);
      ctx.beginPath();
      ctx.fillStyle = g as unknown as string;
      ctx.arc(cx, topY, w / 2, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx, topY + h);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,210,160,0.55)";
      ctx.beginPath();
      ctx.arc(x + 6, topY + 10, 2, 0, Math.PI * 2);
      ctx.arc(x + w - 6, topY + 10, 2, 0, Math.PI * 2);
      ctx.arc(x + 6, topY + h - 10, 2, 0, Math.PI * 2);
      ctx.arc(x + w - 6, topY + h - 10, 2, 0, Math.PI * 2);
      ctx.fill();
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

    const drawActiveDecision = (dt: number) => {
      const d = queue[activeIdx];
      if (!d) return;
      // helper to draw an answer label above the falling door
      const drawAnswerLabel = (cx: number, topY: number, text: string) => {
        ctx.save();
        ctx.font = '600 13px "Cormorant Garamond", Georgia, serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const maxW = W / 3 - 14;
        // word-wrap to up to 2 lines
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          const test = cur ? cur + " " + w : w;
          if (ctx.measureText(test).width > maxW && cur) {
            lines.push(cur);
            cur = w;
            if (lines.length === 1) {
              // last line: append rest, truncate with ellipsis if needed
              const rest = words.slice(words.indexOf(w)).join(" ");
              let r = rest;
              while (ctx.measureText(r + "…").width > maxW && r.length > 1) r = r.slice(0, -1);
              if (r !== rest) r = r + "…";
              lines.push(r);
              cur = "";
              break;
            }
          } else cur = test;
        }
        if (cur) lines.push(cur);
        const lineH = 15;
        const boxH = lines.length * lineH + 6;
        const boxW = Math.min(maxW + 12, Math.max(...lines.map(l => ctx.measureText(l).width)) + 14);
        const bx = cx - boxW / 2;
        const by = topY - boxH;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.strokeStyle = "rgba(255, 220, 170, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const r = 6;
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + boxW - r, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
        ctx.lineTo(bx + boxW, by + boxH - r);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
        ctx.lineTo(bx + r, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff3d6";
        lines.forEach((l, idx) => {
          ctx.fillText(l, cx, by + 3 + (idx + 1) * lineH);
        });
        ctx.restore();
      };
      // Trailing light streaks per lane
      for (let i = 0; i < 3; i++) {
        const lx = laneX(i as Lane);
        const lg = ctx.createLinearGradient(lx, Math.max(0, d.y - 80), lx, d.y);
        lg.addColorStop(0, "rgba(255, 230, 180, 0)");
        lg.addColorStop(1, i === d.safe && hintActive === d.safe ? "rgba(255, 240, 180, 0.35)" : "rgba(255, 230, 180, 0.15)");
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 30, Math.max(0, d.y - 80), 60, 80);
      }
      for (let i = 0; i < 3; i++) {
        const outcome = d.doorOutcome[i];
        const cx = laneX(i as Lane);
        if (outcome) d.doorAnim[i] = Math.min(1, d.doorAnim[i] + dt * (outcome === "broken" ? 2.6 : 3.6));
        const anim = d.doorAnim[i];
        if (outcome && anim >= 1) continue;
        if (outcome === "open") {
          const a = 1 - anim;
          ctx.globalAlpha = a;
          drawDoorPanel(cx, d.y - DOOR_H + anim * 12, DOOR_W, DOOR_H, true);
          drawAnswerLabel(cx, d.y - DOOR_H + anim * 12 - 14, d.answers[i]);
          ctx.globalAlpha = 1;
          continue;
        }
        if (outcome === "broken") {
          const a = 1 - anim;
          ctx.globalAlpha = a;
          for (let s = 0; s < 5; s++) {
            const ang = (s / 5) * Math.PI * 2;
            const r = anim * 40;
            const px = cx + Math.cos(ang) * r;
            const py = d.y - DOOR_H / 2 + Math.sin(ang) * r;
            ctx.fillStyle = "#3a2a22";
            ctx.fillRect(px - 6, py - 8, 12, 16);
          }
          ctx.globalAlpha = 1;
          continue;
        }
        drawDoorPanel(cx, d.y - DOOR_H, DOOR_W, DOOR_H, i === d.safe);
        drawAnswerLabel(cx, d.y - DOOR_H - 14, d.answers[i]);
      }
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
            d.doorOutcome[lane] = correct ? "open" : "broken";
            // Other lanes: keep falling visually -> just mark them broken for animation off-screen later
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

        // Power-up spawn timer (between decisions)
        powerupTimer -= dt;
        if (powerupTimer <= 0) {
          spawnPowerup();
          powerupTimer = 1.8 + Math.random() * 2.2;
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
              <div className={"rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-widest backdrop-blur tabular-nums " + (timeLeft <= 2 ? "bg-rose-500/30 text-rose-100 ring-1 ring-rose-300/50" : "bg-black/45 text-amber-100")}>
                ⏱ {timeLeft.toFixed(1)}s
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
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay>
          <p className="text-xs uppercase tracking-[0.4em] text-rose-200/80">The wind took you</p>
          <h1 className="mt-3 text-4xl font-light tracking-[0.2em] text-amber-50">FALLEN</h1>
          <p className="mt-2 text-sm text-amber-100/70">
            You reached level {level}{level >= 11 ? " (endless)" : ""}.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-6 text-center">
            <Stat label="SCORE" value={score} />
            <Stat label="BEST" value={bestScore} />
            <Stat label="STREAK" value={streak} />
          </div>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] tracking-[0.3em] text-amber-200/70">{label}</span>
      <span className="mt-1 text-2xl font-light tabular-nums text-amber-50">{value}</span>
    </div>
  );
}
