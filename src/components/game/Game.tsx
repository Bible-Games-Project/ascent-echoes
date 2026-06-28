import { useEffect, useRef, useState } from "react";
import didacticJesusImg from "@/assets/didactic-jesus.png.asset.json";
import lostSheepImg from "@/assets/lost-sheep.png.asset.json";
import bibleUnlockedImg from "@/assets/bible-unlocked.png.asset.json";
import trueChristImg from "@/assets/true-christ.png.asset.json";
import {
  buildLevelQuestions,
  timePerQuestionForLevel,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
  type GameQuestion,
} from "./questionBank";
import { getT, type UIKey } from "./i18n";
import { getIsPremium, setIsPremium, simulateRewardedAd } from "@/lib/monetization";
import { music } from "@/lib/music";
import { sfx } from "@/lib/sfx";
import {
  getEquipped as getEquippedAvatar,
  recordAllDifficulties,
  recordBonus,
  recordCorrect,
  recordDayPlayed,
  recordGamePlayed,
  recordLevel,
  recordRank,
  recordScore,
  recordStreak,
  difficultyBitForLevel,
  ALL_DIFFICULTIES_MASK,
  type AvatarId,
} from "@/lib/avatars";
import { PlayerAvatar as AvatarIcon } from "./PlayerAvatar";
import { drawAvatarBody } from "./avatarRender";
import { motionFor, scaleMultiplierFor } from "./avatarMotion";
import { AvatarsOverlay } from "./AvatarsOverlay";
import {
  fetchRank,
  fetchTop10,
  getLocalBest,
  getPlayerId,
  getPlayerName,
  NAME_MAX,
  NAME_MIN,
  setPlayerName as savePlayerName,
  submitIfBest,
  syncDisplayName,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

type GameState = "start" | "playing" | "offer" | "gameover";
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
  const [correctTotal, setCorrectTotal] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isPremium, setIsPremiumState] = useState(false);
  const [maxLives, setMaxLives] = useState(2);
  const [extraLifeUsed, setExtraLifeUsed] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
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
  const [showLangPrompt, setShowLangPrompt] = useState<boolean>(() => {
    try { return !localStorage.getItem("btr_lang_set"); } catch { return true; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMoreGames, setShowMoreGames] = useState(false);
  const [topTen, setTopTen] = useState<LeaderboardEntry[] | null>(null);
  const [worldRank, setWorldRank] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [enteredTop10, setEnteredTop10] = useState(false);
  const [isWorldRecord, setIsWorldRecord] = useState(false);

  // Avatars (cosmetic only)
  const [equippedAvatar, setEquippedAvatar] = useState<AvatarId>("white_dove");
  const [showAvatars, setShowAvatars] = useState(false);
  const runDiffMaskRef = useRef(0);
  const equippedAvatarRef = useRef<AvatarId>("white_dove");
  useEffect(() => { equippedAvatarRef.current = equippedAvatar; }, [equippedAvatar]);

  // Dev mode (testing only — never affects real monetization or leaderboard)
  const [devMode, setDevMode] = useState<boolean>(() => {
    try { return localStorage.getItem("btr_dev_mode") === "1"; } catch { return false; }
  });
  const devModeRef = useRef(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [musicOn, setMusicOnState] = useState<boolean>(() => music.isEnabled());
  const toggleMusic = () => {
    const next = !musicOn;
    setMusicOnState(next);
    music.setEnabled(next);
    sfx.setEnabled(next);
  };

  // Ensure SFX stays in sync with the unified audio toggle on first load.
  useEffect(() => { sfx.setEnabled(music.isEnabled()); }, []);

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
  const correctTotalRef = useRef(0);
  const isPremiumRef = useRef(false);
  const maxLivesRef = useRef(2);
  const extraLifeUsedRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { isPremiumRef.current = isPremium; }, [isPremium]);
  useEffect(() => { maxLivesRef.current = maxLives; }, [maxLives]);
  useEffect(() => { extraLifeUsedRef.current = extraLifeUsed; }, [extraLifeUsed]);
  useEffect(() => { devModeRef.current = devMode; }, [devMode]);

  // Load premium flag from storage on mount.
  useEffect(() => {
    const p = getIsPremium();
    setIsPremiumState(p);
    isPremiumRef.current = p;
    const m = p ? 3 : 2;
    setMaxLives(m); maxLivesRef.current = m;
    setHealth(m); healthRef.current = m;
    setEquippedAvatar(getEquippedAvatar());
  }, []);
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
    // Defer the name prompt until after language selection is complete.
    if (!n) {
      try {
        if (localStorage.getItem("btr_lang_set")) setShowNamePrompt(true);
      } catch { setShowNamePrompt(true); }
    }
  }, []);

  // When language selection completes during first-time onboarding and no
  // name has been stored yet, ask for the name next. We re-check storage
  // directly to avoid racing the async playerName state hydration on reload
  // (which would otherwise re-open the prompt on every launch for users who
  // already have a saved name).
  useEffect(() => {
    if (showLangPrompt) return;
    if (!getPlayerName()) setShowNamePrompt(true);
  }, [showLangPrompt]);

  // Music routing by app state: menu plays Home, gameplay plays the level
  // track, game over stops music. Level transitions are handled inline.
  useEffect(() => {
    if (state === "start") {
      music.playHome();
    } else if (state === "gameover") {
      music.stop();
    }
  }, [state]);

  // Button click SFX: delegate from the game container so every button tap
  // plays a subtle pop without touching individual onClick handlers.
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button")) sfx.playClick();
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
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
    if (devModeRef.current) {
      // Dev mode runs never touch the leaderboard or saved best.
      (async () => {
        const top = await fetchTop10();
        if (!cancelled) setTopTen(top);
      })();
      return () => { cancelled = true; };
    }
    (async () => {
      // Always refresh the top 10 for display.
      const top = await fetchTop10();
      if (cancelled) return;
      setTopTen(top);

      let bestForRank = prevBest;
      if (finalScore > prevBest) {
        const res = await submitIfBest(finalScore);
        if (cancelled) return;
        bestForRank = res.best;
        bestRef.current = res.best;
        setBestScore(res.best);
        setIsNewBest(true);
        // Re-fetch leaderboard so the new placement is visible.
        const updated = await fetchTop10();
        if (cancelled) return;
        setTopTen(updated);
        if (res.rank != null) {
          setWorldRank(res.rank);
          setEnteredTop10(res.rank <= 10);
          setIsWorldRecord(res.rank === 1);
          recordRank(res.rank);
        }
      } else if (finalScore > 0) {
        const r = await fetchRank(finalScore);
        if (!cancelled) {
          setWorldRank(r);
          recordRank(r);
        }
      }
      // If we didn't already set rank (e.g. tied best), compute it from bestForRank.
      if (worldRank == null && bestForRank > 0) {
        const r = await fetchRank(bestForRank);
        if (!cancelled && r != null) { setWorldRank(r); recordRank(r); }
      }
      // Record best-ever single-run score (cosmetic stat only).
      if (finalScore > 0) recordScore(finalScore);
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
    let correctPulse = 0; // brightens dove briefly on correct answer
    let timeSec = 0; // for idle pulsing animation

    // Background level theme transition state
    let prevLevel = 1;
    let themeBlend = 1; // 0..1, 1 = fully on current theme

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
    let bonusSchedule: boolean[] = [];
    let lastBonusSpawnIdx = -1;
    let activeIdxTimer = 0;
    let lastTrackedActiveIdx = -1;
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
        y: -120,
        lane: Math.floor(Math.random() * 3) as Lane,
        type: pickType(),
        taken: false,
        bobSeed: Math.random() * Math.PI * 2,
      });
    };

    // Build a per-question bonus schedule: for every 10-question block, pick
    // 2..4 question indices, spread out (no two consecutive). Each scheduled
    // question spawns exactly one bonus when it becomes active.
    const buildBonusSchedule = (n: number): boolean[] => {
      const out = new Array<boolean>(n).fill(false);
      for (let start = 0; start < n; start += 10) {
        const len = Math.min(10, n - start);
        if (len <= 0) break;
        const count = Math.min(len, 2 + Math.floor(Math.random() * 3)); // 2..4
        const seg = len / count;
        let last = -2;
        for (let i = 0; i < count; i++) {
          const lo = Math.floor(i * seg);
          const hi = Math.max(lo, Math.floor((i + 1) * seg) - 1);
          let p = lo + Math.floor(Math.random() * (hi - lo + 1));
          if (p === last + 1) {
            if (p < hi) p += 1;
            else if (p > lo) p -= 1;
          }
          out[start + p] = true;
          last = p;
        }
      }
      return out;
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
      questionTimer = timePerQuestionForLevel(lvl);
      bonusSchedule = buildBonusSchedule(queue.length);
      lastBonusSpawnIdx = -1;
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

    // ----- Background (level-themed) -----
    type AmbientFx =
      | "none" | "leaves" | "rain" | "rain_light"
      | "snow" | "wind_snow" | "petals" | "night_sky";
    type SunCfg = {
      xFrac: number; yFrac: number; rFrac: number; haloRFrac: number;
      core: string; haloInner: string; haloMid: string; haloOuter: string;
    };
    type LayerDef = {
      color: string; baseFrac: number; amp: number; freq: number;
      speed: number; sharp?: boolean;
    };
    type Theme = {
      sky: [string, string, string, string];
      sun?: SunCfg;
      layers: LayerDef[];
      fx: AmbientFx;
      house?: boolean;
      ground: { top: string; bottom: string; rim: string };
    };

    const THEMES: Theme[] = [
      // 1 Desert sunset (UNCHANGED)
      {
        sky: ["#ffb178", "#ff8c61", "#c75b7a", "#5b3a78"],
        sun: { xFrac: 0.72, yFrac: 0.4, rFrac: 0.09, haloRFrac: 0.6,
          core: "#fff2c8",
          haloInner: "rgba(255,240,200,0.9)",
          haloMid: "rgba(255,200,140,0.5)",
          haloOuter: "rgba(255,140,100,0)" },
        layers: [
          { color: "rgba(120,60,100,0.55)", baseFrac: 0.62, amp: 18, freq: 0.006, speed: 0.4 },
          { color: "rgba(80,40,80,0.7)",    baseFrac: 0.70, amp: 26, freq: 0.009, speed: 0.7 },
          { color: "rgba(50,25,60,0.85)",   baseFrac: 0.78, amp: 34, freq: 0.012, speed: 1.0 },
        ],
        fx: "none",
        ground: { top: "#3a2540", bottom: "#1a0f25", rim: "rgba(255, 180, 120, 0.5)" },
      },
      // 2 Summer forest – pastel greens
      {
        sky: ["#dff1d4", "#bfe3b9", "#8fc99a", "#4f8b6b"],
        sun: { xFrac: 0.78, yFrac: 0.28, rFrac: 0.07, haloRFrac: 0.55,
          core: "#fbf6d6",
          haloInner: "rgba(250,245,200,0.7)",
          haloMid: "rgba(220,235,180,0.35)",
          haloOuter: "rgba(160,200,150,0)" },
        layers: [
          { color: "rgba(160,200,150,0.55)", baseFrac: 0.6,  amp: 14, freq: 0.005, speed: 0.4 },
          { color: "rgba(110,170,120,0.7)",  baseFrac: 0.7,  amp: 22, freq: 0.008, speed: 0.7 },
          { color: "rgba(60,110,80,0.9)",    baseFrac: 0.78, amp: 30, freq: 0.011, speed: 1.0 },
        ],
        fx: "none",
        ground: { top: "#2a4a32", bottom: "#10220f", rim: "rgba(210, 240, 190, 0.45)" },
      },
      // 3 Summer sea – pastel blues
      {
        sky: ["#d6eef7", "#aed8ec", "#7ab6d4", "#3a7fa3"],
        sun: { xFrac: 0.7, yFrac: 0.32, rFrac: 0.08, haloRFrac: 0.55,
          core: "#fff6dc",
          haloInner: "rgba(255,245,210,0.7)",
          haloMid: "rgba(220,230,240,0.3)",
          haloOuter: "rgba(140,180,210,0)" },
        layers: [
          { color: "rgba(150,200,220,0.55)", baseFrac: 0.64, amp: 10, freq: 0.012, speed: 0.4 },
          { color: "rgba(100,160,200,0.7)",  baseFrac: 0.72, amp: 14, freq: 0.018, speed: 0.75 },
          { color: "rgba(50,110,160,0.9)",   baseFrac: 0.8,  amp: 18, freq: 0.024, speed: 1.1 },
        ],
        fx: "none",
        ground: { top: "#1f3f5e", bottom: "#0c1e30", rim: "rgba(190, 225, 240, 0.5)" },
      },
      // 4 Autumn forest – warm orange/brown + falling leaves
      {
        sky: ["#f7e2c6", "#f0bf94", "#d68a64", "#7c4434"],
        layers: [
          { color: "rgba(210,150,90,0.55)",  baseFrac: 0.6,  amp: 16, freq: 0.006, speed: 0.4 },
          { color: "rgba(170,100,55,0.75)",  baseFrac: 0.7,  amp: 24, freq: 0.009, speed: 0.7 },
          { color: "rgba(100,55,35,0.92)",   baseFrac: 0.78, amp: 32, freq: 0.012, speed: 1.0 },
        ],
        fx: "leaves",
        ground: { top: "#5a2f1a", bottom: "#26120a", rim: "rgba(255, 200, 140, 0.5)" },
      },
      // 5 Autumn meadow + house + light rain
      {
        sky: ["#ecd9c0", "#d9b08c", "#a87359", "#553224"],
        layers: [
          { color: "rgba(200,165,120,0.55)", baseFrac: 0.62, amp: 10, freq: 0.005, speed: 0.35 },
          { color: "rgba(150,105,70,0.75)",  baseFrac: 0.71, amp: 16, freq: 0.008, speed: 0.65 },
          { color: "rgba(80,50,40,0.92)",    baseFrac: 0.79, amp: 22, freq: 0.011, speed: 1.0 },
        ],
        fx: "rain_light",
        ground: { top: "#3e2a1c", bottom: "#1a0f08", rim: "rgba(230, 200, 160, 0.45)" },
      },
      // 6 Winter forest – cold blue/white + snow
      {
        sky: ["#eaf2ff", "#d2e1f1", "#a6c1da", "#6a85a3"],
        layers: [
          { color: "rgba(210,225,240,0.6)",  baseFrac: 0.6,  amp: 14, freq: 0.005, speed: 0.4 },
          { color: "rgba(170,190,210,0.75)", baseFrac: 0.7,  amp: 22, freq: 0.008, speed: 0.7 },
          { color: "rgba(110,135,160,0.92)", baseFrac: 0.78, amp: 30, freq: 0.011, speed: 1.0 },
        ],
        fx: "snow",
        ground: { top: "#22364f", bottom: "#0b1422", rim: "rgba(220, 235, 250, 0.55)" },
      },
      // 7 Winter mountain – sharp peaks + wind & snow
      {
        sky: ["#e6ecf3", "#c5d2e0", "#90a6bd", "#566c86"],
        layers: [
          { color: "rgba(200,215,230,0.6)",  baseFrac: 0.62, amp: 40, freq: 0.004, speed: 0.3, sharp: true },
          { color: "rgba(150,170,195,0.78)", baseFrac: 0.72, amp: 60, freq: 0.006, speed: 0.6, sharp: true },
          { color: "rgba(80,100,130,0.95)",  baseFrac: 0.82, amp: 80, freq: 0.009, speed: 1.0, sharp: true },
        ],
        fx: "wind_snow",
        ground: { top: "#2a384a", bottom: "#10171f", rim: "rgba(210, 225, 240, 0.55)" },
      },
      // 8 Spring forest – soft green/pink + light rain
      {
        sky: ["#f6e1ec", "#e6e7d2", "#bedcb8", "#7fb597"],
        layers: [
          { color: "rgba(190,220,180,0.55)", baseFrac: 0.6,  amp: 14, freq: 0.005, speed: 0.4 },
          { color: "rgba(140,190,150,0.72)", baseFrac: 0.7,  amp: 22, freq: 0.008, speed: 0.7 },
          { color: "rgba(90,140,110,0.9)",   baseFrac: 0.78, amp: 30, freq: 0.011, speed: 1.0 },
        ],
        fx: "rain_light",
        ground: { top: "#2e4a32", bottom: "#11200f", rim: "rgba(220, 240, 215, 0.5)" },
      },
      // 9 Spring meadow – floral petals
      {
        sky: ["#f6dcdc", "#eab4b4", "#b66a6a", "#5a2229"],
        sun: { xFrac: 0.76, yFrac: 0.28, rFrac: 0.06, haloRFrac: 0.5,
          core: "#fff0e6",
          haloInner: "rgba(255,220,210,0.55)",
          haloMid: "rgba(230,160,160,0.3)",
          haloOuter: "rgba(150,50,60,0)" },
        layers: [
          { color: "rgba(210,140,140,0.55)", baseFrac: 0.62, amp: 12, freq: 0.005, speed: 0.4 },
          { color: "rgba(160,80,85,0.75)",   baseFrac: 0.71, amp: 20, freq: 0.008, speed: 0.7 },
          { color: "rgba(85,30,40,0.92)",    baseFrac: 0.79, amp: 28, freq: 0.011, speed: 1.0 },
        ],
        fx: "petals",
        ground: { top: "#4a1e24", bottom: "#1f0a0d", rim: "rgba(245, 200, 200, 0.5)" },
      },
      // 10 Night sky – stars & shooting stars
      {
        sky: ["#1a2244", "#1f2a52", "#1a2046", "#0c1028"],
        layers: [
          { color: "rgba(40,55,95,0.7)",   baseFrac: 0.64, amp: 18, freq: 0.005, speed: 0.4 },
          { color: "rgba(25,35,70,0.85)",  baseFrac: 0.72, amp: 26, freq: 0.008, speed: 0.7 },
          { color: "rgba(10,15,40,0.95)",  baseFrac: 0.8,  amp: 34, freq: 0.011, speed: 1.0 },
        ],
        fx: "night_sky",
        ground: { top: "#162046", bottom: "#06091c", rim: "rgba(180, 200, 240, 0.5)" },
      },
    ];

    const themeFor = (lvl: number): Theme =>
      THEMES[Math.min(Math.max(1, lvl), 10) - 1];

    const drawLayer = (l: LayerDef, offset: number, baseYOverride?: number) => {
      ctx.fillStyle = l.color;
      ctx.beginPath();
      const baseY = baseYOverride ?? H * l.baseFrac;
      const yAt = (x: number): number => {
        if (l.sharp) {
          const t = ((x + offset) * l.freq) / Math.PI;
          const frac = ((t % 1) + 1) % 1;
          const tri = 1 - 2 * Math.abs(frac - 0.5);
          return baseY - l.amp * Math.max(0, tri);
        }
        return baseY
          + Math.sin((x + offset) * l.freq) * l.amp
          + Math.sin((x + offset) * l.freq * 2.3) * l.amp * 0.3;
      };
      ctx.moveTo(0, H);
      ctx.lineTo(0, yAt(0));
      for (let x = 8; x < W; x += 8) {
        ctx.lineTo(x, yAt(x));
      }
      // Always end the silhouette with the exact right-edge sample, then
      // drop straight down to the bottom-right corner. This removes the
      // diagonal slope previously caused by jumping from the last 8px
      // sample directly to (W, H).
      ctx.lineTo(W, yAt(W));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    };

    const drawSun = (s: SunCfg) => {
      const sunX = W * s.xFrac, sunY = H * s.yFrac;
      const haloR = H * s.haloRFrac;
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloR);
      sg.addColorStop(0, s.haloInner);
      sg.addColorStop(0.15, s.haloMid);
      sg.addColorStop(1, s.haloOuter);
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
      ctx.beginPath();
      ctx.fillStyle = s.core;
      ctx.arc(sunX, sunY, Math.min(W, H) * s.rFrac, 0, Math.PI * 2);
      ctx.fill();
    };

    const stars: { x: number; y: number; r: number; p: number }[] = [];
    const ensureStars = () => {
      if (stars.length) return;
      for (let i = 0; i < 100; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random() * 0.62,
          r: 0.4 + Math.random() * 1.4,
          p: Math.random() * Math.PI * 2,
        });
      }
    };
    const drawNightSky = () => {
      ensureStars();
      for (const s of stars) {
        const a = 0.5 + 0.5 * Math.sin(timeSec * 2 + s.p);
        ctx.fillStyle = `rgba(255,255,255,${(0.35 + a * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Moon
      const mx = W * 0.78, my = H * 0.22, mr = Math.min(W, H) * 0.06;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4);
      mg.addColorStop(0, "rgba(245,240,220,0.45)");
      mg.addColorStop(1, "rgba(245,240,220,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);
      ctx.beginPath();
      ctx.fillStyle = "rgba(245,240,220,0.95)";
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawHouse = () => {
      const hx = W * 0.72, hy = H * 0.68;
      ctx.fillStyle = "rgba(70,45,40,0.92)";
      ctx.fillRect(hx - 22, hy - 26, 44, 30);
      ctx.beginPath();
      ctx.moveTo(hx - 28, hy - 26);
      ctx.lineTo(hx, hy - 50);
      ctx.lineTo(hx + 28, hy - 26);
      ctx.closePath();
      ctx.fillStyle = "rgba(50,30,30,0.95)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,140,0.85)";
      ctx.fillRect(hx - 6, hy - 14, 12, 12);
      // chimney
      ctx.fillStyle = "rgba(60,40,35,0.9)";
      ctx.fillRect(hx + 10, hy - 44, 6, 12);
    };

    const drawTheme = (t: Theme, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      const stops = [0, 0.4, 0.75, 1];
      t.sky.forEach((c, i) => g.addColorStop(stops[i], c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (t.fx === "night_sky") drawNightSky();
      if (t.sun) drawSun(t.sun);
      // Anchor background silhouettes to the gameplay ground (lane platform
      // top) with a small visual gap, instead of letting them float low on
      // the viewport. The nearest layer sits just above the platform; the
      // mid/far layers preserve their original relative spacing.
      // Anchor background silhouettes to the gameplay ground (lane platform
      // top). The nearest layer's BASE sits just above the platform so the
      // hill bodies are clearly visible above the lane surface and the
      // scene feels attached to the ground (not stuck at the viewport bottom).
      const platTopRef = H * PLAYER_Y_FRAC + 22;
      const NEAR_LIFT = Math.max(120, H * 0.2);
      const nearFrac = t.layers.reduce((m, l) => Math.max(m, l.baseFrac), 0);
      t.layers.forEach((l) => {
        const baseY = (platTopRef - NEAR_LIFT) - (nearFrac - l.baseFrac) * H;
        drawLayer(l, -bgDrift * l.speed, baseY);
      });
      if (t.house) drawHouse();
      ctx.restore();
    };

    const drawBackground = () => {
      const cur = themeFor(levelRef.current);
      if (themeBlend < 1 && prevLevel !== levelRef.current) {
        const prev = themeFor(prevLevel);
        drawTheme(prev, 1);
        drawTheme(cur, themeBlend);
      } else {
        drawTheme(cur, 1);
      }
    };

    // ----- Ambient FX particles -----
    type FxKind = "leaf" | "rain" | "snow" | "petal" | "wind" | "shoot";
    type FxP = {
      kind: FxKind; x: number; y: number; vx: number; vy: number;
      life: number; max: number; rot: number; vr: number; size: number; alpha: number;
    };
    const fxParticles: FxP[] = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const spawnRate = (rate: number, dt: number, fn: () => void) => {
      let n = rate * dt;
      while (n > 0) { if (n >= 1 || Math.random() < n) fn(); n -= 1; }
    };
    const spawnFxFor = (fx: AmbientFx, dt: number) => {
      switch (fx) {
        case "leaves":
          spawnRate(3, dt, () => fxParticles.push({
            kind: "leaf", x: rand(-20, W + 20), y: -10,
            vx: rand(-30, 20), vy: rand(20, 45),
            life: 0, max: rand(7, 11), rot: rand(0, Math.PI * 2),
            vr: rand(-1, 1), size: rand(5, 9), alpha: rand(0.65, 0.9),
          }));
          break;
        case "rain":
          spawnRate(60, dt, () => fxParticles.push({
            kind: "rain", x: rand(-50, W), y: -10,
            vx: 80, vy: 600,
            life: 0, max: 1.5, rot: 0, vr: 0,
            size: rand(8, 14), alpha: rand(0.3, 0.55),
          }));
          break;
        case "rain_light":
          spawnRate(22, dt, () => fxParticles.push({
            kind: "rain", x: rand(-50, W), y: -10,
            vx: 60, vy: 480,
            life: 0, max: 1.5, rot: 0, vr: 0,
            size: rand(6, 10), alpha: rand(0.22, 0.4),
          }));
          break;
        case "snow":
          spawnRate(25, dt, () => fxParticles.push({
            kind: "snow", x: rand(-10, W + 10), y: -10,
            vx: rand(-15, 15), vy: rand(28, 55),
            life: 0, max: rand(10, 16), rot: rand(0, Math.PI * 2),
            vr: rand(-0.5, 0.5), size: rand(1.5, 3.2), alpha: rand(0.6, 0.95),
          }));
          break;
        case "wind_snow":
          spawnRate(36, dt, () => fxParticles.push({
            kind: "snow", x: rand(-20, W + 10), y: -10,
            vx: rand(60, 130), vy: rand(40, 80),
            life: 0, max: rand(5, 9), rot: 0, vr: 0,
            size: rand(1, 2.5), alpha: rand(0.5, 0.9),
          }));
          spawnRate(8, dt, () => fxParticles.push({
            kind: "wind", x: rand(-50, W), y: rand(0, H * 0.7),
            vx: rand(200, 280), vy: 0,
            life: 0, max: rand(0.6, 1.2), rot: 0, vr: 0,
            size: rand(20, 55), alpha: rand(0.12, 0.28),
          }));
          break;
        case "petals":
          spawnRate(4, dt, () => fxParticles.push({
            kind: "petal", x: rand(-10, W + 10), y: -10,
            vx: rand(-20, 20), vy: rand(20, 35),
            life: 0, max: rand(8, 12), rot: rand(0, Math.PI * 2),
            vr: rand(-1.2, 1.2), size: rand(2.5, 4.5), alpha: rand(0.7, 0.95),
          }));
          break;
        case "night_sky":
          if (Math.random() < dt / 4) {
            fxParticles.push({
              kind: "shoot", x: rand(W * 0.1, W * 0.9), y: rand(20, H * 0.3),
              vx: rand(-280, -180), vy: rand(60, 120),
              life: 0, max: 0.9, rot: 0, vr: 0,
              size: rand(50, 90), alpha: 0.95,
            });
          }
          break;
      }
    };
    const updateDrawFx = (dt: number) => {
      for (let i = fxParticles.length - 1; i >= 0; i--) {
        const p = fxParticles[i];
        p.life += dt;
        if (p.kind === "snow" || p.kind === "petal" || p.kind === "leaf") {
          p.vx += Math.sin(p.life * 1.5 + p.rot) * 6 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const fade = 1 - Math.max(0, (p.life - (p.max - 0.5)) / 0.5);
        const a = p.alpha * Math.max(0, Math.min(1, fade));
        ctx.save();
        ctx.globalAlpha = a;
        switch (p.kind) {
          case "leaf":
            ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = "#d6915a";
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "rain":
            ctx.strokeStyle = "rgba(210,225,240,1)";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.size * 0.18, p.y + p.size);
            ctx.stroke();
            break;
          case "snow":
            ctx.fillStyle = "rgba(255,255,255,1)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "wind":
            ctx.strokeStyle = "rgba(235,242,255,1)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.size, p.y);
            ctx.stroke();
            break;
          case "petal":
            ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = "#f4c2d0";
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "shoot": {
            const ang = Math.atan2(p.vy, p.vx);
            const tx = p.x - Math.cos(ang) * p.size;
            const ty = p.y - Math.sin(ang) * p.size;
            const g = ctx.createLinearGradient(p.x, p.y, tx, ty);
            g.addColorStop(0, "rgba(255,255,255,0.95)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.strokeStyle = g;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,1)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }
        ctx.restore();
        const dead = p.life >= p.max || p.y > H + 30 || p.x < -120 || p.x > W + 120;
        if (dead) fxParticles.splice(i, 1);
      }
    };

    // Lane platforms at bottom
    const drawGround = () => {
      const platTop = H * PLAYER_Y_FRAC + 22;
      const platH = 18;
      const gr = themeFor(levelRef.current).ground;
      const laneW = 48;

      // Single continuous ground rectangle spanning the full width,
      // from the platform top down to the bottom edge of the canvas.
      ctx.fillStyle = gr.bottom;
      ctx.fillRect(0, platTop, W, H - platTop);

      // Top surface band of the platform
      ctx.fillStyle = gr.top;
      ctx.fillRect(0, platTop, W, platH);

      // Bright rim highlight along the top edge
      ctx.fillStyle = gr.rim;
      ctx.fillRect(0, platTop, W, 2);

      // Soft shadow line under the platform surface
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, platTop + platH, W, 8);

      // Subtle internal lane guides (visual only — gameplay lanes unchanged)
      for (let i = 0; i < 2; i++) {
        const lx = (laneX(i as Lane) + laneX((i + 1) as Lane)) / 2;
        const lg = ctx.createLinearGradient(0, platTop, 0, H);
        lg.addColorStop(0, "rgba(0,0,0,0.18)");
        lg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 0.5, platTop + platH + 8, 1, H - (platTop + platH + 8));
      }
    };

    const drawActiveDecision = (dt: number) => {
      const d = queue[activeIdx];
      if (!d) return;
      // helper to draw an answer label above the falling door
      const drawAnswerLabel = (cx: number, topY: number, text: string) => {
        ctx.save();
        ctx.font = '600 16px "Cormorant Garamond", Georgia, serif';
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
        const lineH = 18;
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
      for (let i = 0; i < 3; i++) {
        const outcome = d.doorOutcome[i];
        const cx = laneX(i as Lane);
        if (outcome) d.doorAnim[i] = Math.min(1, d.doorAnim[i] + dt * 3);
        const anim = d.doorAnim[i];
        if (outcome && anim >= 1) continue;
        if (hintActive === i) {
          const t = performance.now() / 1000;
          const pulse = 1 + Math.sin(t * 4) * 0.15;
          const r = 65 * pulse;
          const g = ctx.createRadialGradient(cx, d.y - 20, 0, cx, d.y - 20, r);
          g.addColorStop(0, "rgba(255, 250, 200, 0.5)");
          g.addColorStop(1, "rgba(255, 250, 200, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, d.y - 20 - r, r * 2, r * 2);
        }
        const alpha = outcome ? 1 - anim : 1;
        ctx.globalAlpha = alpha;
        drawAnswerLabel(cx, d.y, d.answers[i]);
        ctx.globalAlpha = 1;
      }
    };

    // ----- Powerups -----
    const drawPowerupIcon = (type: PowerupType) => {
      switch (type) {
        case "star": {
          // Soft glow halo behind the star to match the game's luminous palette
          const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
          halo.addColorStop(0, "rgba(255, 236, 180, 0.55)");
          halo.addColorStop(1, "rgba(255, 236, 180, 0)");
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
          // Star body — soft warm ivory, no harsh outline
          const grad = ctx.createRadialGradient(0, -2, 1, 0, 0, 12);
          grad.addColorStop(0, "rgba(255, 248, 220, 0.98)");
          grad.addColorStop(1, "rgba(240, 200, 130, 0.95)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const ang = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 === 0 ? 12 : 5;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
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

    // ----- Player draw (Dove of Light: minimal glowing silhouette) -----
    const drawPlayer = () => {
      const x = player.x;
      const y = playerY() + player.knock;
      const wrong = player.knock < 0;
      const flicker = invuln > 0 && Math.floor(invuln * 20) % 2 === 0;
      const dimming = wrong ? 0.45 + 0.55 * Math.abs(Math.sin(timeSec * 40)) : 1;

      // Idle breathing pulse
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 2.2);
      // Glow intensity from states
      let glowBoost = 0;
      if (correctPulse > 0) glowBoost = Math.max(glowBoost, correctPulse / 0.6);
      if (hintActive !== null) glowBoost = Math.max(glowBoost, 0.45);
      const baseGlow = 0.35 + 0.12 * pulse + 0.55 * glowBoost;
      const glowRadius = 55 + 10 * pulse + 30 * glowBoost;

      // Invincibility golden aura
      if (invuln > 0) {
        const ag = ctx.createRadialGradient(x, y, 0, x, y, glowRadius + 30);
        ag.addColorStop(0, "rgba(255, 210, 110, 0.55)");
        ag.addColorStop(0.5, "rgba(255, 190, 80, 0.25)");
        ag.addColorStop(1, "rgba(255, 190, 80, 0)");
        ctx.fillStyle = ag;
        ctx.fillRect(x - (glowRadius + 30), y - (glowRadius + 30), (glowRadius + 30) * 2, (glowRadius + 30) * 2);
      }

      // Soft white/gold glow halo
      const gg = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      const goldMix = invuln > 0 ? 1 : 0.35;
      const r = 255;
      const g = Math.round(245 - 30 * goldMix);
      const b = Math.round(220 - 90 * goldMix);
      gg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.55 * baseGlow * dimming})`);
      gg.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gg;
      ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

      if (flicker) return;

      // Render the equipped avatar via the shared renderer — same code path
      // used by the menu / HUD / leaderboard previews, so what the player
      // selects is exactly what they see flying in-game.
      const bodyAlpha = (0.9 + 0.1 * pulse) * dimming;
      // Drive the same per-avatar idle motion the Avatar Menu uses, so the
      // in-game silhouette flickers/sways/spins/floats identically to the
      // preview. Motion is applied via transform; intrinsic part motion
      // (flame, pages, fish tail) is driven by `t` inside drawAvatarBody.
      const m = motionFor(equippedAvatarRef.current, timeSec, 3);
      ctx.save();
      ctx.shadowColor = invuln > 0 ? "rgba(255, 210, 120, 0.9)" : "rgba(255, 245, 220, 0.85)";
      ctx.shadowBlur = 16 + 14 * glowBoost;
      ctx.translate(x + m.dx, y + m.dy);
      if (m.rot) ctx.rotate(m.rot);
      if (m.sx !== 1) ctx.scale(m.sx, 1);
      drawAvatarBody(ctx, equippedAvatarRef.current, 0, 0, {
        alpha: bodyAlpha,
        flap: m.flap,
        scale: 2 * scaleMultiplierFor(equippedAvatarRef.current),
        glow: invuln > 0 || correctPulse > 0,
        t: timeSec,
      });
      ctx.restore();

      // Bombilla hint: subtle light beam toward safe lane (no UI changes)
      if (hintActive !== null) {
        const targetX = laneX(hintActive);
        const grd = ctx.createLinearGradient(x, y, targetX, y - 40);
        grd.addColorStop(0, "rgba(255, 240, 180, 0.35)");
        grd.addColorStop(1, "rgba(255, 240, 180, 0)");
        ctx.strokeStyle = grd;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(targetX, y - 80);
        ctx.stroke();
      }
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

    const reset = (startLevel: number = 1) => {
      player.lane = 1;
      player.targetLane = 1;
      player.x = laneX(1);
      player.knock = 0;
      shake = 0; flash = 0; invuln = 0;
      slowTimer = 0; distortTimer = 0;
      hintActive = null;
      particles.length = 0;
      powerups.length = 0;
      const startMax = (isPremiumRef.current || devModeRef.current) ? 3 : 2;
      maxLivesRef.current = startMax; setMaxLives(startMax);
      setHealth(startMax); healthRef.current = startMax;
      extraLifeUsedRef.current = false; setExtraLifeUsed(false);
      setProgress(0); progressRef.current = 0;
      scoreRef.current = 0; setScore(0);
      streakRef.current = 0; setStreak(0);
      correctTotalRef.current = 0; setCorrectTotal(0);
      setHintLane(null); setDistortion(0); setMultiplierToast(null);
      setCurrentQuestion(null); setCurrentAnswers(null);
      const lvl = Math.max(1, Math.floor(startLevel));
      levelRef.current = lvl; setLevel(lvl);
      // Reset themed-background crossfade so the chosen level renders immediately.
      prevLevel = lvl; themeBlend = 1;
      runTimeRef.current = 0; setRunTime(0);
      usedIdsRef.current = new Set();
      buildLevel(lvl);
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
        // Free players get one rewarded-ad continue per run.
        if (!isPremiumRef.current && !devModeRef.current && !extraLifeUsedRef.current) {
          stateRef.current = "offer"; setState("offer");
          return;
        }
        if (!devModeRef.current && scoreRef.current > bestRef.current) {
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
        if (!devModeRef.current && scoreRef.current > bestRef.current) {
          bestRef.current = scoreRef.current;
          setBestScore(scoreRef.current);
          try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
        }
        prevLevel = levelRef.current;
        const nextLvl = levelRef.current + 1;
        levelRef.current = nextLvl;
        themeBlend = 0;
        setLevel(nextLvl);
        buildLevel(nextLvl);
        if (!devModeRef.current) recordLevel(nextLvl);
        music.playLevel(nextLvl);
        return;
      }
      // Reset timer + hint for the next decision
      questionTimer = timePerQuestionForLevel(levelRef.current);
      hintActive = null;
      setHintLane(null);
    };

    const loop = (now: number) => {
      const dtRaw = Math.min(0.05, (now - last) / 1000);
      const dt = stateRef.current === "playing" ? dtRaw * turboRef.current : dtRaw;
      last = now;
      bgDrift += dt * 18;
      timeSec += dt;
      if (correctPulse > 0) correctPulse = Math.max(0, correctPulse - dt);

      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake = Math.max(0, shake - dt * 60);
      }

      drawBackground();
      if (themeBlend < 1) themeBlend = Math.min(1, themeBlend + dt * 0.8);
      const __curFx = themeFor(levelRef.current).fx;
      if (__curFx !== "none") spawnFxFor(__curFx, dt);
      updateDrawFx(dt);

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
              sfx.playCorrect();
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
              correctTotalRef.current += 1; setCorrectTotal(correctTotalRef.current);
              correctPulse = 0.6;
              // Lifetime stats for avatar progression (cosmetic).
              if (!devModeRef.current) {
                recordCorrect();
                recordStreak(newStreak);
                runDiffMaskRef.current |= difficultyBitForLevel(levelRef.current);
                if (runDiffMaskRef.current === ALL_DIFFICULTIES_MASK) {
                  recordAllDifficulties();
                }
              }
              if (newMult > prevMult) {
                setMultiplierToast(newMult);
                setTimeout(() => setMultiplierToast(null), 1400);
              }
            } else {
              sfx.playWrong();
              damage(player.x, playerY());
            }
            onDecisionResolvedAdvance();
          }
        }

        // Track how long the current question/answers have been falling so we
        // can offset bonus spawn by exactly half the travel time T.
        if (activeIdx !== lastTrackedActiveIdx) {
          lastTrackedActiveIdx = activeIdx;
          activeIdxTimer = 0;
        } else {
          activeIdxTimer += dt;
        }

        // Spawn at most ONE bonus per question, only if scheduled for this
        // index, and only AFTER T/2 of the answers' travel time has passed.
        const halfTravel = timePerQuestionForLevel(levelRef.current) / 2;
        if (
          activeIdx !== lastBonusSpawnIdx &&
          bonusSchedule[activeIdx] === true &&
          queue[activeIdx] && !queue[activeIdx].resolved &&
          activeIdxTimer >= halfTravel
        ) {
          spawnPowerup();
          lastBonusSpawnIdx = activeIdx;
        }

        // Power-ups fall at the same global speed as answers
        const ps = fallSpeed();
        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i];
          if (p.taken) { powerups.splice(i, 1); continue; }
          p.y += ps * dt;
          // Pickup test (lane match, near player Y)
          if (!p.taken && p.lane === player.lane && p.y >= playerY() - 16 && p.y <= playerY() + 24) {
            p.taken = true;
            applyPowerup(p);
            if (p.type === "apple" || p.type === "broken") {
              sfx.playPenalty();
            } else {
              sfx.playBonus();
            }
            if (!devModeRef.current) recordBonus();
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

    (canvas as unknown as { __reset?: (startLevel?: number) => void }).__reset = reset;

    // ----- Input -----
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    const turboRef = { current: 1 };
    const setTurbo = (on: boolean) => { turboRef.current = on ? 3 : 1; };
    const TURBO_HOLD_MS = 600;
    const TURBO_MOVE_TOL = 12;
    let turboHoldTimer: ReturnType<typeof setTimeout> | null = null;
    const clearTurboHold = () => {
      if (turboHoldTimer !== null) { clearTimeout(turboHoldTimer); turboHoldTimer = null; }
    };
    const armTurboHold = () => {
      clearTurboHold();
      turboHoldTimer = setTimeout(() => { setTurbo(true); turboHoldTimer = null; }, TURBO_HOLD_MS);
    };
    const releaseTurbo = () => { clearTurboHold(); setTurbo(false); };

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
    const onTouchMoveTurbo = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > TURBO_MOVE_TOL || Math.abs(dy) > TURBO_MOVE_TOL) {
        clearTurboHold();
      }
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
    let mouseDownX = 0, mouseDownY = 0;
    const onMouseDownTurbo = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownX = e.clientX; mouseDownY = e.clientY;
      armTurboHold();
    };
    const onMouseMoveTurbo = (e: MouseEvent) => {
      if (turboHoldTimer === null) return;
      if (Math.abs(e.clientX - mouseDownX) > TURBO_MOVE_TOL ||
          Math.abs(e.clientY - mouseDownY) > TURBO_MOVE_TOL) {
        clearTurboHold();
      }
    };
    const onMouseUpTurbo = () => releaseTurbo();
    const onMouseLeaveTurbo = () => releaseTurbo();
    const onTouchStartTurbo = () => armTurboHold();
    const onTouchEndTurbo = () => releaseTurbo();

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousedown", onMouseDownTurbo);
    canvas.addEventListener("mousemove", onMouseMoveTurbo);
    window.addEventListener("mouseup", onMouseUpTurbo);
    canvas.addEventListener("mouseleave", onMouseLeaveTurbo);
    canvas.addEventListener("touchstart", onTouchStartTurbo, { passive: true });
    canvas.addEventListener("touchmove", onTouchMoveTurbo, { passive: true });
    canvas.addEventListener("touchend", onTouchEndTurbo, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEndTurbo, { passive: true });
    window.addEventListener("keydown", onKey);

    player.x = laneX(1);

    raf = requestAnimationFrame((t) => { last = t; loop(t); });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousedown", onMouseDownTurbo);
      canvas.removeEventListener("mousemove", onMouseMoveTurbo);
      window.removeEventListener("mouseup", onMouseUpTurbo);
      canvas.removeEventListener("mouseleave", onMouseLeaveTurbo);
      canvas.removeEventListener("touchstart", onTouchStartTurbo);
      canvas.removeEventListener("touchmove", onTouchMoveTurbo);
      canvas.removeEventListener("touchend", onTouchEndTurbo);
      canvas.removeEventListener("touchcancel", onTouchEndTurbo);
      window.removeEventListener("keydown", onKey);
      clearTurboHold();
    };
  }, []);

  const startGame = () => {
    if (!playerName) { setShowNamePrompt(true); return; }
    if (devMode) { setShowLevelSelect(true); return; }
    const c = canvasRef.current as unknown as { __reset?: (startLevel?: number) => void } | null;
    c?.__reset?.();
    setState("playing");
    stateRef.current = "playing";
    runDiffMaskRef.current = 0;
    recordGamePlayed();
    recordDayPlayed();
    recordLevel(1);
    music.playLevel(1);
  };

  const startGameAtLevel = (lvl: number) => {
    setShowLevelSelect(false);
    const c = canvasRef.current as unknown as { __reset?: (startLevel?: number) => void } | null;
    c?.__reset?.(lvl);
    setState("playing");
    stateRef.current = "playing";
    runDiffMaskRef.current = 0;
    // dev runs intentionally don't bump stats — left untouched
    music.playLevel(lvl);
  };

  const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    devModeRef.current = next;
    try { localStorage.setItem("btr_dev_mode", next ? "1" : "0"); } catch { /* ignore */ }
  };

  const handleSaveName = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) return;
    const saved = savePlayerName(trimmed);
    setPlayerNameState(saved);
    setShowNamePrompt(false);
    setShowSettings(false);
    // Sync the new display name onto this device's existing leaderboard row
    // (same Player ID, same Best Score, same World Rank). Then refresh the
    // visible top 10 so the rename is reflected immediately.
    void (async () => {
      const ok = await syncDisplayName();
      if (ok) {
        const top = await fetchTop10();
        setTopTen(top);
      }
    })();
  };

  const t = getT(language);

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
          {/* Top HUD: left group (lives/score/questions), right group (level/streak), home button */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                {maxLives < 3 && <LockedHeart />}
                {[0, 1, 2].map((i) => {
                  if (i >= maxLives) return null;
                  return <Heart key={i} filled={i < health} />;
                })}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                <span className="text-amber-200/70">{t("score")}</span>
                <span className="text-amber-50 tabular-nums">{Math.max(0, Math.floor(Number(score) || 0))}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                <span className="text-amber-200/70">{t("questions")}</span>
                <span className="text-amber-50 tabular-nums">{correctTotal}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                  <span className="text-amber-200/70">{t("level")} </span>
                  <span className="text-amber-50 tabular-nums">{level}</span>
                  {level >= 11 && <span className="ml-1 text-amber-300/80">∞</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(true)}
                  aria-label="Exit to menu"
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-amber-100 ring-1 ring-amber-200/30 backdrop-blur transition hover:bg-black/70"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 11l9-8 9 8" />
                    <path d="M5 10v10h14V10" />
                    <path d="M10 20v-6h4v6" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-amber-100 backdrop-blur">
                <span className="text-amber-200/70">{t("streak")}</span>
                <span className="text-amber-50 tabular-nums">{streak}</span>
                {streak > 0 && <span>🔥</span>}
                <span className={"ml-1 rounded-full px-1.5 py-0.5 tabular-nums " + (multiplierForStreak(streak) > 1 ? "bg-amber-300/30 text-amber-100 ring-1 ring-amber-200/40" : "text-amber-100/60")}>
                  x{multiplierForStreak(streak)}
                </span>
              </div>
            </div>
          </div>

          {showExitConfirm && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm animate-fade-in">
              <div className="mx-4 max-w-xs rounded-2xl border border-amber-200/30 bg-black/80 p-5 text-center text-amber-50 shadow-[0_0_40px_rgba(255,200,140,0.25)]">
                <p className="text-sm tracking-wide" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 18 }}>
                  {t("exitConfirm")}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExitConfirm(false);
                      if (!devModeRef.current && scoreRef.current > bestRef.current) {
                        bestRef.current = scoreRef.current;
                        setBestScore(scoreRef.current);
                        try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
                      }
                      stateRef.current = "start"; setState("start");
                    }}
                    className="rounded-full bg-amber-300/30 px-5 py-1.5 text-xs font-medium tracking-[0.3em] text-amber-50 ring-1 ring-amber-200/50 transition hover:bg-amber-300/40"
                  >
                    {t("yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExitConfirm(false)}
                    className="rounded-full bg-black/50 px-5 py-1.5 text-xs font-medium tracking-[0.3em] text-amber-100 ring-1 ring-amber-200/30 transition hover:bg-black/70"
                  >
                    {t("no")}
                  </button>
                </div>
              </div>
            </div>
          )}

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
                x{multiplierToast} {t("multiplierActive")}
              </div>
            </div>
          )}
        </>
      )}

      {state === "start" && (
        <Overlay>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label={t("settings")}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/40 bg-black/40 text-amber-100/85 backdrop-blur transition hover:border-amber-200/70 hover:text-amber-50 active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.13-1.4l2.05-1.6-2-3.46-2.4.96a8 8 0 0 0-2.42-1.4L14.6 2h-4l-.5 2.6a8 8 0 0 0-2.42 1.4l-2.4-.96-2 3.46 2.05 1.6A8 8 0 0 0 4 12c0 .48.05.95.13 1.4L2.08 15l2 3.46 2.4-.96a8 8 0 0 0 2.42 1.4l.5 2.6h4l.5-2.6a8 8 0 0 0 2.42-1.4l2.4.96 2-3.46-2.05-1.6c.08-.45.13-.92.13-1.4Z"
              />
            </svg>
          </button>
          <h1 className="text-center text-4xl font-light tracking-[0.25em] text-amber-50 drop-shadow-[0_2px_24px_rgba(255,180,120,0.5)]">
            BIBLE TRIVIA RUN
          </h1>
          <p className="mt-3 max-w-xs text-center text-xs font-light tracking-wide text-amber-100/60">
            {t("tagline")}
          </p>
          <button
            onClick={startGame}
            className="mt-10 rounded-full bg-amber-100 px-14 py-5 text-lg font-medium tracking-[0.3em] text-stone-900 shadow-[0_0_60px_rgba(255,200,140,0.65)] transition-transform hover:scale-105 active:scale-95"
          >
            {t("begin")}
          </button>
          <MainMenuGroups
            t={t}
            equippedAvatar={equippedAvatar}
            isPremium={isPremium}
            onAvatars={() => setShowAvatars(true)}
            onLeaderboard={async () => {
              setShowLeaderboard(true);
              setTopTen(null); // clear stale state before refetch
              const tops = await fetchTop10();
              setTopTen(tops); // full replacement, never merged
            }}
            onPremium={() => setShowPremium(true)}
            onMoreGames={() => setShowMoreGames(true)}
          />
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay>
          <p className="text-xs uppercase tracking-[0.4em] text-rose-200/80">{t("windTookYou")}</p>
          <h1 className="mt-3 text-4xl font-light tracking-[0.2em] text-amber-50">{t("fallen")}</h1>
          <p className="mt-1 text-xs text-amber-100/60">
            {t("level")} {level}
          </p>
          {isWorldRecord && (
            <div className="mt-3 rounded-full bg-amber-300/30 px-4 py-1 text-[11px] tracking-[0.35em] text-amber-50 ring-1 ring-amber-200/70 shadow-[0_0_30px_rgba(255,210,140,0.7)] animate-pulse">
              {t("newWorldRecord")}
            </div>
          )}
          {!isWorldRecord && enteredTop10 && (
            <div className="mt-3 rounded-full bg-amber-200/20 px-4 py-1 text-[11px] tracking-[0.3em] text-amber-50 ring-1 ring-amber-200/60 animate-pulse">
              {t("newTop10")}
            </div>
          )}
          {!isWorldRecord && !enteredTop10 && isNewBest && (
            <div className="mt-3 rounded-full bg-amber-100/15 px-4 py-1 text-[11px] tracking-[0.3em] text-amber-100 ring-1 ring-amber-200/40">
              {t("newPersonalBest")}
            </div>
          )}
          <div className="mt-5 grid grid-cols-3 gap-6 text-center">
            <Stat label={t("score")} value={score} />
            <Stat label={t("best")} value={bestScore} />
            <Stat label={t("worldRank")} value={worldRank ?? 0} prefix="#" />
          </div>
          <LeaderboardList entries={topTen} t={t} selfAvatar={equippedAvatar} />
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={startGame}
              className="rounded-full bg-amber-100 px-8 py-3 text-sm font-medium tracking-[0.2em] text-stone-900 shadow-[0_0_40px_rgba(255,200,140,0.5)] transition-transform hover:scale-105 active:scale-95"
            >
              {t("tryAgain")}
            </button>
            <button
              onClick={() => { setState("start"); stateRef.current = "start"; }}
              className="rounded-full border border-amber-200/40 bg-black/30 px-6 py-3 text-xs font-medium tracking-[0.2em] text-amber-100/90 backdrop-blur transition hover:border-amber-200/70 hover:text-amber-50"
            >
              {t("mainMenu")}
            </button>
          </div>
          <button
            onClick={() => setShowMoreGames(true)}
            className="mt-4 rounded-full border border-amber-200/30 bg-black/30 px-5 py-2 text-[10px] tracking-[0.25em] text-amber-100/80 backdrop-blur hover:border-amber-200/60 hover:text-amber-50"
          >
            {t("moreGames")}
          </button>
        </Overlay>
      )}

      {showLangPrompt && (
        <LanguagePromptOverlay
          current={language}
          onSelect={(l) => {
            setLanguage(l);
            try { localStorage.setItem("btr_lang_set", "1"); } catch { /* ignore */ }
            setShowLangPrompt(false);
          }}
        />
      )}

      {!showLangPrompt && showNamePrompt && (
        <NamePromptOverlay
          initial={playerName ?? ""}
          onSave={handleSaveName}
          onCancel={playerName ? () => setShowNamePrompt(false) : undefined}
          t={t}
        />
      )}

      {showSettings && (
        <SettingsOverlay
          name={playerName ?? ""}
          language={language}
          onChangeLanguage={setLanguage}
          onChangeName={() => { setShowSettings(false); setShowNamePrompt(true); }}
          onClose={() => setShowSettings(false)}
          devMode={devMode}
          onToggleDevMode={toggleDevMode}
          onResetAll={() => {
            const ok = typeof window !== "undefined"
              ? window.confirm("Reset ALL data? This will clear name, premium, progress, avatars, and settings.")
              : true;
            if (!ok) return;
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch { /* ignore */ }
            try { window.location.reload(); } catch { /* ignore */ }
          }}
          isPremium={isPremium}
          onPremium={() => { setShowSettings(false); setShowPremium(true); }}
          musicOn={musicOn}
          onToggleMusic={toggleMusic}
          t={t}
        />
      )}

      {showLevelSelect && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in px-4">
          <h2 className="text-xl font-light tracking-[0.25em] text-amber-50">Select Starting Level</h2>
          <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70">DEV MODE · testing only</p>
          <div className="mt-6 grid grid-cols-5 gap-2 max-w-[420px]">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
              <button
                key={lvl}
                onClick={() => startGameAtLevel(lvl)}
                className="rounded-xl border border-amber-200/30 bg-black/45 px-3 py-3 text-sm tracking-widest text-amber-50 backdrop-blur transition hover:border-amber-200/70 hover:bg-black/60"
              >
                {lvl}
              </button>
            ))}
            <button
              onClick={() => startGameAtLevel(11)}
              className="col-span-5 mt-1 rounded-xl border border-amber-200/40 bg-amber-200/10 px-3 py-2 text-xs tracking-[0.3em] text-amber-50 backdrop-blur transition hover:bg-amber-200/20"
            >
              Level 11+ (Endless)
            </button>
          </div>
          <button
            onClick={() => setShowLevelSelect(false)}
            className="mt-6 rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
          >
            {t("close")}
          </button>
        </div>
      )}

      {showLeaderboard && (
        <Overlay>
          <h2 className="text-2xl font-light tracking-[0.25em] text-amber-50">{t("leaderboard")}</h2>
          <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70">{t("top10Worldwide")}</p>
          <LeaderboardList entries={topTen} t={t} selfAvatar={equippedAvatar} />
          <button
            onClick={() => setShowLeaderboard(false)}
            className="mt-6 rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
          >
            {t("close")}
          </button>
        </Overlay>
      )}

      {showMoreGames && (
        <MoreGamesOverlay onClose={() => setShowMoreGames(false)} t={t} />
      )}

      {showAvatars && (
        <AvatarsOverlay
          isPremium={isPremium}
          equipped={equippedAvatar}
          onEquip={(id) => setEquippedAvatar(id)}
          onClose={() => setShowAvatars(false)}
          title={t("avatars")}
          t={t}
        />
      )}

      {state === "offer" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in px-4">
          <div className="mx-4 max-w-sm rounded-2xl border border-amber-200/30 bg-black/80 p-6 text-center text-amber-50 shadow-[0_0_40px_rgba(255,200,140,0.3)]">
            <div className="flex justify-center gap-2 text-2xl">
              <span>❤️</span><span>❤️</span><span className="opacity-60">🔒</span>
            </div>
            <h3 className="mt-4 text-lg font-light tracking-[0.25em] text-amber-50">
              {t("continueRunTitle")}
            </h3>
            <p className="mt-2 text-xs tracking-wide text-amber-100/70" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 15 }}>
              {t("continueRunBody")}
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                disabled={adLoading}
                onClick={async () => {
                  setAdLoading(true);
                  const ok = await simulateRewardedAd();
                  setAdLoading(false);
                  if (!ok) return;
                  // Unlock the third life, restore exactly one life, resume.
                  maxLivesRef.current = 3; setMaxLives(3);
                  healthRef.current = 1; setHealth(1);
                  extraLifeUsedRef.current = true; setExtraLifeUsed(true);
                  stateRef.current = "playing"; setState("playing");
                }}
                className={
                  "rounded-full px-7 py-2.5 text-xs font-medium tracking-[0.25em] transition-transform " +
                  (adLoading
                    ? "cursor-wait bg-amber-100/40 text-stone-900/60"
                    : "bg-amber-100 text-stone-900 shadow-[0_0_30px_rgba(255,200,140,0.5)] hover:scale-105 active:scale-95")
                }
              >
                {adLoading ? t("loadingAd") : `▶ ${t("watchAdContinue")}`}
              </button>
              <button
                type="button"
                disabled={adLoading}
                onClick={() => {
                  if (!devModeRef.current && scoreRef.current > bestRef.current) {
                    bestRef.current = scoreRef.current;
                    setBestScore(scoreRef.current);
                    try { localStorage.setItem("dunewalker_best", String(scoreRef.current)); } catch { /* ignore */ }
                  }
                  stateRef.current = "gameover"; setState("gameover");
                }}
                className="rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-[11px] tracking-[0.3em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
              >
                {t("gameOverBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPremium && (
        <PremiumOverlay
          isPremium={isPremium}
          onPurchase={() => {
            setIsPremium(true);
            setIsPremiumState(true);
            isPremiumRef.current = true;
            const m = 3;
            setMaxLives(m); maxLivesRef.current = m;
            setHealth((h) => Math.min(m, Math.max(h, m))); healthRef.current = m;
          }}
          onClose={() => setShowPremium(false)}
          t={t}
        />
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

function LockedHeart() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        d="M12 21s-7-4.5-9.5-9.2C.9 8.5 2.6 5 6 5c2 0 3.4 1 4 2.2C10.6 6 12 5 14 5c3.4 0 5.1 3.5 3.5 6.8C19 16.5 12 21 12 21z"
        fill="rgba(255,220,170,0.06)"
        stroke="rgba(255,220,170,0.35)"
        strokeWidth={1.2}
      />
      <g transform="translate(12 13)">
        <rect x="-3.2" y="-0.5" width="6.4" height="5" rx="1" fill="rgba(20,12,8,0.85)" stroke="rgba(255,220,170,0.8)" strokeWidth={0.8}/>
        <path d="M-2 -0.6 V -2.2 a2 2 0 0 1 4 0 V -0.6" fill="none" stroke="rgba(255,220,170,0.85)" strokeWidth={1}/>
      </g>
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
  t,
  selfAvatar,
}: {
  entries: LeaderboardEntry[] | null;
  t: (key: UIKey) => string;
  selfAvatar?: AvatarId;
}) {
  const myId = typeof window !== "undefined" ? getPlayerId() : "";
  if (entries === null) {
    return (
      <div className="mt-5 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/20 bg-black/40 px-4 py-3 text-center text-[11px] tracking-[0.25em] text-amber-100/60 backdrop-blur">
        {t("loading")}
      </div>
    );
  }
  // Final dedupe by player_id (defensive — fetchTop10 already dedupes).
  const byId = new Map<string, LeaderboardEntry>();
  for (const e of entries) {
    const prev = byId.get(e.player_id);
    if (!prev || e.best_score > prev.best_score) byId.set(e.player_id, e);
  }
  const combined = Array.from(byId.values())
    .sort((a, b) => b.best_score - a.best_score)
    .slice(0, 10);
  console.debug("[leaderboard] final render state", combined);
  return (
    <div className="mt-5 w-[300px] max-w-[92vw] rounded-2xl border border-amber-200/25 bg-black/45 p-2 backdrop-blur-md">
      <ol className="flex flex-col">
        {combined.map((e, idx) => {
          const mine = e.player_id === myId;
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
              <span className="flex flex-1 items-center gap-1.5 truncate px-2">
                {mine && selfAvatar && <AvatarIcon id={selfAvatar} size={16} />}
                <span className="truncate">{e.name}</span>
              </span>
              <span className="tabular-nums text-amber-50">{e.best_score}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[9px] font-medium uppercase tracking-[0.45em] text-amber-200/55">
        {label}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
  );
}

function MenuButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-1.5 text-[10px] tracking-[0.25em] backdrop-blur transition " +
        (active
          ? "border-amber-200/70 bg-amber-200/20 text-amber-50 shadow-[0_0_18px_rgba(255,200,140,0.4)]"
          : "border-amber-200/30 bg-black/30 text-amber-100/80 hover:border-amber-200/60 hover:text-amber-50")
      }
    >
      {children}
    </button>
  );
}

