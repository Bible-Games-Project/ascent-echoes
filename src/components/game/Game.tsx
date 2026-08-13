import { useEffect, useRef, useState } from "react";
import didacticJesusImg from "@/assets/didactic-jesus.png.asset.json";
import boatImg from "@/assets/ark.png.asset.json";
import arkLevel1Img from "@/assets/ark-level-1.png.asset.json";
import arkLevel2Img from "@/assets/ark-level-2.png.asset.json";
import arkLevel3Img from "@/assets/ark-level-3.png.asset.json";
import arkLevel4Img from "@/assets/ark-level-4.png.asset.json";
import arkLevel5Img from "@/assets/ark-level-5.png.asset.json";
import arkLevel6Img from "@/assets/ark-level-6.png.asset.json";
import arkLevel7Img from "@/assets/ark-level-7.png.asset.json";
import arkLevel8Img from "@/assets/ark-level-8.png.asset.json";
import arkLevel9Img from "@/assets/ark-level-9.png.asset.json";
import arkLevel10Img from "@/assets/ark-level-10.png.asset.json";
import lostSheepImg from "@/assets/lost-sheep.png.asset.json";
import bonusHeartImg from "@/assets/bonus/Bonus_Corazon.png.asset.json";
import bonusShineHeartImg from "@/assets/bonus/Bonus_CorazonBrillante.png.asset.json";
import bonusShieldImg from "@/assets/bonus/Bonus_Escudo.png.asset.json";
import bonusStarImg from "@/assets/bonus/Bonus_Estrella.png.asset.json";
import bonusLightImg from "@/assets/bonus/Bonus_Luz.png.asset.json";
import bonusAppleImg from "@/assets/bonus/Bonus_ManzanaPodrida.png.asset.json";
import bonusClockImg from "@/assets/bonus/Bonus_Reloj.png.asset.json";
import bonusWebImg from "@/assets/bonus/Bonus_Telarana.png.asset.json";
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
import { music } from "@/lib/music";
import { sfx } from "@/lib/sfx";
import { DEV_MODE_AVAILABLE } from "@/lib/devMode";
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
import { assetUrl } from "@/lib/assetUrl";
import {
  fetchTop10,
  getLocalBest,
  getPlayerId,
  getPlayerName,
  NAME_MAX,
  NAME_MIN,
  setPlayerName as savePlayerName,
  submitScore,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

// ----- Ark sprite -----
// The artwork's ornate prow faces left, which is the travel direction.
// Normalized bounds of the cream text plaque inside the artwork.
const BOAT_PLAQUE = { x0: 0.16, x1: 0.92, y0: 0.44, y1: 0.79 };
let boatSprite: HTMLImageElement | null = null;
let boatSpriteReady = false;
function getBoatSprite(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!boatSprite) {
    const img = new Image();
    img.onload = () => { boatSpriteReady = true; };
    img.src = assetUrl(boatImg.url);
    boatSprite = img;
  }
  return boatSpriteReady ? boatSprite : null;
}

// ----- Per-level ark colour variants -----
// The artwork is first reduced to a proper grayscale master (perceptual
// luminance, so shadows / midtones / highlights keep their value structure)
// and then re-coloured through value ramps. Each level gets a dominant,
// mostly-monochromatic family plus a small complementary accent applied to the
// roof, trim and windows (the warm-red regions of the original artwork).
type Ramp = [string, string, string, string];
type ArkPalette = { dom: Ramp; accent: Ramp };
const ARK_PALETTES: ArkPalette[] = [
  // 1 Desert sunset — dusty plum monochrome, warm gold accents
  { dom: ["#3b2540", "#6d4a68", "#a98ba6", "#e6d6e4"], accent: ["#8a5a1e", "#c68a35", "#e8b866", "#f7e0ad"] },
  // 2 Summer forest — soft sage/green, coral accents
  { dom: ["#22412f", "#4c7a58", "#8fb894", "#dceadb"], accent: ["#8f3f38", "#c47164", "#e39d8c", "#f6d6c9"] },
  // 3 Summer sea — pastel blue, warm sand accents
  { dom: ["#1e3a52", "#3f6d92", "#8ab3cf", "#dceaf3"], accent: ["#8a6423", "#c39348", "#e5bd7c", "#f7e3bd"] },
  // 4 Autumn forest — deep teal, amber accents
  { dom: ["#123536", "#2f6163", "#78a5a3", "#d6e8e4"], accent: ["#8c4a17", "#c47b2c", "#e6a95c", "#f7dcac"] },
  // 5 Autumn meadow — warm clay/terracotta, sage accents
  { dom: ["#402318", "#7a4632", "#b5836a", "#eddbcd"], accent: ["#3f5a3a", "#6d8c60", "#a3bd93", "#dcead0"] },
  // 6 Winter forest — icy pale blue, soft rose accents
  { dom: ["#28394f", "#546e8c", "#9db4c9", "#e6eff6"], accent: ["#8a4550", "#bd7480", "#dda2a6", "#f5dade"] },
  // 7 Winter mountain — lavender slate, pale gold accents
  { dom: ["#2b2d43", "#565a7d", "#9b9fbc", "#e6e7f1"], accent: ["#836a2c", "#b89a52", "#dcc084", "#f4e6c2"] },
  // 8 Spring forest — fresh mint, soft rose accents
  { dom: ["#22422f", "#4f8560", "#96c3a1", "#e0f0e2"], accent: ["#8e4353", "#c07484", "#e0a2ab", "#f6dbdf"] },
  // 9 Spring meadow — lavender/violet, soft gold accents
  { dom: ["#33244a", "#61497f", "#a08cbb", "#e8dff2"], accent: ["#87682a", "#bb954c", "#dfbd7d", "#f6e5bd"] },
  // 10 Night sky — indigo, warm lamplight gold accents
  { dom: ["#1c2547", "#3d4b7d", "#7f8cb6", "#dbe2f2"], accent: ["#8a6520", "#c49543", "#e8c176", "#f8e6b6"] },
];

