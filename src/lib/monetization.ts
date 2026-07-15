// Monetization: Premium flag + modular interstitial ad system.
// The interstitial engine only decides *when* to show an ad — swap the
// `showInterstitial()` body for a real provider (AdMob, Unity Ads, ...)
// without touching the game loop.

const PREMIUM_KEY = "btr_premium";
const AD_COUNTER_KEY = "btr_games_since_ad";
const AD_THRESHOLD_KEY = "btr_games_until_ad";

const MIN_GAMES_BETWEEN_ADS = 3;
const MAX_GAMES_BETWEEN_ADS = 5;
const LAUNCH_COOLDOWN_MS = 60_000;

const LAUNCH_TS = Date.now();

type PremiumListener = (isPremium: boolean) => void;
const premiumListeners = new Set<PremiumListener>();

function readInt(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = parseInt(raw, 10);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeInt(key: string, value: number): void {
  try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
}

function pickRandomThreshold(): number {
  const span = MAX_GAMES_BETWEEN_ADS - MIN_GAMES_BETWEEN_ADS + 1;
  return MIN_GAMES_BETWEEN_ADS + Math.floor(Math.random() * span);
}

export function getIsPremium(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(PREMIUM_KEY) === "1";
  } catch {
    return false;
  }
}

export function setIsPremium(value: boolean): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(PREMIUM_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  premiumListeners.forEach((fn) => {
    try { fn(value); } catch { /* ignore */ }
  });
}

/** Subscribe to premium changes so ad gating can react without a restart. */
export function subscribePremium(fn: PremiumListener): () => void {
  premiumListeners.add(fn);
  return () => { premiumListeners.delete(fn); };
}

/**
 * Modular interstitial ad engine.
 *
 * Rules enforced here:
 *  - Never show while a game is running (call sites only invoke this after
 *    a game has finished).
 *  - Never show before the player has completed their first game.
 *  - Never show within the first 60 seconds of app launch.
 *  - Show one full-screen interstitial after every 3–5 completed games
 *    (random per interval, persisted across sessions).
 *  - After each ad, pick a new random interval — never two ads back-to-back.
 *  - Premium users never see ads (checked live on every call).
 */
export const interstitials = {
  /**
   * Record a completed game. Returns `true` when the caller should now show
   * an interstitial via `showInterstitial()`.
   */
  onGameCompleted(): boolean {
    if (getIsPremium()) return false;

    const completed = readInt(AD_COUNTER_KEY, 0) + 1;
    writeInt(AD_COUNTER_KEY, completed);

    let threshold = readInt(AD_THRESHOLD_KEY, 0);
    if (threshold < MIN_GAMES_BETWEEN_ADS) {
      threshold = pickRandomThreshold();
      writeInt(AD_THRESHOLD_KEY, threshold);
    }

    if (Date.now() - LAUNCH_TS < LAUNCH_COOLDOWN_MS) return false;
    if (completed < threshold) return false;

    // Consume this ad slot and roll the next interval.
    writeInt(AD_COUNTER_KEY, 0);
    writeInt(AD_THRESHOLD_KEY, pickRandomThreshold());
    return true;
  },

  /**
   * Show the full-screen interstitial. Placeholder implementation resolves
   * after a short delay; replace with the real ad provider SDK call.
   */
  async showInterstitial(): Promise<void> {
    await new Promise((r) => setTimeout(r, 2500));
  },
};
