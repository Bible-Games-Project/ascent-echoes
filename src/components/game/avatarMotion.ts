import type { AvatarId } from "@/lib/avatars";

// Shared idle-motion descriptor for every avatar.
// Used by both the static preview (PlayerAvatar) and the in-game player
// renderer (Game.tsx drawPlayer), so the silhouette moves identically
// whether shown in the Avatar Menu or flying during gameplay.
//
// `unit` scales translation amplitude to the current render size.
export function motionFor(id: AvatarId, t: number, unit: number) {
  const u = unit;
  let dx = 0, dy = 0, rot = 0, sx = 1, flap = Math.sin(t * 2.4) * 0.6;
  switch (id) {
    case "white_dove":
    case "black_dove":
      dy = Math.sin(t * 1.6) * 1.6 * u;
      flap = Math.sin(t * 2.4) * 0.7;
      break;
    case "seraph_dove":
      dx = (Math.sin(t * 1.1) * 4 + Math.sin(t * 0.43) * 2) * u;
      dy = (Math.sin(t * 2.2) * 2.2 + Math.cos(t * 0.71) * 1.5) * u;
      flap = Math.sin(t * 3.1) * 0.9;
      break;
    case "star":
      dx = (Math.sin(t * 1.2) * 5 + Math.sin(t * 0.37) * 1.5) * u;
      dy = (Math.sin(t * 2.4) * 3 + Math.cos(t * 0.53) * 1.2) * u;
      rot = Math.sin(t * 0.6) * 0.15;
      break;
    case "anchor":
      rot = Math.sin(t * 1.3) * 0.28;
      dy = Math.abs(Math.sin(t * 1.3)) * -0.6 * u;
      break;
    case "ichthys": {
      // Smooth continuous circular path with natural tangent tilt.
      const a = t * 1.1;
      const R = 6 * u;
      dx = Math.cos(a) * R;
      dy = Math.sin(a) * R;
      // Rotate along the tangent so the fish naturally faces its direction of travel.
      rot = a + Math.PI / 2;
      break;
    }
    case "feather":
      dx = (Math.sin(t * 1.7) * 5 + Math.sin(t * 0.6) * 1.5) * u;
      dy = (Math.cos(t * 1.2) * 3) * u;
      rot = Math.sin(t * 1.7) * 0.18 - 0.05;
      break;
    case "water_drop": {
      const a = t * 1.1;
      const denom = 1 + Math.sin(a) * Math.sin(a);
      dx = (Math.cos(a) / denom) * 6 * u;
      dy = (Math.sin(a) * Math.cos(a) / denom) * 5 * u;
      break;
    }
    case "sun": {
      const a = t * 0.9;
      dx = Math.cos(a) * 4 * u;
      dy = Math.sin(a) * 4 * u;
      break;
    }
    case "moon": {
      // semicircular ping-pong: left ↔ right, slightly higher in the middle
      const p = Math.sin(t * 0.8);
      dx = p * 7 * u;
      dy = -(1 - p * p) * 3.5 * u;
      break;
    }
    case "rainbow":
      rot = Math.sin(t * 0.9) * 0.06;
      dy = Math.sin(t * 1.3) * 1.2 * u;
      break;
    case "golden_key":
      rot = Math.sin(t * 1.3) * 0.22 + Math.sin(t * 0.47) * 0.1;
      dx = Math.sin(t * 0.9) * 2 * u;
      dy = Math.cos(t * 1.7) * 1.2 * u;
      break;
    case "crystal": {
      const angle = t * 4 + Math.sin(t * 0.4) * 1.2;
      sx = Math.cos(angle);
      if (Math.abs(sx) < 0.08) sx = Math.sign(sx || 1) * 0.08;
      dy = Math.sin(t * 1.8) * 1.2 * u;
      break;
    }
    case "laurel":
      dy = Math.sin(t * 2.1) * 2.2 * u;
      dx = Math.sin(t * 1.0) * 1.5 * u;
      break;
    case "celestial":
      // chalice — gentle side-to-side float
      dx = Math.sin(t * 1.2) * 2.6 * u;
      dy = Math.sin(t * 0.9) * 1.0 * u;
      break;
    case "crown": {
      const p = Math.sin(t * 0.7);
      dx = p * 5 * u;
      dy = p * 3 * u;
      break;
    }
    case "shield": {
      const p = Math.sin(t * 0.7);
      dx = -p * 5 * u;
      dy = p * 3 * u;
      break;
    }
    case "oil_lamp":      // candle — body stable, flame self-animates
    case "scroll":        // book — pages flutter internally
    case "olive_branch":  // tree — trunk sway internal
    default:
      dy = Math.sin(t * 1.4) * 1 * u;
      break;
  }
  return { dx, dy, rot, sx, flap };
}