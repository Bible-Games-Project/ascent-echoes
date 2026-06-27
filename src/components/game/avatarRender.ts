import type { AvatarId } from "@/lib/avatars";

// Single source of truth for how each avatar is drawn — used by both the
// in-game player (drawPlayer on the main canvas) and the static previews
// shown in the Avatar Menu, HUD, leaderboard, etc.
//
// Each avatar is a "skin" applied to the same dove silhouette (preserving
// gameplay hitbox / animation) plus an optional accessory glyph rendered on
// or near the body. Doves vary by tint; non-dove avatars wear an accessory.

export interface AvatarSkin {
  body: "ivory" | "dark" | "gold";
  accent: string;       // accessory tint
  accessory:
    | "none"
    | "halo"
    | "lamp"
    | "scroll"
    | "star"
    | "leaf"
    | "anchor"
    | "fish"
    | "feather"
    | "drop"
    | "sun"
    | "moon"
    | "rainbow"
    | "key"
    | "crystal"
    | "laurel"
    | "sparkle"
    | "crown"
    | "shield";
}

export const AVATAR_SKINS: Record<AvatarId, AvatarSkin> = {
  white_dove:   { body: "ivory", accent: "#FFF5C8", accessory: "none" },
  black_dove:   { body: "dark",  accent: "#FFE5A0", accessory: "none" },
  seraph_dove:  { body: "gold",  accent: "#FFE08C", accessory: "halo" },
  oil_lamp:     { body: "ivory", accent: "#FFC870", accessory: "lamp" },
  scroll:       { body: "ivory", accent: "#E8D9B0", accessory: "scroll" },
  star:         { body: "ivory", accent: "#FFE6A8", accessory: "star" },
  olive_branch: { body: "ivory", accent: "#C8E0A0", accessory: "leaf" },
  anchor:       { body: "ivory", accent: "#B8C8D8", accessory: "anchor" },
  ichthys:      { body: "ivory", accent: "#A8D8E0", accessory: "fish" },
  feather:      { body: "ivory", accent: "#F0E8D8", accessory: "feather" },
  water_drop:   { body: "ivory", accent: "#B8D8E8", accessory: "drop" },
  sun:          { body: "ivory", accent: "#FFE090", accessory: "sun" },
  moon:         { body: "ivory", accent: "#D8D8E8", accessory: "moon" },
  rainbow:      { body: "ivory", accent: "#FFC8C8", accessory: "rainbow" },
  golden_key:   { body: "ivory", accent: "#FFE070", accessory: "key" },
  crystal:      { body: "ivory", accent: "#C8D8FF", accessory: "crystal" },
  laurel:       { body: "ivory", accent: "#C8E0A0", accessory: "laurel" },
  celestial:    { body: "gold",  accent: "#FFF0C0", accessory: "sparkle" },
  crown:        { body: "ivory", accent: "#FFE070", accessory: "crown" },
  shield:       { body: "ivory", accent: "#D8C8A8", accessory: "shield" },
};

export interface DrawAvatarOpts {
  alpha?: number;     // 0..1 overall opacity
  flap?: number;      // -1..1 wing flap phase
  scale?: number;     // visual scale (1 = gameplay default ~60x30 footprint)
  glow?: boolean;     // soft accent glow on the accessory
}

function bodyColor(skin: AvatarSkin, alpha: number, gold: boolean): string {
  if (gold || skin.body === "gold") return `rgba(255, 232, 150, ${alpha})`;
  if (skin.body === "dark") return `rgba(48, 38, 30, ${alpha})`;
  return `rgba(255, 252, 240, ${alpha})`;
}

/**
 * Draws the avatar centered at (x, y) on the provided 2D canvas context.
 * Reproduces the same dove silhouette used in gameplay so menu and HUD
 * previews are visually identical to the in-game character.
 */
