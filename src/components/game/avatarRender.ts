import type { AvatarId } from "@/lib/avatars";
import { assetUrl } from "@/lib/assetUrl";

import pigeonAsset from "@/assets/avatars/Pigeon.webp.asset.json";
import sheepAsset from "@/assets/avatars/Sheep.webp.asset.json";
import fishAsset from "@/assets/avatars/Fish.webp.asset.json";
import antAsset from "@/assets/avatars/Hormiga.webp.asset.json";
import hyraxAsset from "@/assets/avatars/Daman.webp.asset.json";
import goatAsset from "@/assets/avatars/Goat.webp.asset.json";
import camelAsset from "@/assets/avatars/Camello.webp.asset.json";
import roosterAsset from "@/assets/avatars/Gallo.webp.asset.json";
import flyAsset from "@/assets/avatars/Mosca.webp.asset.json";
import locustAsset from "@/assets/avatars/Langosta.webp.asset.json";
import mosquitoAsset from "@/assets/avatars/Mosquito.webp.asset.json";
import spiderAsset from "@/assets/avatars/Spider.webp.asset.json";
import ravenAsset from "@/assets/avatars/Cuervo.webp.asset.json";
import oxAsset from "@/assets/avatars/Buey.webp.asset.json";
import snakeAsset from "@/assets/avatars/Serpiente.webp.asset.json";
import falconAsset from "@/assets/avatars/Falcon.webp.asset.json";
import wolfAsset from "@/assets/avatars/Lobo.webp.asset.json";
import leopardAsset from "@/assets/avatars/Leopardo.webp.asset.json";
import bearAsset from "@/assets/avatars/Oso.webp.asset.json";
import lionAsset from "@/assets/avatars/Lion.webp.asset.json";

// Single source of truth for how each avatar is drawn — used by both the
// in-game player and the previews shown in the Avatar Menu / HUD.
// Every avatar is a hand-drawn animal PNG plus a small, animal-specific
// particle effect. The drawn footprint stays inside the previous ~44 x 32
// (s = 1) box so the gameplay hitbox is unchanged.

export interface DrawAvatarOpts {
  alpha?: number;
  flap?: number;      // -1..1 idle phase (wing beat / breathing)
  scale?: number;
  glow?: boolean;
  t?: number;         // continuous time in seconds
}

type Ctx = CanvasRenderingContext2D;

const SOURCES: Record<AvatarId, string> = {
  pigeon: pigeonAsset.url,
  sheep: sheepAsset.url,
  fish: fishAsset.url,
  ant: antAsset.url,
  hyrax: hyraxAsset.url,
  goat: goatAsset.url,
  camel: camelAsset.url,
  rooster: roosterAsset.url,
  fly: flyAsset.url,
  locust: locustAsset.url,
  mosquito: mosquitoAsset.url,
  spider: spiderAsset.url,
  raven: ravenAsset.url,
  ox: oxAsset.url,
  snake: snakeAsset.url,
  falcon: falconAsset.url,
  wolf: wolfAsset.url,
  leopard: leopardAsset.url,
  bear: bearAsset.url,
  lion: lionAsset.url,
};

const cache = new Map<AvatarId, HTMLImageElement>();

function image(id: AvatarId): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = cache.get(id);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = assetUrl(SOURCES[id]);
    cache.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Warm the image cache so the first frame already has artwork. */
export function preloadAvatars() {
  for (const id of Object.keys(SOURCES) as AvatarId[]) image(id);
}

// ---------- particle effects ----------

