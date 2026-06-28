import { useEffect, useRef } from "react";
import type { AvatarId } from "@/lib/avatars";
import { drawAvatarBody } from "./avatarRender";
import { motionFor } from "./avatarMotion";

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
      // Rainbow must not flicker: keep its alpha + glow steady.
      const isRainbow = id === "rainbow";
      const pulseAlpha = isRainbow ? 1 : 0.94 + 0.06 * Math.sin(t * 1.8);

      ctx.save();
      if (locked) {
        ctx.globalAlpha = 0.22;
        ctx.filter = "grayscale(1)";
      } else if (isRainbow) {
        // No pulsing shadow underneath the rainbow.
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
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