function MainMenuGroups({
  t,
  equippedAvatar,
  isPremium,
  onAvatars,
  onLeaderboard,
  onPremium,
  onMoreGames,
}: {
  t: (key: UIKey) => string;
  equippedAvatar: AvatarId;
  isPremium: boolean;
  onAvatars: () => void;
  onLeaderboard: () => void;
  onPremium: () => void;
  onMoreGames: () => void;
}) {
  return (
    <div className="mt-10 flex w-[min(94vw,420px)] flex-col items-center gap-5">
      <button
        type="button"
        onClick={onAvatars}
        aria-label={t("avatars")}
        className="flex items-center gap-2 rounded-full border border-amber-200/40 bg-black/30 px-4 py-1.5 text-[10px] tracking-[0.25em] text-amber-100/85 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
      >
        <AvatarIcon id={equippedAvatar} size={22} />
        <span>{t("avatars")}</span>
      </button>
      <MenuButton onClick={onLeaderboard}>{t("leaderboard")}</MenuButton>
      <div className="flex items-center justify-center gap-3">
        <MenuButton onClick={onPremium} active={isPremium}>★ {t("premium")}</MenuButton>
        <MenuButton onClick={onMoreGames}>{t("moreGames")}</MenuButton>
      </div>
    </div>
  );
}