function puff(ctx: Ctx, x: number, y: number, r: number, color: string, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEffect(ctx: Ctx, id: AvatarId, s: number, t: number, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const back = -w * 0.55;
  switch (id) {
    case "pigeon": {
      // soft feather / wind streaks drifting behind
      for (let i = 0; i < 4; i++) {
        const p = ((t * 0.5 + i * 0.25) % 1);
        const x = back - p * 10 * s;
        const y = (i - 1.5) * 4 * s + Math.sin(t * 2 + i) * 2 * s;
        ctx.globalAlpha = 0.25 * (1 - p);
        ctx.strokeStyle = "rgba(255,245,210,0.9)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5 * s, y + 1 * s);
        ctx.stroke();
      }
      break;
    }
    case "sheep": {
      // soft warm motes floating upward
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.35 + i * 0.2) % 1);
        const x = back + (i * 5 - 6) * s;
        const y = h * 0.3 - p * 14 * s;
        puff(ctx, x, y, (1.2 - p * 0.6) * s, "rgba(255,240,220,0.8)", 0.3 * (1 - p));
      }
      break;
    }
    case "fly": {
      // buzz specks around the wings
      for (let i = 0; i < 6; i++) {
        const a = t * 6 + i * 1.05;
        puff(ctx, Math.cos(a) * 11 * s, -h * 0.25 + Math.sin(a * 1.7) * 4 * s, 0.7 * s, "rgba(180,255,230,0.9)", 0.28);
      }
      break;
    }
    case "locust": {
      // dry dust flecks kicked up below
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.9 + i * 0.2) % 1);
        puff(ctx, back + 2 * s - p * 10 * s, h * 0.42 - p * 4 * s, (1.1 - p) * s, "rgba(220,230,150,0.8)", 0.3 * (1 - p));
      }
      break;
    }
    case "mosquito": {
      // faint crimson droplets + buzz trail
      for (let i = 0; i < 4; i++) {
        const p = ((t * 1.1 + i * 0.25) % 1);
        puff(ctx, back - p * 8 * s, h * 0.2 + p * 8 * s, (1 - p * 0.5) * s, "rgba(255,120,120,0.9)", 0.28 * (1 - p));
      }
      break;
    }
    case "snake": {
      // low green shimmer trailing the coil
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.6 + i * 0.2) % 1);
        puff(ctx, back - p * 12 * s, h * 0.3 + Math.sin(t * 3 + i) * 2 * s, (1.2 - p) * s, "rgba(150,255,150,0.8)", 0.26 * (1 - p));
      }
      break;
    }
    case "wolf": {
      // cold mist puffs
      for (let i = 0; i < 4; i++) {
        const p = ((t * 0.45 + i * 0.25) % 1);
        puff(ctx, back - p * 12 * s, h * 0.15 - p * 3 * s, (1.4 + p * 2) * s, "rgba(180,200,225,0.55)", 0.22 * (1 - p));
      }
      break;
    }
    case "leopard": {
      // speed dashes behind
      ctx.strokeStyle = "rgba(255,220,150,0.85)";
      for (let i = 0; i < 4; i++) {
        const p = ((t * 1.4 + i * 0.25) % 1);
        const y = (i - 1.5) * 5 * s;
        ctx.globalAlpha = 0.22 * (1 - p);
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(back - p * 10 * s, y);
        ctx.lineTo(back - p * 10 * s - 7 * s, y);
        ctx.stroke();
      }
      break;
    }
    case "bear": {
      // heavy earth dust at the paws
      for (let i = 0; i < 4; i++) {
        const p = ((t * 0.7 + i * 0.25) % 1);
        puff(ctx, back + 4 * s - p * 12 * s, h * 0.45 - p * 3 * s, (1.6 + p * 2.4) * s, "rgba(190,150,110,0.6)", 0.24 * (1 - p));
      }
      break;
    }
    case "lion": {
      // golden embers rising around the mane
      for (let i = 0; i < 6; i++) {
        const p = ((t * 0.5 + i * 0.166) % 1);
        const x = back + 6 * s + Math.sin(t * 1.6 + i) * 5 * s;
        puff(ctx, x, h * 0.35 - p * 18 * s, (1.1 - p * 0.7) * s, "rgba(255,205,110,0.95)", 0.3 * (1 - p));
      }
      break;
    }
    case "fish": {
      // rising bubbles
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.45 + i * 0.2) % 1);
        const x = back + (i * 4 - 6) * s + Math.sin(t * 2 + i) * 2 * s;
        puff(ctx, x, h * 0.2 - p * 18 * s, (1.3 - p * 0.7) * s, "rgba(160,225,255,0.9)", 0.3 * (1 - p));
      }
      break;
    }
    case "ant": {
      // tiny grit specks at the feet
      for (let i = 0; i < 4; i++) {
        const p = ((t * 1.1 + i * 0.25) % 1);
        puff(ctx, back + 2 * s - p * 9 * s, h * 0.44 - p * 2 * s, (0.8 - p * 0.3) * s, "rgba(230,180,140,0.85)", 0.26 * (1 - p));
      }
      break;
    }
    case "hyrax": {
      // small rock dust puffs
      for (let i = 0; i < 4; i++) {
        const p = ((t * 0.8 + i * 0.25) % 1);
        puff(ctx, back + 3 * s - p * 10 * s, h * 0.42 - p * 3 * s, (1.1 + p) * s, "rgba(200,180,155,0.6)", 0.22 * (1 - p));
      }
      break;
    }
    case "goat": {
      // light pebbles kicked back
      for (let i = 0; i < 4; i++) {
        const p = ((t * 1.0 + i * 0.25) % 1);
        puff(ctx, back - p * 11 * s, h * 0.42 - Math.sin(p * Math.PI) * 5 * s, (0.9 - p * 0.3) * s, "rgba(215,195,160,0.8)", 0.26 * (1 - p));
      }
      break;
    }
    case "camel": {
      // warm desert sand haze
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.5 + i * 0.2) % 1);
        puff(ctx, back + 4 * s - p * 14 * s, h * 0.44 - p * 4 * s, (1.5 + p * 2) * s, "rgba(230,200,140,0.55)", 0.22 * (1 - p));
      }
      break;
    }
    case "rooster": {
      // bright dawn sparks around the crest
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.7 + i * 0.2) % 1);
        const x = back + 8 * s + Math.sin(t * 2.2 + i) * 4 * s;
        puff(ctx, x, -h * 0.2 - p * 12 * s, (1 - p * 0.6) * s, "rgba(255,230,150,0.9)", 0.28 * (1 - p));
      }
      break;
    }
    case "spider": {
      // thin silk thread trailing behind
      ctx.strokeStyle = "rgba(220,230,255,0.8)";
      ctx.lineWidth = 0.6 * s;
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.6 + i * 0.33) % 1);
        ctx.globalAlpha = 0.22 * (1 - p);
        ctx.beginPath();
        ctx.moveTo(back - p * 6 * s, h * 0.1 + Math.sin(t * 2 + i) * 2 * s);
        ctx.lineTo(back - p * 6 * s - 9 * s, h * 0.1 + Math.sin(t * 2 + i + 1) * 2 * s);
        ctx.stroke();
      }
      break;
    }
    case "raven": {
      // dark feathers with a violet sheen
      for (let i = 0; i < 4; i++) {
        const p = ((t * 0.6 + i * 0.25) % 1);
        const x = back - p * 12 * s;
        const y = (i - 1.5) * 4 * s + Math.sin(t * 2 + i) * 2 * s;
        ctx.globalAlpha = 0.24 * (1 - p);
        ctx.strokeStyle = "rgba(150,140,220,0.9)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6 * s, y + 1.5 * s);
        ctx.stroke();
      }
      break;
    }
    case "ox": {
      // heavy ground dust and breath steam
      for (let i = 0; i < 5; i++) {
        const p = ((t * 0.6 + i * 0.2) % 1);
        puff(ctx, back + 5 * s - p * 13 * s, h * 0.45 - p * 3 * s, (1.8 + p * 2.6) * s, "rgba(200,165,120,0.6)", 0.24 * (1 - p));
      }
      break;
    }
    case "falcon": {
      // sharp wind slipstream lines
      ctx.strokeStyle = "rgba(255,235,190,0.9)";
      for (let i = 0; i < 4; i++) {
        const p = ((t * 1.6 + i * 0.25) % 1);
        const y = (i - 1.5) * 5 * s;
        ctx.globalAlpha = 0.24 * (1 - p);
        ctx.lineWidth = 0.9 * s;
        ctx.beginPath();
        ctx.moveTo(back - p * 10 * s, y);
        ctx.lineTo(back - p * 10 * s - 9 * s, y - 0.5 * s);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// Per-avatar artwork width at s = 1 (keeps every animal visually balanced).
const BASE_W: Record<AvatarId, number> = {
  pigeon: 46, sheep: 42, fish: 42, ant: 40, hyrax: 42,
  goat: 44, camel: 46, rooster: 42, fly: 34, locust: 40,
  mosquito: 40, spider: 42, raven: 46, ox: 46,
  snake: 44, falcon: 48, wolf: 44, leopard: 46, bear: 44, lion: 46,
};

function applyPastelOverlay(ctx: Ctx, w: number, h: number, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = alpha * 0.34;
  const g = ctx.createRadialGradient(
    0, -h * 0.05, Math.min(w, h) * 0.12,
    0, -h * 0.05, Math.max(w, h) * 0.85,
  );
  g.addColorStop(0, "rgba(255, 252, 245, 0.95)");
  g.addColorStop(0.5, "rgba(255, 248, 238, 0.55)");
  g.addColorStop(1, "rgba(255, 244, 230, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.62, h * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawAvatarBody(
  ctx: Ctx,
  id: AvatarId,
  x: number,
  y: number,
  opts: DrawAvatarOpts = {},
) {
  const s = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  const flap = opts.flap ?? 0;
  const t = opts.t ?? 0;

  const img = image(id);
  const w = BASE_W[id] * s;
  const h = img ? (w * img.naturalHeight) / img.naturalWidth : w * 0.66;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  drawEffect(ctx, id, s, t, w, h);

  if (img) {
    // Subtle breathing / wing beat applied as a tiny non-uniform squash.
    const winged = id === "pigeon" || id === "fly" || id === "mosquito" || id === "locust"
      || id === "falcon" || id === "raven" || id === "rooster";
    const sy = 1 + flap * (winged ? 0.05 : 0.02);
    const sx = 1 - flap * (winged ? 0.02 : 0.008);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "rgba(255,240,210,0.6)";
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pastel wash: a soft, warm white layer over the animal so the vivid
  // avatar colors blend with the game's pastel palette without changing
  // the original artwork.
  applyPastelOverlay(ctx, w, h, alpha);

  ctx.restore();
}
