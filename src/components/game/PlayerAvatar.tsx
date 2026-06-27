import { useEffect, useRef } from "react";
import type { AvatarId } from "@/lib/avatars";
import { drawAvatarBody } from "./avatarRender";

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

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, boxSize, boxSize);

      // Subtle idle motion: gentle vertical float + breathing flap.
      const float = Math.sin(t * 1.6) * 1.6 * (boxSize / 64);
      const flap = Math.sin(t * 2.4) * 0.6;
      const pulseAlpha = 0.92 + 0.08 * Math.sin(t * 1.8);

      ctx.save();
      if (locked) {
        ctx.globalAlpha = 0.22;
        ctx.filter = "grayscale(1)";
      } else {
        ctx.shadowColor = "rgba(255,235,180,0.55)";
        ctx.shadowBlur = 6 + 2 * Math.sin(t * 1.8);
      }

      drawAvatarBody(ctx, id, cx, cy + float, {
        alpha: pulseAlpha,
        flap,
        scale: fitScale,
        glow: !locked,
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