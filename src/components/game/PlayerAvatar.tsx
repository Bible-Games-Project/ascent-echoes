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

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Dove footprint at scale=1 is ~60 wide × 30 tall (with accessory above).
    // Fit into the requested size, leaving a little breathing room.
    const fitScale = (size / 60) * 0.95;
    const cx = size / 2;
    const cy = size / 2 + 6 * fitScale; // shift down so accessory has room

    if (locked) {
      ctx.globalAlpha = 0.22;
      ctx.filter = "grayscale(1)";
    }

    drawAvatarBody(ctx, id, cx, cy, { alpha: 1, flap: 0, scale: fitScale });

    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }, [id, size, locked]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={title ?? id}
      className={className}
      style={{
        width: size,
        height: size,
        filter: locked ? "none" : "drop-shadow(0 0 4px rgba(255,220,160,0.55))",
      }}
    />
  );
}