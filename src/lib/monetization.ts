// Monetization scaffolding for future Google AdMob + Premium integration.
// Gameplay code only calls into this module — replace internals later
// without touching the game loop.

const PREMIUM_KEY = "btr_premium";

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
}

/**
 * Rewarded-ad placeholder. Resolves to `true` if the player "watched" the ad
 * and earned the reward, `false` if it failed or was skipped.
 *
 * Replace the body with a Google AdMob Rewarded Ad callback when integrating.
 * The signature must stay the same so call sites do not change.
 */
export async function simulateRewardedAd(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 700));
  return true;
}
