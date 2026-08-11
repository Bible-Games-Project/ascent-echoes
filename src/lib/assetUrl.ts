// Resolves CDN asset URLs (".asset.json" pointers) so they also work inside
// native app shells.
//
// Asset pointers are root-relative ("/__l5e/assets-v1/<id>/<file>"). In a
// browser that resolves against the site origin and works fine. Inside a
// native webview the page is served from capacitor://localhost (iOS) or
// http://localhost (Android), where that path does not exist — every CDN
// asset 404s. There we must resolve against the hosted origin instead.

const PROJECT_ID = "e63f9e55-d172-4c48-aa75-5e718e9490ce";

/** Hosted origins that serve /__l5e/ assets, tried in order. */
export const ASSET_ORIGINS: string[] = [
  (import.meta.env["VITE_ASSET_ORIGIN"] as string | undefined) || "",
  `https://project--${PROJECT_ID}.lovable.app`,
  `https://project--${PROJECT_ID}-dev.lovable.app`,
].filter(Boolean);

/** True when the app runs inside a Capacitor/Cordova native webview. */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.() === true) return true;
  if (w.cordova) return true;
  const proto = window.location.protocol;
  return proto === "capacitor:" || proto === "ionic:" || proto === "file:";
}

/**
 * Absolute URL for a CDN asset path.
 * `originIndex` selects a fallback origin when the first one is unreachable.
 */
export function assetUrl(url: string, originIndex = 0): string {
  if (/^[a-z]+:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  if (!isNativeShell()) return url;
  const origin = ASSET_ORIGINS[Math.min(originIndex, ASSET_ORIGINS.length - 1)];
  if (!origin) return url;
  return origin.replace(/\/$/, "") + (url.startsWith("/") ? url : "/" + url);
}
