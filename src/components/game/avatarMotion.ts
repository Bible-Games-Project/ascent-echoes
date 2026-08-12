import type { AvatarId } from "@/lib/avatars";

// Per-avatar visual scale multiplier. Kept for call-site compatibility; the
// per-animal artwork size now lives in avatarRender (BASE_W).
export function scaleMultiplierFor(_id: AvatarId): number {
  return 1;
}

// Shared idle-motion descriptor for every avatar.
// Used by both the static preview (PlayerAvatar) and the in-game player
// renderer, so each animal moves identically in the Avatar Menu and in game.
// Motion is deliberately subtle: the animal must stay clearly readable.
//
// `unit` scales translation amplitude to the current render size.
export function motionFor(id: AvatarId, t: number, unit: number) {
  const u = unit;
  let dx = 0, dy = 0, rot = 0, sx = 1, flap = Math.sin(t * 2.2) * 0.5;
  switch (id) {
    case "pigeon":
      // gliding bird: slow rise/fall with a steady wing beat
      dy = Math.sin(t * 1.6) * 1.6 * u;
      rot = Math.sin(t * 1.6) * 0.05;
      flap = Math.sin(t * 3.2) * 0.9;
      break;
    case "sheep":
      // calm breathing with a soft hop
      dy = -Math.abs(Math.sin(t * 1.1)) * 1.2 * u;
      rot = Math.sin(t * 1.1) * 0.04;
      flap = Math.sin(t * 1.4) * 0.5;
      break;
    case "fly":
      // fast, jittery hovering
      dx = (Math.sin(t * 7.3) * 1.2 + Math.sin(t * 3.1) * 0.8) * u;
      dy = (Math.cos(t * 8.1) * 1.1 + Math.sin(t * 2.7) * 0.9) * u;
      rot = Math.sin(t * 5.5) * 0.05;
      flap = Math.sin(t * 22) * 0.7;
      break;
    case "locust":
      // hopping arcs
      dy = -Math.abs(Math.sin(t * 2.2)) * 2.4 * u;
      dx = Math.sin(t * 1.1) * 1.2 * u;
      rot = Math.sin(t * 2.2) * 0.08;
      flap = Math.sin(t * 16) * 0.6;
      break;
    case "mosquito":
      // erratic darting
      dx = (Math.sin(t * 5.7) * 1.6 + Math.sin(t * 1.3) * 1.2) * u;
      dy = (Math.cos(t * 6.3) * 1.4 + Math.sin(t * 0.9) * 1.0) * u;
      rot = Math.sin(t * 4.1) * 0.07;
      flap = Math.sin(t * 26) * 0.7;
      break;
    case "snake":
      // slithering wave
      dy = Math.sin(t * 2.0) * 1.6 * u;
      dx = Math.sin(t * 1.0) * 1.0 * u;
      rot = Math.sin(t * 2.0) * 0.09;
      flap = Math.sin(t * 2.0) * 0.35;
      break;
    case "wolf":
      // loping run
      dy = -Math.abs(Math.sin(t * 3.0)) * 1.4 * u;
      rot = Math.sin(t * 3.0) * 0.05;
      flap = Math.sin(t * 3.0) * 0.4;
      break;
    case "leopard":
      // faster, longer stride
      dy = -Math.abs(Math.sin(t * 3.8)) * 1.6 * u;
      dx = Math.sin(t * 1.9) * 1.0 * u;
      rot = Math.sin(t * 3.8) * 0.06;
      flap = Math.sin(t * 3.8) * 0.4;
      break;
    case "bear":
      // heavy, slow sway
      dx = Math.sin(t * 1.2) * 1.4 * u;
      dy = -Math.abs(Math.sin(t * 1.2)) * 1.0 * u;
      rot = Math.sin(t * 1.2) * 0.04;
      flap = Math.sin(t * 1.2) * 0.5;
      break;
    case "lion":
      // proud, powerful breathing
      dy = Math.sin(t * 1.4) * 1.2 * u;
      rot = Math.sin(t * 0.7) * 0.03;
      flap = Math.sin(t * 1.4) * 0.6;
      break;
  }
  return { dx, dy, rot, sx, flap };
}