export function drawAvatarBody(
  ctx: CanvasRenderingContext2D,
  id: AvatarId,
  x: number,
  y: number,
  opts: DrawAvatarOpts = {},
): void {
  const { alpha = 1, flap = 0, scale = 1, glow = false } = opts;
  const skin = AVATAR_SKINS[id];
  const s = scale;

  const wingLift = flap * 8 * s;
  const tipY = y - 4 * s - wingLift;
  const tipSpread = (30 - flap * 2) * s;
  const midY = y - 1 * s - wingLift * 0.4;
  const body = bodyColor(skin, alpha, false);

  ctx.save();
  ctx.fillStyle = body;

  // Left wing
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y - 1 * s);
  ctx.quadraticCurveTo(x - 14 * s, midY - 2 * s, x - tipSpread, tipY);
  ctx.quadraticCurveTo(x - 22 * s, y + 2 * s, x - 10 * s, y + 3 * s);
  ctx.quadraticCurveTo(x - 6 * s, y + 2 * s, x - 2 * s, y + 1 * s);
  ctx.closePath();
  ctx.fill();

  // Right wing (mirrored)
  ctx.beginPath();
  ctx.moveTo(x + 2 * s, y - 1 * s);
  ctx.quadraticCurveTo(x + 14 * s, midY - 2 * s, x + tipSpread, tipY);
  ctx.quadraticCurveTo(x + 22 * s, y + 2 * s, x + 10 * s, y + 3 * s);
  ctx.quadraticCurveTo(x + 6 * s, y + 2 * s, x + 2 * s, y + 1 * s);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y + 4 * s);
  ctx.lineTo(x + 4 * s, y + 4 * s);
  ctx.lineTo(x + 2 * s, y + 11 * s);
  ctx.lineTo(x - 2 * s, y + 11 * s);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(x, y + 1 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(x, y - 5 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  // ===== Accessory layer =====
  ctx.fillStyle = skin.accent;
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = Math.max(1, 1.4 * s);
  if (glow) {
    ctx.shadowColor = skin.accent;
    ctx.shadowBlur = 6 * s;
  }

  const aboveY = y - 12 * s;
  switch (skin.accessory) {
    case "none": break;
    case "halo": {
      ctx.beginPath();
      ctx.arc(x, y - 9 * s, 6 * s, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, 1.6 * s);
      ctx.stroke();
      break;
    }
    case "lamp": {
      ctx.beginPath();
      ctx.ellipse(x, aboveY, 4 * s, 2.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // flame
      ctx.beginPath();
      ctx.moveTo(x, aboveY - 2 * s);
      ctx.quadraticCurveTo(x + 1.5 * s, aboveY - 5 * s, x, aboveY - 8 * s);
      ctx.quadraticCurveTo(x - 1.5 * s, aboveY - 5 * s, x, aboveY - 2 * s);
      ctx.fill();
      break;
    }
    case "scroll": {
      ctx.fillRect(x - 5 * s, aboveY - 2 * s, 10 * s, 4 * s);
      ctx.beginPath();
      ctx.arc(x - 5 * s, aboveY, 2 * s, 0, Math.PI * 2);
      ctx.arc(x + 5 * s, aboveY, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "star":
    case "sparkle": {
      const r = 4 * s;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (-Math.PI / 2) + i * (Math.PI * 2 / 5);
        const a2 = a + Math.PI / 5;
        ctx.lineTo(x + Math.cos(a) * r, aboveY + Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a2) * r * 0.45, aboveY + Math.sin(a2) * r * 0.45);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "leaf":
    case "laurel": {
      ctx.beginPath();
      ctx.ellipse(x - 4 * s, aboveY, 3 * s, 1.6 * s, -0.5, 0, Math.PI * 2);
      ctx.ellipse(x + 4 * s, aboveY, 3 * s, 1.6 * s, 0.5, 0, Math.PI * 2);
      ctx.fill();
      if (skin.accessory === "laurel") {
        ctx.beginPath();
        ctx.arc(x, aboveY + 1 * s, 6 * s, Math.PI * 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
      break;
    }
    case "anchor": {
      ctx.beginPath();
      ctx.arc(x, aboveY - 3 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, aboveY - 1 * s);
      ctx.lineTo(x, aboveY + 3 * s);
      ctx.moveTo(x - 3 * s, aboveY);
      ctx.lineTo(x + 3 * s, aboveY);
      ctx.moveTo(x - 4 * s, aboveY + 2 * s);
      ctx.quadraticCurveTo(x, aboveY + 5 * s, x + 4 * s, aboveY + 2 * s);
      ctx.stroke();
      break;
    }
    case "fish": {
      ctx.beginPath();
      ctx.ellipse(x, aboveY, 5 * s, 2.4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 5 * s, aboveY);
      ctx.lineTo(x + 8 * s, aboveY - 2 * s);
      ctx.lineTo(x + 8 * s, aboveY + 2 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "feather": {
      ctx.beginPath();
      ctx.ellipse(x, aboveY, 2 * s, 5 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "drop": {
      ctx.beginPath();
      ctx.moveTo(x, aboveY - 4 * s);
      ctx.quadraticCurveTo(x + 3 * s, aboveY, x, aboveY + 3 * s);
      ctx.quadraticCurveTo(x - 3 * s, aboveY, x, aboveY - 4 * s);
      ctx.fill();
      break;
    }
    case "sun": {
      ctx.beginPath();
      ctx.arc(x, aboveY, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 4 * s, aboveY + Math.sin(a) * 4 * s);
        ctx.lineTo(x + Math.cos(a) * 6 * s, aboveY + Math.sin(a) * 6 * s);
        ctx.stroke();
      }
      break;
    }
    case "moon": {
      ctx.beginPath();
      ctx.arc(x, aboveY, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x + 1.5 * s, aboveY - 0.5 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "rainbow": {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, aboveY + 3 * s, (5 + i * 1.4) * s, Math.PI, 0);
        ctx.stroke();
      }
      break;
    }
    case "key": {
      ctx.beginPath();
      ctx.arc(x - 3 * s, aboveY, 2 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 1 * s, aboveY);
      ctx.lineTo(x + 5 * s, aboveY);
      ctx.moveTo(x + 3 * s, aboveY);
      ctx.lineTo(x + 3 * s, aboveY + 2 * s);
      ctx.moveTo(x + 5 * s, aboveY);
      ctx.lineTo(x + 5 * s, aboveY + 1.5 * s);
      ctx.stroke();
      break;
    }
    case "crystal": {
      ctx.beginPath();
      ctx.moveTo(x, aboveY - 4 * s);
      ctx.lineTo(x + 3 * s, aboveY);
      ctx.lineTo(x, aboveY + 4 * s);
      ctx.lineTo(x - 3 * s, aboveY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "crown": {
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, aboveY + 2 * s);
      ctx.lineTo(x - 3 * s, aboveY - 3 * s);
      ctx.lineTo(x - 1 * s, aboveY);
      ctx.lineTo(x, aboveY - 4 * s);
      ctx.lineTo(x + 1 * s, aboveY);
      ctx.lineTo(x + 3 * s, aboveY - 3 * s);
      ctx.lineTo(x + 5 * s, aboveY + 2 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "shield": {
      ctx.beginPath();
      ctx.moveTo(x, aboveY - 4 * s);
      ctx.lineTo(x + 4 * s, aboveY - 2 * s);
      ctx.lineTo(x + 4 * s, aboveY + 1 * s);
      ctx.quadraticCurveTo(x, aboveY + 5 * s, x - 4 * s, aboveY + 1 * s);
      ctx.lineTo(x - 4 * s, aboveY - 2 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}