function NamePromptOverlay({
  initial,
  onSave,
  onCancel,
  t,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel?: () => void;
  t: (key: UIKey) => string;
}) {
  const [val, setVal] = useState(initial);
  const trimmed = val.trim();
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in px-4">
      <h2 className="text-xl font-light tracking-[0.25em] text-amber-50 text-center">
        {t("choosePlayerName")}
      </h2>
      <p className="mt-2 text-[10px] tracking-[0.3em] text-amber-200/70">
        {NAME_MIN}–{NAME_MAX} {t("charactersRange")}
      </p>
      <input
        autoFocus
        value={val}
        maxLength={NAME_MAX}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && valid) onSave(val); }}
        className="mt-5 w-[260px] max-w-[80vw] rounded-full border border-amber-200/40 bg-black/40 px-4 py-2.5 text-center text-lg tracking-[0.15em] text-amber-50 outline-none backdrop-blur placeholder:text-amber-100/30 focus:border-amber-200/80"
        placeholder={t("yourName")}
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
          {t("confirm")}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-full border border-amber-200/40 bg-black/30 px-5 py-2.5 text-xs tracking-[0.25em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

function LanguagePromptOverlay({
  current,
  onSelect,
}: {
  current: Language;
  onSelect: (l: Language) => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in px-4">
      <h2 className="text-xl font-light tracking-[0.25em] text-amber-50 text-center">
        SELECT LANGUAGE
      </h2>
      <p className="mt-2 text-[10px] tracking-[0.3em] text-amber-200/70 text-center">
        ELIGE TU IDIOMA · CHOISISSEZ VOTRE LANGUE
      </p>
      <div className="mt-6 flex max-w-[92vw] flex-wrap items-center justify-center gap-2">
        {LANGUAGES.map((lng) => (
          <button
            key={lng}
            onClick={() => onSelect(lng)}
            className={
              "rounded-full border px-4 py-2 text-xs tracking-wider transition " +
              (current === lng
                ? "border-amber-200/80 bg-amber-100/20 text-amber-50 shadow-[0_0_18px_rgba(255,200,140,0.4)]"
                : "border-amber-200/30 bg-black/40 text-amber-100/80 hover:border-amber-200/70 hover:text-amber-50")
            }
          >
            {LANGUAGE_LABELS[lng]}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsOverlay({
  name,
  language,
  onChangeLanguage,
  onChangeName,
  onClose,
  devMode,
  onToggleDevMode,
  onResetAll,
  isPremium,
  onPremium,
  musicOn,
  onToggleMusic,
  t,
}: {
  name: string;
  language: Language;
  onChangeLanguage: (l: Language) => void;
  onChangeName: () => void;
  onClose: () => void;
  devMode: boolean;
  onToggleDevMode: () => void;
  onResetAll: () => void;
  isPremium: boolean;
  onPremium: () => void;
  musicOn: boolean;
  onToggleMusic: () => void;
  t: (key: UIKey) => string;
}) {
  const [showLangs, setShowLangs] = useState(false);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
      <h2 className="text-xl font-light tracking-[0.25em] text-amber-50">{t("settings")}</h2>
      <div className="mt-5 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/25 bg-black/45 p-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-amber-200/70">{t("playerName")}</div>
            <div className="mt-1 text-base text-amber-50">{name || "—"}</div>
          </div>
          <button
            onClick={isPremium ? onChangeName : onPremium}
            className={
              "rounded-full border px-3 py-1.5 text-[10px] tracking-[0.25em] " +
              (isPremium
                ? "border-amber-200/40 bg-black/30 text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
                : "border-amber-200/30 bg-black/20 text-amber-200/70 hover:border-amber-200/60 hover:text-amber-100")
            }
            title={isPremium ? undefined : t("premiumOnly")}
          >
            {isPremium ? t("change") : `★ ${t("premiumOnly")}`}
          </button>
        </div>
      </div>
      <div className="mt-3 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/25 bg-black/45 p-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-amber-200/70">{t("language")}</div>
            <div className="mt-1 text-base text-amber-50">{LANGUAGE_LABELS[language]}</div>
          </div>
          <button
            onClick={() => setShowLangs((v) => !v)}
            className="rounded-full border border-amber-200/40 bg-black/30 px-3 py-1.5 text-[10px] tracking-[0.25em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
          >
            {showLangs ? t("close") : t("change")}
          </button>
        </div>
        {showLangs && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {LANGUAGES.map((lng) => (
              <button
                key={lng}
                onClick={() => { onChangeLanguage(lng); setShowLangs(false); }}
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
        )}
      </div>
      <div className="mt-3 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/25 bg-black/45 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onToggleMusic}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] text-amber-200/70">{t("music")}</div>
            <div className="mt-1 text-base text-amber-50">{musicOn ? "ON" : "OFF"}</div>
          </div>
          <span
            className={
              "relative inline-flex h-5 w-9 items-center rounded-full transition " +
              (musicOn ? "bg-amber-300/70" : "bg-white/15")
            }
            aria-hidden
          >
            <span
              className={
                "inline-block h-4 w-4 transform rounded-full bg-black/80 transition " +
                (musicOn ? "translate-x-4" : "translate-x-0.5")
              }
            />
          </span>
        </button>
      </div>
      <button
        onClick={onClose}
        className="mt-6 rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
      >
        {t("close")}
      </button>
      <div className="mt-4 w-[280px] max-w-[88vw] rounded-2xl border border-amber-200/15 bg-black/35 p-3 backdrop-blur">
        <button
          type="button"
          onClick={onToggleDevMode}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] text-amber-200/60">DEV</div>
            <div className="mt-0.5 text-xs text-amber-100/80">Game Dev Mode</div>
            <div className="mt-0.5 text-[9px] tracking-wide text-amber-100/40">Testing only · no leaderboard</div>
          </div>
          <span
            className={
              "relative inline-flex h-5 w-9 items-center rounded-full transition " +
              (devMode ? "bg-amber-300/70" : "bg-white/15")
            }
            aria-hidden
          >
            <span
              className={
                "inline-block h-4 w-4 transform rounded-full bg-black/80 transition " +
                (devMode ? "translate-x-4" : "translate-x-0.5")
              }
            />
          </span>
        </button>
        {devMode && (
          <button
            type="button"
            onClick={onResetAll}
            className="mt-3 w-full rounded-full border border-red-400/50 bg-red-500/10 px-4 py-2 text-[10px] tracking-[0.3em] text-red-200 hover:border-red-300 hover:bg-red-500/20 hover:text-red-100"
          >
            RESET ALL DATA
          </button>
        )}
      </div>
    </div>
  );
}

type MoreGame = {
  title: string;
  image?: string; // square image url; placeholder gradient if omitted
  android: string;
  ios: string;
  pc: string;
  comingSoon?: boolean;
};

const MORE_GAMES: MoreGame[] = [
  {
    title: "Didactic Jesus Game",
    image: didacticJesusImg.url,
    android: "https://play.google.com/store/apps/details?id=com.biblegamesproject.pro&hl=es_419",
    ios: "https://apps.apple.com/es/app/didactic-jesus-game-bible/id6740145520",
    pc: "https://store.steampowered.com/app/2138140/Didactic_Jesus_Game/",
  },
  {
    title: "The Lost Sheep",
    image: lostSheepImg.url,
    android: "https://www.biblegamesproject.com/the-lost-sheep",
    ios: "https://apps.apple.com/es/app/the-lost-sheep-bible-game/id6740145333",
    pc: "https://store.steampowered.com/app/2298350/The_Lost_Sheep/",
  },
  {
    title: "Bible Unlocked",
    image: bibleUnlockedImg.url,
    android: "https://play.google.com/store/apps/details?id=com.biblegames.eden&pcampaignid=web_share",
    ios: "https://apps.apple.com/es/app/bible-unlocked-100-historias/id6775889176?l=ca",
    pc: "https://www.biblegamesproject.com/bible-unlocked",
  },
  {
    title: "True Christ",
    image: trueChristImg.url,
    android: "https://www.biblegamesproject.com/true-christ",
    ios: "https://www.biblegamesproject.com/true-christ",
    pc: "https://store.steampowered.com/app/4244150/True_Christ/",
    comingSoon: true,
  },
];

function detectPlatformUrl(g: MoreGame): string {
  if (typeof navigator === "undefined") return g.pc;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  if (isIOS) return g.ios;
  if (/Android/i.test(ua)) return g.android;
  return g.pc;
}

function MoreGamesOverlay({ onClose, t }: { onClose: () => void; t: (key: UIKey) => string }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in px-4">
      <h2 className="text-2xl font-light tracking-[0.25em] text-amber-50">{t("moreGames")}</h2>
      <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70">{t("bibleGamesProject")}</p>

      <div className="mt-6 grid w-[min(92vw,520px)] grid-cols-2 gap-3 sm:gap-4">
        {MORE_GAMES.map((g) => {
          const handleClick = () => {
            const url = detectPlatformUrl(g);
            window.open(url, "_blank", "noopener,noreferrer");
          };
          return (
            <button
              key={g.title}
              onClick={handleClick}
              className="group relative flex flex-col items-stretch overflow-hidden rounded-2xl border border-amber-200/25 bg-black/45 p-2 text-left backdrop-blur transition hover:border-amber-200/60 hover:shadow-[0_0_24px_rgba(255,200,140,0.25)] active:scale-[0.98]"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-amber-900/40 via-stone-900 to-amber-700/30 ring-1 ring-amber-200/20">
                {g.image ? (
                  <img src={g.image} alt={g.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-light tracking-[0.2em] text-amber-100/80" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                    {g.title}
                  </div>
                )}
                {g.comingSoon && (
                  <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-amber-300/90 px-2 py-0.5 text-[9px] font-medium tracking-[0.25em] text-stone-900 shadow">
                    {t("comingSoon")}
                  </div>
                )}
              </div>
              <div className="mt-2 px-1 pb-1 text-center text-[11px] tracking-[0.18em] text-amber-50">
                {g.title.toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="mt-6 rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
      >
        {t("close")}
      </button>
    </div>
  );
}

function PremiumOverlay({
  isPremium,
  onPurchase,
  onClose,
  t,
}: {
  isPremium: boolean;
  onPurchase: () => void;
  onClose: () => void;
  t: (key: UIKey) => string;
}) {
  const Bullet = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-start gap-2 text-sm tracking-wide text-amber-50/90" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 17 }}>
      <span className="mt-0.5 text-amber-200">✦</span>
      <span>{children}</span>
    </li>
  );
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in px-4">
      <div className="mx-4 w-[min(92vw,420px)] rounded-2xl border border-amber-200/40 bg-black/80 p-6 text-center text-amber-50 shadow-[0_0_50px_rgba(255,200,140,0.35)]">
        <div className="text-[10px] tracking-[0.35em] text-amber-200/80">★ {t("premium")} ★</div>
        <h2 className="mt-2 text-2xl font-light tracking-[0.25em] text-amber-50">BIBLE TRIVIA RUN</h2>
        <p className="mt-1 text-[10px] tracking-[0.3em] text-amber-200/70">{t("premiumBenefits")}</p>

        <ul className="mt-5 flex flex-col gap-2 text-left">
          <Bullet>{t("noAds")}</Bullet>
          <Bullet>{t("threeLivesBenefit")}</Bullet>
          <Bullet>{t("unlimitedNameChanges")}</Bullet>
          <Bullet>{t("exclusiveAvatars")}</Bullet>
        </ul>

        <div className="mt-6 flex flex-col items-center gap-3">
          {isPremium ? (
            <div className="rounded-full bg-amber-200/25 px-5 py-2 text-[11px] tracking-[0.3em] text-amber-50 ring-1 ring-amber-200/60">
              ★ {t("premiumActive")} ★
            </div>
          ) : (
            <button
              type="button"
              onClick={onPurchase}
              className="rounded-full bg-amber-100 px-7 py-2.5 text-xs font-semibold tracking-[0.25em] text-stone-900 shadow-[0_0_24px_rgba(255,200,140,0.5)] hover:bg-amber-50"
            >
              ★ {t("goPremium")} ★
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full border border-amber-200/40 bg-black/30 px-6 py-2 text-xs tracking-[0.25em] text-amber-100/90 backdrop-blur hover:border-amber-200/70 hover:text-amber-50"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