const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
// Sample a 4-stop ramp at value v (0 = deepest shadow, 1 = brightest highlight).
const rampAt = (stops: [number, number, number][], v: number): [number, number, number] => {
  const t = Math.min(1, Math.max(0, v)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

const arkVariants = new Map<number, HTMLCanvasElement>();

// Levels 1-10 use dedicated hand-made artwork instead of the recoloured
// grayscale master. Everything else (size, motion, plaque mapping) is unchanged.
const arkOverrideUrls: Record<number, string> = {
  1: arkLevel1Img.url,
  2: arkLevel2Img.url,
  3: arkLevel3Img.url,
  4: arkLevel4Img.url,
  5: arkLevel5Img.url,
  6: arkLevel6Img.url,
  7: arkLevel7Img.url,
  8: arkLevel8Img.url,
  9: arkLevel9Img.url,
  10: arkLevel10Img.url,
};
const arkOverrides = new Map<number, { img: HTMLImageElement; ready: boolean }>();
function getArkOverride(level: number): CanvasImageSource | null {
  const url = arkOverrideUrls[level];
  if (!url) return null;
  let entry = arkOverrides.get(level);
  if (!entry) {
    const img = new Image();
    const e = { img, ready: false };
    img.onload = () => { e.ready = true; };
    img.src = assetUrl(url);
    arkOverrides.set(level, e);
    entry = e;
  }
  return entry.ready ? entry.img : null;
}

function getArkSprite(level: number): CanvasImageSource | null {
  const override = getArkOverride(level);
  if (override) return override;
  const base = getBoatSprite();
  if (!base) return null;
  const idx = Math.min(Math.max(1, level), 10) - 1;
  const cached = arkVariants.get(idx);
  if (cached) return cached;
  const w = base.naturalWidth || base.width;
  const h = base.naturalHeight || base.height;
  if (!w || !h) return base;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d", { willReadFrequently: true });
  if (!c) return base;
  c.drawImage(base, 0, 0, w, h);
  let img: ImageData;
  try {
    img = c.getImageData(0, 0, w, h);
  } catch {
    // Cross-origin canvas — keep the untouched artwork rather than failing.
    return base;
  }
  const pal = ARK_PALETTES[idx];
  const domStops = pal.dom.map(hexRgb);
  const accStops = pal.accent.map(hexRgb);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Grayscale master: perceptual luminance with a gentle S-curve so the
    // shadows stay deep and the highlights stay luminous.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const v = Math.min(1, Math.max(0, lum * 1.06 - 0.03));
    const val = v * v * (3 - 2 * v) * 0.35 + v * 0.65;
    // Accent mask: warm-red family of the original (roof, trim, windows).
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    let hue = 0;
    if (mx !== mn) {
      const dl = mx - mn;
      if (mx === r) hue = ((g - b) / dl) % 6;
      else if (mx === g) hue = (b - r) / dl + 2;
      else hue = (r - g) / dl + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const isAccent = sat > 0.35 && (hue < 16 || hue > 348);
    const out = rampAt(isAccent ? accStops : domStops, val);
    // Near-neutral areas (the cream plaque) keep a very light, desaturated
    // version of the family so the answer text stays highly readable.
    if (!isAccent && sat < 0.16) {
      const pale = 235 * val + 20;
      d[i] = out[0] * 0.25 + pale * 0.75;
      d[i + 1] = out[1] * 0.25 + pale * 0.75;
      d[i + 2] = out[2] * 0.25 + pale * 0.75;
    } else {
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
    }
  }
  c.putImageData(img, 0, 0);
  arkVariants.set(idx, cv);
  return cv;
}

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
  x: number; // world X position of the answer boats (right -> left)
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

type PowerupType = "star" | "heart" | "shineheart" | "slow" | "hint" | "apple" | "broken" | "shield" | "web";

/** Hand-made artwork for each bonus (vector fallback stays for anything unmapped). */
const BONUS_SPRITE_URLS: Partial<Record<PowerupType, string>> = {
  heart: bonusHeartImg.url,
  shineheart: bonusShineHeartImg.url,
  shield: bonusShieldImg.url,
  star: bonusStarImg.url,
  hint: bonusLightImg.url,
  apple: bonusAppleImg.url,
  slow: bonusClockImg.url,
  web: bonusWebImg.url,
};
const bonusSprites = new Map<PowerupType, { img: HTMLImageElement; ready: boolean }>();
function getBonusSprite(type: PowerupType): HTMLImageElement | null {
  const url = BONUS_SPRITE_URLS[type];
  if (!url || typeof window === "undefined") return null;
  let entry = bonusSprites.get(type);
  if (!entry) {
    const img = new Image();
    const e = { img, ready: false };
    img.onload = () => { e.ready = true; };
    img.src = assetUrl(url);
    bonusSprites.set(type, e);
    entry = e;
  }
  return entry.ready ? entry.img : null;
}
/** Bonuses whose glow should read as ominous rather than magical. */
const NEGATIVE_BONUSES: PowerupType[] = ["apple", "broken", "web"];

/** Maximum lives reachable via the Shining Heart bonus. */
const MAX_LIVES = 7;

interface Powerup {
  x: number;
  y: number;
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
  const [maxLives, setMaxLives] = useState(3);
  const [lifeFlash, setLifeFlash] = useState(0);
  const [shieldActive, setShieldActive] = useState(false);
  const [shieldBreak, setShieldBreak] = useState(0);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // Track the real viewport so the stage can be rotated to landscape.
  useEffect(() => {
    const read = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
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
  const [equippedAvatar, setEquippedAvatar] = useState<AvatarId>("pigeon");
  const [showAvatars, setShowAvatars] = useState(false);
  const runDiffMaskRef = useRef(0);
  const equippedAvatarRef = useRef<AvatarId>("pigeon");
  useEffect(() => { equippedAvatarRef.current = equippedAvatar; }, [equippedAvatar]);

  // Dev mode (testing only — never affects the leaderboard)
  const [devMode, setDevMode] = useState<boolean>(() => {
    if (!DEV_MODE_AVAILABLE) return false;
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
  const maxLivesRef = useRef(3);
  const progressRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestRef = useRef(0);
  const levelRef = useRef(1);
  const runTimeRef = useRef(0);
  const languageRef = useRef<Language>(language);
  const usedIdsRef = useRef<Set<string>>(new Set());
  const correctTotalRef = useRef(0);
  const shieldRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => {
    if (!lifeFlash) return;
    const id = window.setTimeout(() => setLifeFlash(0), 1200);
    return () => window.clearTimeout(id);
  }, [lifeFlash]);
  useEffect(() => { devModeRef.current = devMode; }, [devMode]);
  useEffect(() => {
    if (!shieldBreak) return;
    const id = window.setTimeout(() => setShieldBreak(0), 900);
    return () => window.clearTimeout(id);
  }, [shieldBreak]);

  // Every player always starts with 3 lives.
  useEffect(() => {
    setHealth(3); healthRef.current = 3;
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
      // Submit first (server keeps GREATEST), then fetch fresh top 10.
      if (finalScore > 0) {
        await submitScore(finalScore, levelRef.current);
      }
      if (finalScore > prevBest) {
        bestRef.current = finalScore;
        setBestScore(finalScore);
        setIsNewBest(true);
      }
      const top = await fetchTop10();
      if (cancelled) return;
      setTopTen(top);
      // Derive rank from board position when the player is in the top 10.
      const myId = getPlayerId();
      const idx = top.findIndex((e) => e.player_id === myId);
      if (idx >= 0) {
        const rank = idx + 1;
        setWorldRank(rank);
        setEnteredTop10(true);
        setIsWorldRecord(rank === 1);
        recordRank(rank);
      }
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
      // Use layout size (not getBoundingClientRect) because the stage may be
      // rotated 90deg to force landscape on portrait devices.
      W = canvas.offsetWidth || canvas.getBoundingClientRect().width;
      H = canvas.offsetHeight || canvas.getBoundingClientRect().height;
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

    // ---- Landscape geometry ----
    // Three horizontal lanes; the player flies on the LEFT, answer boats
    // sail in from the RIGHT edge towards the player.
    const LANE_FRACS = [0.46, 0.67, 0.88];
    const GROUND_FRAC = 0.88;
    const SPAWN_X_FRAC = 1.18;
    const RESOLVE_X_FRAC = 0.16;
    const laneY = (lane: Lane) => H * LANE_FRACS[lane];
    const laneGap = () => H * (LANE_FRACS[1] - LANE_FRACS[0]);
    // Player visual half-width (dove silhouette, wings included) + safety
    // margin so the sprite never touches or leaves the screen edges.
    const playerHalfW = () => Math.max(28, Math.min(62, H * 0.1));
    // Dove (pigeon) artwork half width in gameplay pixels, trimmed to the
    // sprite's opaque body so the trigger fires on visual contact.
    const DOVE_COLLIDE_HALF_W = 34;
    const EDGE_MARGIN = () => Math.max(18, W * 0.032);
    const playerMinX = () => EDGE_MARGIN() + playerHalfW();
    const playerMaxX = () => W - EDGE_MARGIN() - playerHalfW();
    // Continuous left/right input (keyboard), applied every frame.
    const heldX = { left: false, right: false };
    // Continuous up/down input, mirroring the horizontal system: a short tap
    // nudges past the midpoint (settling one lane away), holding keeps gliding.
    const heldY = { up: false, down: false };
    const H_SPEED = () => W * 0.85; // px per second
    const V_SPEED = () => laneGap() * 3.2; // px per second (same feel as X)
    const playerMinY = () => laneY(0);
    const playerMaxY = () => laneY(2);
    const nearestLaneTo = (y: number): Lane => {
      let nearest: Lane = 1, bestD = Infinity;
      for (let i = 0; i < 3; i++) {
        const dd = Math.abs(y - laneY(i as Lane));
        if (dd < bestD) { bestD = dd; nearest = i as Lane; }
      }
      return nearest;
    };

    const player = {
      lane: 1 as Lane,
      targetLane: 1 as Lane,
      x: 0,
      targetX: 0,
      y: 0,
      targetY: 0,
      knock: 0, // x knockback
    };
    // Tap-to-move tween: 0.5s ease-in-out glide to the tapped lane position.
    const TAP_TWEEN_DUR = 0.5;
    const tween = { active: false, t: 0, fx: 0, fy: 0, tx: 0, ty: 0 };
    const easeInOut = (p: number) =>
      p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const startTween = (tx: number, ty: number) => {
      tween.active = true; tween.t = 0;
      tween.fx = player.x; tween.fy = player.y;
      tween.tx = tx; tween.ty = ty;
    };
    const playerY = () => player.y + player.knock;

    // Decisions queue: a flat list, only the first unresolved one is "active"
    // and visibly falling. The next one spawns after the current resolves.
    let queue: FallingDecision[] = [];
    let activeIdx = 0;
    const powerups: Powerup[] = [];
    let questionTimer = 0;
    let bonusSchedule: number[] = [];
    let lastBonusSpawnIdx = -1;
    let activeIdxTimer = 0;
    let lastTrackedActiveIdx = -1;
    const currentQuestionRef = { current: null as string | null };

    const fallSpeed = () => {
      // Time per question maps to how long a boat takes to sail from the
      // right edge to the player's resolve line.
      const t = timePerQuestionForLevel(levelRef.current);
      const dist = W * (SPAWN_X_FRAC - RESOLVE_X_FRAC);
      const base = dist / Math.max(1, t);
      return slowTimer > 0 ? base * 0.5 : base;
    };

    // Bonuses always fall straight DOWN across the whole play area.
    const bonusFallSpeed = () => {
      const t = timePerQuestionForLevel(levelRef.current);
      const base = (H + 240) / Math.max(1, t);
      return slowTimer > 0 ? base * 0.5 : base;
    };

    const pickType = (): PowerupType => {
      const r = Math.random();
      if (r < 0.45) {
        const q = Math.random();
        if (q < 0.34) return "star";
        if (q < 0.62) return "heart";
        if (q < 0.84) return "shield";
        return "shineheart";
      }
      if (r < 0.9) return Math.random() < 0.5 ? "slow" : "hint";
      const n = Math.random();
      if (n < 0.34) return "apple";
      if (n < 0.67) return "broken";
      return "web";
    };

    const spawnPowerup = () => {
      powerups.push({
        x: W * (0.18 + Math.random() * 0.62),
        y: -80,
        type: pickType(),
        taken: false,
        bobSeed: Math.random() * Math.PI * 2,
      });
    };

    // Build a per-question bonus schedule: for every 10-question block, pick
    // 6..12 bonuses (3x the previous 2..4), spread across the block. Each
    // question can now carry more than one bonus.
    const buildBonusSchedule = (n: number): number[] => {
      const out = new Array<number>(n).fill(0);
      for (let start = 0; start < n; start += 10) {
        const len = Math.min(10, n - start);
        if (len <= 0) break;
        const count = (2 + Math.floor(Math.random() * 3)) * 3; // 6..12
        for (let i = 0; i < count; i++) {
          out[start + Math.floor((i / count) * len)] += 1;
        }
      }
      return out;
    };

    const buildLevel = (lvl: number) => {
      const qs: GameQuestion[] = buildLevelQuestions(lvl, languageRef.current, usedIdsRef.current);
      queue = qs.map((item) => ({
        x: W * SPAWN_X_FRAC,
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
      const platTopRef = H * GROUND_FRAC;
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

    // Horizontal lane tracks + ground band at the bottom.
    const drawGround = () => {
      const platTop = H * GROUND_FRAC;
      const gr = themeFor(levelRef.current).ground;
      const g = laneGap();

      // Ground band under the lowest lane
      ctx.fillStyle = gr.bottom;
      ctx.fillRect(0, platTop, W, H - platTop);
      ctx.fillStyle = gr.top;
      ctx.fillRect(0, platTop, W, Math.max(10, g * 0.16));
      ctx.fillStyle = gr.rim;
      ctx.fillRect(0, platTop, W, 2);

      // Lane tracks are intentionally not drawn: lanes stay functional but
      // have no visible lines or bands.
    };

    // ----- Answer boats (sail right -> left, one per lane) -----
    // Boat colours are derived from the CURRENT MAP palette so they always
    // feel part of the same artistic world: hue comes from the map ground
    // (shifted for contrast), and brightness encodes the lane hierarchy
    // (top = deep, middle = medium, bottom = light pastel).
    const hexToHsl = (hex: string): [number, number, number] => {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      const r = parseInt(full.slice(0, 2), 16) / 255;
      const g = parseInt(full.slice(2, 4), 16) / 255;
      const b = parseInt(full.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let s = 0, hue = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue *= 60;
      }
      return [hue, s, l];
    };
    const hsl = (h: number, s: number, l: number) =>
      `hsl(${((h % 360) + 360) % 360} ${Math.round(Math.max(0, Math.min(1, s)) * 100)}% ${Math.round(Math.max(0, Math.min(1, l)) * 100)}%)`;

    // Lane brightness ladder: TOP darker -> MIDDLE medium -> BOTTOM lighter
    const LANE_LIGHT = [0.46, 0.62, 0.78];

    const boatPalette = (lane: number) => {
      const theme = themeFor(levelRef.current);
      const [bh, bs] = hexToHsl(theme.ground.top);
      // Analogous-with-contrast hue: nudge away from the ground hue so the
      // boats read clearly without clashing with the map.
      const hue = bh + 28;
      const sat = Math.max(0.28, Math.min(0.5, bs * 0.75 + 0.18));
      const l = LANE_LIGHT[lane];
      return {
        hull: hsl(hue, sat, l),
        hullDark: hsl(hue - 6, sat * 1.05, Math.max(0.16, l - 0.14)),
        sail: hsl(hue + 12, sat * 0.6, Math.min(0.93, l + 0.16)),
        sailShade: hsl(hue + 12, sat * 0.7, Math.min(0.88, l + 0.06)),
        trim: hsl(hue - 10, sat * 1.1, Math.max(0.12, l - 0.26)),
        ink: l > 0.6 ? "#241f14" : "#f6f1e4",
      };
    };

    const wrapText = (text: string, maxW: number, maxLines = 2): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > maxW && cur) {
          lines.push(cur);
          cur = w;
          if (lines.length === maxLines - 1) {
            const rest = words.slice(words.indexOf(w)).join(" ");
            let r = rest;
            while (ctx.measureText(r + "\u2026").width > maxW && r.length > 1) r = r.slice(0, -1);
            if (r !== rest) r += "\u2026";
            lines.push(r);
            cur = "";
            break;
          }
        } else cur = test;
      }
      if (cur) lines.push(cur);
      return lines.slice(0, maxLines);
    };

    // Shared boat width so collision uses the same geometry as rendering.
    const boatWidth = () => Math.min(W * 0.32, Math.max(150, laneGap() * 1.85));

    // Distance from the lane-centred anchor (d.x) to the ark's actual LEFT/front
    // tip, matching exactly the drawn artwork geometry below (imgLeft).
    const arkFrontOffset = () => {
      const sprite = getArkSprite(levelRef.current);
      const asp = sprite
        ? (sprite as HTMLImageElement | HTMLCanvasElement).width /
          Math.max(1, (sprite as HTMLImageElement | HTMLCanvasElement).height)
        : 1;
      const sizeFix = asp > 1 ? 1 / Math.sqrt(asp) : 1;
      const artW = boatWidth() * 0.66 * sizeFix * asp;
      const plaqueCxN = (BOAT_PLAQUE.x0 + BOAT_PLAQUE.x1) / 2;
      return plaqueCxN * artW;
    };

    const drawBoat = (
      cx: number, cy: number, lane: number, text: string,
      highlight: boolean, alpha: number,
    ) => {
      const g = laneGap();
      const bw = boatWidth();
      const pal = boatPalette(lane);
      const bob = Math.sin(timeSec * 2 + lane * 1.3) * g * 0.035;
      const tilt = Math.sin(timeSec * 1.6 + lane) * 0.02;
      const sprite = getArkSprite(levelRef.current);
      // Levels 1-2 use square artwork, levels 3-10 use 3:2 artwork. Drawn into
      // the same box the 3:2 arks read much bigger, so scale the whole boat
      // group (art + text) down to match the level 1-2 footprint.
      const spriteAspect = sprite
        ? (sprite as HTMLImageElement | HTMLCanvasElement).width /
          Math.max(1, (sprite as HTMLImageElement | HTMLCanvasElement).height)
        : 1;
      // Every ark is drawn at the SAME visual height, with its own artwork
      // aspect preserved (no squashing), so levels 1-2 read as tall as 3-10.
      // Level 1 artwork reads more saturated/darker than the pastel avatars.
      const arkFilter = levelRef.current === 1
        ? "saturate(0.62) brightness(1.3) contrast(0.96)"
        : "none";
      // Ark height keeps the artwork proportions but stays lane-sized.
      const bh = bw * 0.66;
      // Levels 1-2 use square artwork and define the reference visual size.
      // Levels 3-10 ship wider artwork, so normalise their scale to cover the
      // same on-screen footprint as the level 1 ark (no squashing).
      const asp = spriteAspect || 1;
      const sizeFix = asp > 1 ? 1 / Math.sqrt(asp) : 1;
      const artH = bh * sizeFix;
      const artW = artH * asp;
      // Plaque geometry in local ark coordinates, centred on the lane line.
      const plaqueW = (BOAT_PLAQUE.x1 - BOAT_PLAQUE.x0) * artW;
      const plaqueH = (BOAT_PLAQUE.y1 - BOAT_PLAQUE.y0) * artH;
      const plaqueCyN = (BOAT_PLAQUE.y0 + BOAT_PLAQUE.y1) / 2;
      const plaqueCxN = (BOAT_PLAQUE.x0 + BOAT_PLAQUE.x1) / 2;
      const imgLeft = -plaqueCxN * artW;
      const imgTop = -plaqueCyN * artH;

      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(cx, cy + bob);
      ctx.rotate(tilt);

      // ----- Subtle wind streaks behind the ark (opposite travel direction) -----
      {
        ctx.save();
        ctx.lineCap = "round";
        const baseX = imgLeft + artW * 0.98;
        for (let k = 0; k < 3; k++) {
          const ph = timeSec * 0.9 + k * 0.83 + lane * 0.6;
          const t = ph % 1;
          const len = artW * (0.16 + 0.1 * k) * (0.5 + 0.5 * Math.sin(ph * 2));
          const y = imgTop + artH * (0.34 + k * 0.18) + Math.sin(ph * 1.7) * artH * 0.02;
          const x = baseX + t * artW * 0.1;
          const grad = ctx.createLinearGradient(x, 0, x + len, 0);
          grad.addColorStop(0, "rgba(255,255,255,0.20)");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(1, artH * 0.012);
          ctx.globalAlpha = 0.55 * (1 - t * 0.6);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + len, y - artH * 0.012);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (highlight) {
        const hp = 0.5 + 0.5 * Math.sin(timeSec * 5);
        ctx.shadowColor = "rgba(255, 226, 140, 0.95)";
        ctx.shadowBlur = 30 + 18 * hp;
      }

      if (sprite) {
        // Subtle, always-on glow so the ark feels lit like the avatars.
        if (!highlight) {
          const gp = 0.5 + 0.5 * Math.sin(timeSec * 1.6 + lane);
          ctx.save();
          ctx.filter = arkFilter;
          ctx.shadowColor = `rgba(255, 240, 205, ${0.32 + 0.08 * gp})`;
          ctx.shadowBlur = artH * (0.09 + 0.02 * gp);
          ctx.drawImage(sprite, imgLeft, imgTop, artW, artH);
          ctx.filter = "none";
          ctx.restore();
        }
        ctx.filter = arkFilter;
        ctx.drawImage(sprite, imgLeft, imgTop, artW, artH);
        ctx.filter = "none";
        if (highlight) {
          const hp = 0.5 + 0.5 * Math.sin(timeSec * 5);
          ctx.save();
          ctx.shadowColor = `rgba(255, 224, 140, ${0.75 + 0.2 * hp})`;
          ctx.shadowBlur = 34 + 20 * hp;
          ctx.drawImage(sprite, imgLeft, imgTop, artW, artH);
          ctx.drawImage(sprite, imgLeft, imgTop, artW, artH);
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha *= 0.22 + 0.14 * hp;
          ctx.drawImage(sprite, imgLeft, imgTop, artW, artH);
          ctx.restore();
        }
      } else {
        // Fallback plaque while the artwork loads.
        ctx.fillStyle = pal.hull;
        ctx.beginPath();
        ctx.roundRect(-plaqueW / 2, -plaqueH / 2, plaqueW, plaqueH, plaqueH / 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Answer text, always inside the plaque under the sail.
      const maxTextW = plaqueW * 0.9;
      let fs = Math.max(11, Math.min(24, plaqueH * 0.46));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let lines: string[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        ctx.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`;
        lines = wrapText(text, maxTextW, 2);
        const lh = fs * 1.05;
        if (lines.length * lh <= plaqueH * 0.92) break;
        fs *= 0.88;
      }
      const lh = fs * 1.05;
      const startY = -((lines.length - 1) * lh) / 2;
      ctx.fillStyle = "#3a2405";
      lines.forEach((l, i) => ctx.fillText(l, 0, startY + i * lh));

      ctx.restore();
    };

    const drawActiveDecision = (dt: number) => {
      const d = queue[activeIdx];
      if (!d) return;
      // Depth order: BOTTOM behind, MIDDLE, TOP in front.
      for (const i of [2, 1, 0]) {
        const outcome = d.doorOutcome[i];
        const cy = laneY(i as Lane);
        if (outcome) d.doorAnim[i] = Math.min(1, d.doorAnim[i] + dt * 3);
        const anim = d.doorAnim[i];
        if (outcome && anim >= 1) continue;
        const highlight = hintActive === i;
        drawBoat(d.x, cy, i, d.answers[i], highlight, outcome ? 1 - anim : 1);
      }
    };

    // ----- Powerups -----
    const drawPowerupIcon = (type: PowerupType) => {
      // Hand-made artwork when available; the vector shapes below stay as a
      // fallback until the sprite has finished loading.
      const sprite = getBonusSprite(type);
      if (sprite) {
        const iw = sprite.naturalWidth || 1;
        const ih = sprite.naturalHeight || 1;
        const box = 30;
        const k = box / Math.max(iw, ih);
        const w = iw * k, h = ih * k;
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        return;
      }
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
        case "shineheart": {
          // Bright, glowing heart — life/health bonus
          const t2 = performance.now() / 1000;
          const pulse = 1 + Math.sin(t2 * 5) * 0.06;
          ctx.save();
          ctx.scale(pulse, pulse);
          const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 14);
          g.addColorStop(0, "rgba(255, 255, 255, 0.98)");
          g.addColorStop(0.45, "rgba(255, 170, 195, 0.98)");
          g.addColorStop(1, "rgba(255, 70, 120, 0.95)");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(255, 120, 170, 0.95)";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.moveTo(0, 9);
          ctx.bezierCurveTo(13, -2, 9, -13, 0, -5.5);
          ctx.bezierCurveTo(-9, -13, -13, -2, 0, 9);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(255, 245, 250, 0.9)";
          ctx.lineWidth = 1.1;
          ctx.stroke();
          // sparkle highlight
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.ellipse(-4, -5, 2.2, 1.4, -0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
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
        case "shield": {
          ctx.fillStyle = "#d9b477";
          ctx.strokeStyle = "rgba(90,60,20,0.85)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, -12);
          ctx.lineTo(11, -7);
          ctx.lineTo(9, 6);
          ctx.lineTo(0, 13);
          ctx.lineTo(-9, 6);
          ctx.lineTo(-11, -7);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "rgba(255,235,180,0.95)";
          ctx.fillRect(-1.8, -8, 3.6, 16);
          ctx.fillRect(-7, -3.5, 14, 3.6);
          break;
        }
      }
    };

    const drawPowerups = () => {
      const t = performance.now() / 1000;
      powerups.forEach((p) => {
        if (p.taken) return;
        if (p.y < -70 || p.y > H + 70) return;
        const sx = p.x + Math.sin(t * 2.4 + p.bobSeed) * 4;
        const negative = NEGATIVE_BONUSES.includes(p.type);
        const pulse = 0.85 + 0.15 * Math.sin(t * 3 + p.bobSeed);
        const haloColor =
          p.type === "star" ? "rgba(255, 232, 150, 0.5)" :
          p.type === "heart" ? "rgba(255, 140, 150, 0.45)" :
          p.type === "shineheart" ? "rgba(170, 200, 255, 0.6)" :
          p.type === "shield" ? "rgba(255, 225, 165, 0.5)" :
          p.type === "slow" ? "rgba(180, 225, 255, 0.45)" :
          p.type === "hint" ? "rgba(255, 235, 175, 0.5)" :
          p.type === "apple" ? "rgba(20, 8, 12, 0.62)" :
          "rgba(14, 6, 10, 0.66)";
        const R = negative ? 48 : 56;
        const halo = ctx.createRadialGradient(sx, p.y, negative ? 12 : 0, sx, p.y, R);
        halo.addColorStop(0, haloColor);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save();
        ctx.globalAlpha = pulse;
        if (!negative) ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = halo;
        ctx.fillRect(sx - R, p.y - R, R * 2, R * 2);
        ctx.restore();
        ctx.save();
        ctx.translate(sx, p.y);
        // Bonus icons render at 2x visual size (gameplay effect unchanged)
        ctx.scale(2, 2);
        if (!negative) {
          ctx.shadowColor = haloColor;
          ctx.shadowBlur = 8 * pulse;
        }
        drawPowerupIcon(p.type);
        ctx.restore();
      });
    };

    const applyPowerup = (p: Powerup) => {
      const px = player.x;
      const py = playerY();
      switch (p.type) {
        case "star":
          invuln = Math.max(invuln, 7);
          spawnPickupBurst(px, py, "rgba(255, 230, 140, 0.9)");
          break;
        case "shield":
          shieldRef.current = true;
          setShieldActive(true);
          spawnPickupBurst(px, py, "rgba(255, 225, 165, 0.95)");
          break;
        case "heart": {
          const nh = Math.min(maxLivesRef.current, healthRef.current + 1);
          healthRef.current = nh; setHealth(nh);
          spawnPickupBurst(px, py, "rgba(255, 140, 150, 0.9)");
          break;
        }
        case "shineheart": {
          // +1 current life AND +1 maximum life (capped at MAX_LIVES)
          if (maxLivesRef.current < MAX_LIVES) {
            maxLivesRef.current += 1;
            setMaxLives(maxLivesRef.current);
          }
          const nh = Math.min(maxLivesRef.current, healthRef.current + 1);
          if (nh > healthRef.current) {
            healthRef.current = nh; setHealth(nh);
            setLifeFlash(Date.now());
          }
          spawnPickupBurst(px, py, "rgba(255, 170, 200, 0.95)");
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
      const x = player.x + player.knock;
      const y = player.y;
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
      player.x = W * RESOLVE_X_FRAC;
      player.targetX = player.x;
      player.y = laneY(1);
      player.targetY = laneY(1);
      player.knock = 0;
      shake = 0; flash = 0; invuln = 0;
      slowTimer = 0; distortTimer = 0;
      hintActive = null;
      particles.length = 0;
      powerups.length = 0;
      setHealth(3); healthRef.current = 3;
      setMaxLives(3); maxLivesRef.current = 3;
      shieldRef.current = false; setShieldActive(false); setShieldBreak(0);
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
      // Shield absorbs exactly one impact and is then consumed.
      if (shieldRef.current) {
        shieldRef.current = false;
        setShieldActive(false);
        setShieldBreak(Date.now());
        shake = 10; flash = 0.22; invuln = 1.2;
        player.knock = -6;
        spawnPickupBurst(sxImpact, syImpact, "rgba(255, 225, 165, 0.95)");
        return;
      }
      const nh = Math.max(0, healthRef.current - 1);
      healthRef.current = nh; setHealth(nh);
      shake = 18; flash = 0.4; invuln = 1.2;
      player.knock = -10;
      spawnImpact(sxImpact, syImpact);
      streakRef.current = 0; setStreak(0);
      if (nh <= 0) {
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

        const dirY = (heldY.down ? 1 : 0) - (heldY.up ? 1 : 0);
        const dirX = (heldX.right ? 1 : 0) - (heldX.left ? 1 : 0);
        if (tween.active && (dirX !== 0 || dirY !== 0)) tween.active = false;
        if (tween.active) {
          // 0.5s ease-in-out glide (slow -> fast -> slow), no snapping.
          tween.t += dt;
          const p = Math.min(1, tween.t / TAP_TWEEN_DUR);
          const e = easeInOut(p);
          player.x = tween.fx + (tween.tx - tween.fx) * e;
          player.y = tween.fy + (tween.ty - tween.fy) * e;
          player.targetX = player.x;
          player.targetY = player.y;
          if (p >= 1) { tween.active = false; player.x = tween.tx; player.y = tween.ty; }
        } else {
          // Immediate, continuous vertical input while held (same as X)
          if (dirY !== 0) player.targetY += dirY * V_SPEED() * dt;
          player.targetY = Math.max(playerMinY(), Math.min(playerMaxY(), player.targetY));
          // Frame-rate independent exponential smoothing -> continuous glide.
          const kY = 1 - Math.exp(-16 * dt);
          player.y += (player.targetY - player.y) * kY;
          // Immediate, continuous horizontal input while held
          if (dirX !== 0) player.targetX += dirX * H_SPEED() * dt;
          player.targetX = Math.max(playerMinX(), Math.min(playerMaxX(), player.targetX));
          const kX = 1 - Math.exp(-16 * dt);
          player.x += (player.targetX - player.x) * kX;
        }
        // Hard clamps so the sprite is always fully on-screen
        player.y = Math.max(playerMinY(), Math.min(playerMaxY(), player.y));
        player.x = Math.max(playerMinX(), Math.min(playerMaxX(), player.x));
        // Lane is derived from the continuous position (midpoint = commit)
        player.lane = nearestLaneTo(player.y);
        player.targetLane = nearestLaneTo(player.targetY);
        if (player.knock < 0) {
          player.knock += dt * 40;
          if (player.knock > 0) player.knock = 0;
        }
        if (invuln > 0) invuln -= dt;
        if (Math.random() < dt * 8) spawnDust(player.x - 14, player.y + (Math.random() - 0.5) * 12, 1);

        // Active decision sails right -> left
        const d = queue[activeIdx];
        if (d && !d.resolved) {
          d.x -= fallSpeed() * dt;
          // Question timer (visual feedback)
          questionTimer -= dt;
          // Resolve when the boat's LEFT/front tip touches the player,
          // not when its centre arrives.
          const boatTipX = d.x - arkFrontOffset();
          // Collision reach is calibrated on the Dove (reference avatar),
          // drawn at BASE_W 46 with scale 2 -> 46px half width, so the answer
          // triggers when the dove visually touches the ark's front tip.
          const playerFrontX = player.x + DOVE_COLLIDE_HALF_W;
          if (boatTipX <= playerFrontX || d.x <= -boatWidth()) {
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
                  x: player.x, y: player.y - 10,
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
              damage(player.x, player.y);
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

        // Power-ups always keep falling straight DOWN through the play area
        const ps = bonusFallSpeed();
        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i];
          if (p.taken) { powerups.splice(i, 1); continue; }
          p.y += ps * dt;
          // Pickup test — radial proximity to the player
          const pdx = p.x - player.x;
          const pdy = p.y - player.y;
          // Forgiving pickup radius — visual size unchanged
          if (!p.taken && pdx * pdx + pdy * pdy <= 68 * 68) {
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
    const setTurbo = (on: boolean) => { turboRef.current = on ? 4 : 1; };
    const TURBO_HOLD_MS = 500;
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

    // Keyboard hold-to-accelerate (Shift), independent from pointer hold
    const KEY_TURBO_HOLD_MS = 300;
    let keyTurboTimer: ReturnType<typeof setTimeout> | null = null;
    let keyTurboHeld = false;
    const isTurboKey = (k: string) => k === "Shift";
    const releaseKeyTurbo = () => {
      if (keyTurboTimer !== null) { clearTimeout(keyTurboTimer); keyTurboTimer = null; }
      if (keyTurboHeld) { keyTurboHeld = false; setTurbo(false); }
    };

    const moveLane = (dir: -1 | 1) => {
      if (stateRef.current !== "playing") return;
      tween.active = false;
      const next = Math.max(0, Math.min(2, nearestLaneTo(player.targetY) + dir)) as Lane;
      if (next !== player.targetLane) sfx.playMove();
      player.targetLane = next;
      player.targetY = laneY(next);
    };

    let lastVertDir: -1 | 1 = 1;
    const clearVertHold = () => { heldY.up = false; heldY.down = false; };
    const startVert = (dir: -1 | 1) => {
      if (stateRef.current !== "playing") return;
      tween.active = false;
      const held = dir === -1 ? heldY.up : heldY.down;
      if (held) return;
      lastVertDir = dir;
      if (dir === -1) { heldY.up = true; heldY.down = false; }
      else { heldY.down = true; heldY.up = false; }
      // Immediate nudge past the midpoint so a short tap settles one lane away
      const before = nearestLaneTo(player.targetY);
      player.targetY = Math.max(playerMinY(), Math.min(playerMaxY(),
        player.targetY + dir * laneGap() * 0.55));
      if (nearestLaneTo(player.targetY) !== before) sfx.playMove();
    };
    const stopVert = (dir: -1 | 1) => {
      if (dir === -1) heldY.up = false; else heldY.down = false;
      if (!heldY.up && !heldY.down) {
        // Never step backwards on release: finish the committed transition by
        // settling on the next lane in the direction of travel.
        const d = lastVertDir;
        let settle = nearestLaneTo(player.targetY);
        if (d === 1 && laneY(settle) < player.targetY - 0.5) settle = Math.min(2, settle + 1) as Lane;
        if (d === -1 && laneY(settle) > player.targetY + 0.5) settle = Math.max(0, settle - 1) as Lane;
        player.targetLane = settle;
        player.targetY = laneY(settle);
      }
    };

    // Map a screen point to canvas-local coordinates, accounting for the
    // 90deg stage rotation used to force landscape on portrait devices.
    const toLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rotated = window.innerHeight > window.innerWidth;
      if (!rotated) return { x: clientX - rect.left, y: clientY - rect.top };
      return { x: W / 2 + (clientY - cy), y: H / 2 - (clientX - cx) };
    };

    // Pointer steering: vertical position picks the lane, horizontal
    // position sets the smooth target X inside the playable band.
    const steerTo = (clientX: number, clientY: number, smooth = false) => {
      if (stateRef.current !== "playing") return;
      const { x, y } = toLocal(clientX, clientY);
      const lane = nearestLaneTo(y);
      if (lane !== player.targetLane) sfx.playMove();
      player.targetLane = lane;
      const tx = Math.max(playerMinX(), Math.min(playerMaxX(), x));
      if (smooth) {
        // Tap: glide to the nearest walkable lane position over 0.5s.
        startTween(tx, laneY(lane));
      } else {
        tween.active = false;
        player.targetY = Math.max(playerMinY(), Math.min(playerMaxY(), y));
        player.targetX = tx;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = performance.now();
      steerTo(t.clientX, t.clientY, true);
    };
    const onTouchMoveTurbo = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      steerTo(t.clientX, t.clientY);
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > TURBO_MOVE_TOL || Math.abs(dy) > TURBO_MOVE_TOL) {
        clearTurboHold();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dy = t.clientY - touchStartY;
      const dt2 = performance.now() - touchStartTime;
      if (dt2 < 400 && Math.abs(dy) > 40) moveLane(dy < 0 ? -1 : 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current !== "playing") return;
      if (e.key === "ArrowUp" || e.key === "w") { if (!e.repeat) startVert(-1); }
      else if (e.key === "ArrowDown" || e.key === "s") { if (!e.repeat) startVert(1); }
      else if (e.key === "ArrowLeft" || e.key === "a") {
        // Immediate nudge, then continuous movement while held
        if (!heldX.left) player.targetX -= W * 0.02;
        heldX.left = true;
      } else if (e.key === "ArrowRight" || e.key === "d") {
        if (!heldX.right) player.targetX += W * 0.02;
        heldX.right = true;
      }
      else if (e.key === "1") { tween.active = false; player.targetLane = 0; player.targetY = laneY(0); }
      else if (e.key === "2") { tween.active = false; player.targetLane = 1; player.targetY = laneY(1); }
      else if (e.key === "3") { tween.active = false; player.targetLane = 2; player.targetY = laneY(2); }
    };
    const onKeyUpMove = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") heldX.left = false;
      else if (e.key === "ArrowRight" || e.key === "d") heldX.right = false;
      else if (e.key === "ArrowUp" || e.key === "w") stopVert(-1);
      else if (e.key === "ArrowDown" || e.key === "s") stopVert(1);
    };
    const onBlurMove = () => {
      heldX.left = false; heldX.right = false;
      heldY.up = false; heldY.down = false; clearVertHold();
    };
    const onKeyDownTurbo = (e: KeyboardEvent) => {
      if (!isTurboKey(e.key)) return;
      if (e.repeat || keyTurboHeld || keyTurboTimer !== null) return;
      keyTurboTimer = setTimeout(() => {
        keyTurboTimer = null;
        keyTurboHeld = true;
        setTurbo(true);
      }, KEY_TURBO_HOLD_MS);
    };
    const onKeyUpTurbo = (e: KeyboardEvent) => {
      if (!isTurboKey(e.key)) return;
      releaseKeyTurbo();
    };
    const onWindowBlurTurbo = () => releaseKeyTurbo();
    const onMouseDown = (e: MouseEvent) => { steerTo(e.clientX, e.clientY, true); };
    let mouseDownX = 0, mouseDownY = 0;
    let mouseDragging = false;
    const onMouseDownTurbo = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownX = e.clientX; mouseDownY = e.clientY;
      mouseDragging = true;
      armTurboHold();
    };
    const onMouseMoveTurbo = (e: MouseEvent) => {
      if (mouseDragging) steerTo(e.clientX, e.clientY);
      if (turboHoldTimer === null) return;
      if (Math.abs(e.clientX - mouseDownX) > TURBO_MOVE_TOL ||
          Math.abs(e.clientY - mouseDownY) > TURBO_MOVE_TOL) {
        clearTurboHold();
      }
    };
    const onMouseUpTurbo = () => { mouseDragging = false; releaseTurbo(); };
    const onMouseLeaveTurbo = () => { mouseDragging = false; releaseTurbo(); };
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
    window.addEventListener("keyup", onKeyUpMove);
    window.addEventListener("blur", onBlurMove);
    window.addEventListener("keydown", onKeyDownTurbo);
    window.addEventListener("keyup", onKeyUpTurbo);
    window.addEventListener("blur", onWindowBlurTurbo);

    player.x = W * RESOLVE_X_FRAC;
    player.targetX = player.x;
    player.y = laneY(1);
    player.targetY = laneY(1);

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
      window.removeEventListener("keyup", onKeyUpMove);
      window.removeEventListener("blur", onBlurMove);
      window.removeEventListener("keydown", onKeyDownTurbo);
      window.removeEventListener("keyup", onKeyUpTurbo);
      window.removeEventListener("blur", onWindowBlurTurbo);
      releaseKeyTurbo();
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
    // Name is stored locally; the next score submission will refresh the
    // player_name on this device's leaderboard row.
  };

  const t = getT(language);

  // Forced landscape: when the device is held in portrait, the whole stage
  // (canvas + every HTML overlay) is rotated 90deg so the game always
  // renders horizontally.
  const stageW = viewport.h > viewport.w ? viewport.h : viewport.w;
  const stageH = viewport.h > viewport.w ? viewport.w : viewport.h;
  const rotated = viewport.w > 0 && viewport.h > viewport.w;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none">
    <div
      className="absolute left-1/2 top-1/2 overflow-hidden"
      style={{
        width: stageW || "100%",
        height: stageH || "100%",
        transform: rotated
          ? "translate(-50%, -50%) rotate(90deg)"
          : "translate(-50%, -50%)",
        transformOrigin: "center center",
      }}
    >
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
          {lifeFlash > 0 && (
            <div
              key={lifeFlash}
              className="pointer-events-none absolute left-1/2 top-1/3 z-20 -translate-x-1/2 animate-in fade-in zoom-in duration-200"
            >
              <div className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-1.5 text-sm font-bold tracking-widest text-rose-100 shadow-[0_0_28px_rgba(255,120,170,0.8)] backdrop-blur">
                <span className="text-rose-300 drop-shadow-[0_0_8px_rgba(255,120,170,0.95)]">♥</span>
                <span>+1</span>
              </div>
            </div>
          )}
          {/* Top HUD: left group (lives/score/questions), right group (level/streak), home button */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(MAX_LIVES, Math.max(3, maxLives)) }, (_, i) => i).map((i) => (
                  <Heart
                    key={i}
                    filled={i < health}
                    pop={lifeFlash > 0 && i === health - 1}
                    shielded={shieldActive && i === health - 1}
                    shieldBroke={shieldBreak > 0 && i === health - 1}
                  />
                ))}
                {shieldActive && (
                  <span className="ml-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-amber-100 backdrop-blur animate-pulse drop-shadow-[0_0_6px_rgba(255,225,165,0.9)]">
                    ✛
                  </span>
                )}
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
            onAvatars={() => setShowAvatars(true)}
            onLeaderboard={async () => {
              setShowLeaderboard(true);
              setTopTen(null); // clear stale state before refetch
              const tops = await fetchTop10();
              setTopTen(tops); // full replacement, never merged
            }}
            onMoreGames={() => setShowMoreGames(true)}
          />
        </Overlay>
      )}

      {state === "gameover" && (
        <Overlay scrollable>
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
          <div className="mt-6 flex items-center gap-3">
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
          <LeaderboardList entries={topTen} t={t} selfAvatar={equippedAvatar} />
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
              ? window.confirm("Reset ALL data? This will clear name, progress, avatars, and settings.")
              : true;
            if (!ok) return;
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch { /* ignore */ }
            try { window.location.reload(); } catch { /* ignore */ }
          }}
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
          equipped={equippedAvatar}
          onEquip={(id) => setEquippedAvatar(id)}
          onClose={() => setShowAvatars(false)}
          title={t("avatars")}
          lang={language}
          t={t}
        />
      )}
    </div>
    </div>
  );
}

function Overlay({ children, scrollable }: { children: React.ReactNode; scrollable?: boolean }) {
  if (scrollable) {
    return (
      <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      {children}
    </div>
  );
}

function Heart({ filled, pop, shielded, shieldBroke }: {
  filled: boolean; pop?: boolean; shielded?: boolean; shieldBroke?: boolean;
}) {
  return (
    <span className="relative inline-flex">
      {shielded && (
        <span className="pointer-events-none absolute -inset-1 rounded-full border border-amber-200/70 animate-pulse shadow-[0_0_10px_rgba(255,225,165,0.85)]" />
      )}
      <svg
        viewBox="0 0 24 24"
        width={20}
        height={20}
        aria-hidden
        className={
          shieldBroke
            ? "animate-in zoom-in-50 duration-300 drop-shadow-[0_0_10px_rgba(255,225,165,1)]"
            : pop
              ? "animate-in zoom-in-50 duration-300 drop-shadow-[0_0_8px_rgba(255,150,190,0.95)]"
              : shielded
                ? "animate-pulse drop-shadow-[0_0_8px_rgba(255,225,165,0.95)]"
                : undefined
        }
      >
        <path
          d="M12 21s-7-4.5-9.5-9.2C.9 8.5 2.6 5 6 5c2 0 3.4 1 4 2.2C10.6 6 12 5 14 5c3.4 0 5.1 3.5 3.5 6.8C19 16.5 12 21 12 21z"
          fill={filled ? "#ffdca8" : "rgba(255,220,170,0.18)"}
          stroke="rgba(255,220,170,0.9)"
          strokeWidth={1.2}
        />
      </svg>
    </span>
  );
}

function Stat({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
  const intValue = Math.max(0, Math.floor(Number(value) || 0));
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] tracking-[0.3em] text-amber-200/70">{label}</span>
      <span className="mt-1 text-2xl font-light tabular-nums text-amber-50">
        {intValue > 0 || !prefix ? `${prefix ?? ""}${intValue}` : "—"}
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
              <span className="truncate">{e.player_name}</span>
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
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border border-amber-200/30 bg-black/30 px-4 py-1.5 text-center text-[10px] tracking-[0.25em] text-amber-100/80 backdrop-blur transition hover:border-amber-200/60 hover:text-amber-50 " +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

function MainMenuGroups({
  t,
  equippedAvatar,
  onAvatars,
  onLeaderboard,
  onMoreGames,
}: {
  t: (key: UIKey) => string;
  equippedAvatar: AvatarId;
  onAvatars: () => void;
  onLeaderboard: () => void;
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
      <div className="grid w-full grid-cols-2 items-stretch gap-3 sm:gap-4">
        <MenuButton onClick={onLeaderboard} className="w-full">
          {t("leaderboard")}
        </MenuButton>
        <MenuButton onClick={onMoreGames} className="w-full">
          {t("moreGames")}
        </MenuButton>
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
            onClick={onChangeName}
            className="rounded-full border border-amber-200/40 bg-black/30 px-3 py-1.5 text-[10px] tracking-[0.25em] text-amber-100/90 hover:border-amber-200/70 hover:text-amber-50"
          >
            {t("change")}
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
      {DEV_MODE_AVAILABLE && (
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
      )}
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
    <div className="absolute inset-0 z-40 flex flex-col items-center overflow-y-auto bg-black/70 backdrop-blur-md animate-fade-in px-4">
      <div className="flex flex-col items-center m-auto py-8">
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
    </div>
  );
}
