import { useEffect, useRef } from "react";
import type { AvatarId } from "@/lib/avatars";
import { drawAvatarBody } from "./avatarRender";

// Per-avatar idle motion in the preview. Returns translation, rotation
// and horizontal squash (for spinning coin) for the WHOLE silhouette.
// Intrinsic part-level motion (candle flame, book pages, tree sway,
// shell opening, fish tail) lives inside the drawers themselves and is
// driven by `t` passed to drawAvatarBody.
function motionFor(id: AvatarId, t: number, unit: number) {
  // unit ~ pixels-per-"point", scales motion to current preview size.
  const u = unit;
  let dx = 0, dy = 0, rot = 0, sx = 1, flap = Math.sin(t * 2.4) * 0.6;
  switch (id) {
    case "white_dove":
    case "black_dove":
      dy = Math.sin(t * 1.6) * 1.6 * u;
      flap = Math.sin(t * 2.4) * 0.7;
      break;
    case "seraph_dove": {
      // chaotic figure-eight + soft random drift
      dx = (Math.sin(t * 1.1) * 4 + Math.sin(t * 0.43) * 2) * u;
      dy = (Math.sin(t * 2.2) * 2.2 + Math.cos(t * 0.71) * 1.5) * u;
      flap = Math.sin(t * 3.1) * 0.9;
      break;
    }
    case "star":
      // irregular orbital drift (figure-eight + secondary wobble)
      dx = (Math.sin(t * 1.2) * 5 + Math.sin(t * 0.37) * 1.5) * u;
      dy = (Math.sin(t * 2.4) * 3 + Math.cos(t * 0.53) * 1.2) * u;
      rot = Math.sin(t * 0.6) * 0.15;
      break;
    case "anchor":
      // pendulum swing
      rot = Math.sin(t * 1.3) * 0.28;
      dy = Math.abs(Math.sin(t * 1.3)) * -0.6 * u;
      break;
    case "ichthys": {
      // continuous swim along a slow horizontal loop, rotate tangent
      const a = t * 0.9;
      dx = Math.cos(a) * 6 * u;
      dy = Math.sin(a * 2) * 2 * u;
      // tangent angle of the path (atan2 of derivatives) — smooth, no snap
      const vx = -Math.sin(a) * 6;
      const vy = Math.cos(a * 2) * 4;
      rot = Math.atan2(vy, vx) * 0.25; // damp a bit so it doesn't fully flip
      break;
    }
    case "feather":
      // quill writing — smooth stroke-like loops
      dx = (Math.sin(t * 1.7) * 5 + Math.sin(t * 0.6) * 1.5) * u;
      dy = (Math.cos(t * 1.2) * 3) * u;
      rot = Math.sin(t * 1.7) * 0.18 - 0.05;
      break;
    case "water_drop": {
      // infinite figure-eight (lemniscate)
      const a = t * 1.1;
      const denom = 1 + Math.sin(a) * Math.sin(a);
      dx = (Math.cos(a) / denom) * 6 * u;
      dy = (Math.sin(a) * Math.cos(a) / denom) * 5 * u;
      break;
    }
    case "sun": {
      // circular orbit
      const a = t * 0.9;
      dx = Math.cos(a) * 4 * u;
      dy = Math.sin(a) * 4 * u;
      break;
    }
    case "moon": {
      // left-right arc, mid arc slightly higher, ping-pong
      const p = Math.sin(t * 0.8);            // -1..1, ping-pong
      dx = p * 7 * u;
      dy = -(1 - p * p) * 3.5 * u;            // higher in the middle
      break;
    }
    case "rainbow":
      rot = Math.sin(t * 0.9) * 0.06;
      dy = Math.sin(t * 1.3) * 1.2 * u;
      break;
    case "golden_key": {
      // random-feeling unlocking gesture
      rot = Math.sin(t * 1.3) * 0.22 + Math.sin(t * 0.47) * 0.1;
      dx = Math.sin(t * 0.9) * 2 * u;
      dy = Math.cos(t * 1.7) * 1.2 * u;
      break;
    }
    case "crystal": {
      // coin spinning top — varying speed via integral of (1+sin)
      const angle = t * 4 + Math.sin(t * 0.4) * 1.2;
      // squash X to fake 3D spin
      sx = Math.cos(angle);
      // avoid full collapse to 0
      if (Math.abs(sx) < 0.08) sx = Math.sign(sx || 1) * 0.08;
      dy = Math.sin(t * 1.8) * 1.2 * u;
      break;
    }
    case "laurel":
      // halo gentle bounce
      dy = Math.sin(t * 2.1) * 2.2 * u;
      dx = Math.sin(t * 1.0) * 1.5 * u;
      break;
    case "celestial":
      // shell mostly stable; just a slow breathing float
      dy = Math.sin(t * 0.9) * 1.2 * u;
      break;
    case "crown": {
      // diagonal drift left → right
      const p = Math.sin(t * 0.7);
      dx = p * 5 * u;
      dy = p * 3 * u;
      break;
    }
    case "shield": {
      // diagonal drift right → left (mirrored)
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

// Static preview of the in-game player avatar. Uses the exact same canvas
// renderer as gameplay (drawAvatarBody), so what you see here is what you
// see in the game.

type Props = {
  id: AvatarId;
  size?: number;
  locked?: boolean;
  className?: string;
  title?: string;
};

export function PlayerAvatar({ id, size = 32, locked, className, title }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  // Render avatars at ~2x the original visual scale, in both menu and HUD.
  // The layout box (size) doubles so the larger silhouette has room.
  const boxSize = size * 2;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(boxSize * dpr);
    canvas.height = Math.round(boxSize * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fitScale = (boxSize / 60) * 0.95;
    const cx = boxSize / 2;
    const cy = boxSize / 2 + 6 * fitScale;
    const unit = boxSize / 64; // motion scales with preview size

    // Stagger phase so a grid of avatars doesn't move in lock-step.
    const phase = (id.charCodeAt(0) * 0.137 + id.length * 0.41) % 6.28;

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000 + phase;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, boxSize, boxSize);

      const m = motionFor(id, t, unit);
      const pulseAlpha = 0.94 + 0.06 * Math.sin(t * 1.8);

      ctx.save();
      if (locked) {
        ctx.globalAlpha = 0.22;
        ctx.filter = "grayscale(1)";
      } else {
        ctx.shadowColor = "rgba(255,235,180,0.55)";
        ctx.shadowBlur = 6 + 2 * Math.sin(t * 1.8);
      }

      // Apply silhouette-level motion via transform around (cx, cy).
      ctx.translate(cx + m.dx, cy + m.dy);
      if (m.rot) ctx.rotate(m.rot);
      if (m.sx !== 1) ctx.scale(m.sx, 1);

      drawAvatarBody(ctx, id, 0, 0, {
        alpha: pulseAlpha,
        flap: m.flap,
        scale: fitScale,
        glow: !locked,
        t,
      });

      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [id, boxSize, locked]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={title ?? id}
      className={className}
      style={{
        width: boxSize,
        height: boxSize,
        filter: locked ? "none" : "drop-shadow(0 0 5px rgba(255,220,160,0.55))",
      }}
    />
  );
}