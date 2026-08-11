// Dev-mode availability. Controlled by the build environment so the toggle
// never ships to players in production builds.
//
// - Development builds: visible by default.
// - Production builds: hidden, unless VITE_ENABLE_DEV_MODE is explicitly "true".
export const DEV_MODE_AVAILABLE: boolean =
  import.meta.env['VITE_ENABLE_DEV_MODE'] === "true" ||
  (import.meta.env['VITE_ENABLE_DEV_MODE'] !== "false" && import.meta.env.DEV === true);
