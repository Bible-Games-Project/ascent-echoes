// Dev-mode availability. Never ships to players: it is hidden on the published
// site and in native app builds.
//
// Visible when:
// - VITE_ENABLE_DEV_MODE is explicitly "true", or
// - it is a Vite dev build, or
// - the app runs on localhost or a Lovable preview host (id-preview-*, *-dev).
const FLAG = import.meta.env['VITE_ENABLE_DEV_MODE'];

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  // Capacitor/native shells must never expose the toggle.
  if (h === "" || h === "capacitor" || h === "app") return false;
  return /^id-preview-/.test(h) || /-dev\.lovable\.app$/.test(h) || /\.lovableproject\.com$/.test(h);
}

export const DEV_MODE_AVAILABLE: boolean =
  FLAG === "true" ||
  (FLAG !== "false" && (import.meta.env.DEV === true || isPreviewHost()));
