import type { AvatarId } from "@/lib/avatars";

// Single source of truth for how each avatar is drawn — used by both the
// in-game player (drawPlayer on the main canvas) and the static previews
// shown in the Avatar Menu, HUD, leaderboard, etc.
//
// Each avatar is its OWN distinct character. The only doves are
// white_dove (default) and black_dove (evolved variant). All other avatars
// are unique creatures / entities — no shared dove silhouette, no overlays
// on top of a dove. Every character fits roughly within a 44 x 32 (s=1)
// footprint so the gameplay hitbox stays unchanged.

export interface DrawAvatarOpts {
  alpha?: number;
  flap?: number;      // -1..1 phase used by winged characters / idle bob
  scale?: number;
  glow?: boolean;
  t?: number;         // continuous time in seconds (drives intrinsic motion)
}

type Ctx = CanvasRenderingContext2D;

function withGlow(ctx: Ctx, color: string, s: number, on: boolean, fn: () => void) {
  if (on) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * s;
    fn();
    ctx.restore();
  } else {
    fn();
  }
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ============ DOVE (white / black / seraph) ============

function drawDove(
  ctx: Ctx, x: number, y: number, s: number, flap: number,
  body: string, accent: string, halo: boolean, glow: boolean,
) {
  const wingLift = flap * 8 * s;
  const tipY = y - 4 * s - wingLift;
  const tipSpread = (30 - flap * 2) * s;
  const midY = y - 1 * s - wingLift * 0.4;

  withGlow(ctx, accent, s, glow, () => {
    ctx.fillStyle = body;
    // Left wing
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y - 1 * s);
    ctx.quadraticCurveTo(x - 14 * s, midY - 2 * s, x - tipSpread, tipY);
    ctx.quadraticCurveTo(x - 22 * s, y + 2 * s, x - 10 * s, y + 3 * s);
    ctx.quadraticCurveTo(x - 6 * s, y + 2 * s, x - 2 * s, y + 1 * s);
    ctx.closePath(); ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 1 * s);
    ctx.quadraticCurveTo(x + 14 * s, midY - 2 * s, x + tipSpread, tipY);
    ctx.quadraticCurveTo(x + 22 * s, y + 2 * s, x + 10 * s, y + 3 * s);
    ctx.quadraticCurveTo(x + 6 * s, y + 2 * s, x + 2 * s, y + 1 * s);
    ctx.closePath(); ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, y + 4 * s);
    ctx.lineTo(x + 4 * s, y + 4 * s);
    ctx.lineTo(x + 2 * s, y + 11 * s);
    ctx.lineTo(x - 2 * s, y + 11 * s);
    ctx.closePath(); ctx.fill();
    // Body
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(x, y - 5 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  });

  if (halo) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.beginPath();
    ctx.arc(x, y - 10 * s, 6 * s, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ============ Helpers ============

// Avatars are symbolic / spiritual entities — NO faces, NO eyes.
// Intentional no-op kept so existing call sites compile.
function eyes(_ctx: Ctx, _x: number, _y: number, _s: number, _spread = 0, _r = 0, _color = "") {
  /* no faces */
}

// Soft pastel halo behind a small character to anchor it in the dove's footprint.
function softGlow(ctx: Ctx, x: number, y: number, s: number, color: string, r = 14) {
  const grd = ctx.createRadialGradient(x, y, 1, x, y, r * s);
  grd.addColorStop(0, color);
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r * s, 0, Math.PI * 2);
  ctx.fill();
}

// ============ Unique characters ============

// Candle with a naturally flickering flame. Body is stable; only flame moves.
function drawCandle(ctx: Ctx, x: number, y: number, s: number, glow: boolean, t: number) {
  // candle body
  ctx.fillStyle = "#F0E2C4";
  ctx.fillRect(x - 4 * s, y - 2 * s, 8 * s, 14 * s);
  // soft shading
  ctx.fillStyle = "rgba(180,150,100,0.25)";
  ctx.fillRect(x + 2 * s, y - 2 * s, 2 * s, 14 * s);
  // melted top rim
  ctx.fillStyle = "#E6D6B0";
  ctx.beginPath();
  ctx.ellipse(x, y - 2 * s, 4 * s, 1.3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // wick
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(x - 0.5 * s, y - 6 * s, 1 * s, 4 * s);

  // flame — flickers via t (wave + sway + scale)
  const sway = Math.sin(t * 7.3) * 0.9 + Math.sin(t * 11.1) * 0.4;
  const scaleY = 1 + Math.sin(t * 9.7) * 0.08;
  const tipX = x + sway * s;
  softGlow(ctx, x, y - 9 * s, s, "rgba(255,210,128,0.45)", 14 + Math.sin(t * 5) * 1.5);
  withGlow(ctx, "#FFD27A", s, glow, () => {
    ctx.fillStyle = "#FFE3A0";
    ctx.beginPath();
    ctx.moveTo(tipX, y - (13 * scaleY) * s);
    ctx.quadraticCurveTo(x + 4 * s, y - 8 * s, x, y - 6 * s);
    ctx.quadraticCurveTo(x - 4 * s, y - 8 * s, tipX, y - (13 * scaleY) * s);
    ctx.fill();
    // inner flame
    ctx.fillStyle = "rgba(255,180,90,0.85)";
    ctx.beginPath();
    ctx.moveTo(x + sway * 0.5 * s, y - 10 * s);
    ctx.quadraticCurveTo(x + 2 * s, y - 8 * s, x, y - 6.5 * s);
    ctx.quadraticCurveTo(x - 2 * s, y - 8 * s, x + sway * 0.5 * s, y - 10 * s);
    ctx.fill();
  });
}

// Open book with gently fluttering pages.
function drawOpenBook(ctx: Ctx, x: number, y: number, s: number, t: number) {
  const flutter = Math.sin(t * 1.8) * 0.18;   // ±0.18 rad page tilt
  const lift = Math.sin(t * 2.2) * 0.6;
  // back covers (slight V)
  ctx.fillStyle = "#8C6F4A";
  ctx.beginPath();
  ctx.moveTo(x - 13 * s, y - 7 * s);
  ctx.lineTo(x, y - 5 * s);
  ctx.lineTo(x, y + 9 * s);
  ctx.lineTo(x - 13 * s, y + 7 * s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 13 * s, y - 7 * s);
  ctx.lineTo(x, y - 5 * s);
  ctx.lineTo(x, y + 9 * s);
  ctx.lineTo(x + 13 * s, y + 7 * s);
  ctx.closePath(); ctx.fill();
  // pages — left
  ctx.save();
  ctx.translate(x - 6.5 * s, y);
  ctx.transform(1, flutter * 0.4, 0, 1, 0, 0);
  ctx.fillStyle = "#F8EFD6";
  ctx.fillRect(-6 * s, -6 * s + lift * s, 12 * s, 12 * s);
  ctx.strokeStyle = "#C9B07A";
  ctx.lineWidth = 0.7 * s;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-4 * s, -3 * s + i * 2.2 * s);
    ctx.lineTo(4 * s, -3 * s + i * 2.2 * s);
    ctx.stroke();
  }
  ctx.restore();
  // pages — right
  ctx.save();
  ctx.translate(x + 6.5 * s, y);
  ctx.transform(1, -flutter * 0.4, 0, 1, 0, 0);
  ctx.fillStyle = "#F8EFD6";
  ctx.fillRect(-6 * s, -6 * s - lift * s, 12 * s, 12 * s);
  ctx.strokeStyle = "#C9B07A";
  ctx.lineWidth = 0.7 * s;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-4 * s, -3 * s + i * 2.2 * s);
    ctx.lineTo(4 * s, -3 * s + i * 2.2 * s);
    ctx.stroke();
  }
  ctx.restore();
  // spine
  ctx.fillStyle = "#6F5636";
  ctx.fillRect(x - 0.7 * s, y - 6 * s, 1.4 * s, 14 * s);
}

function drawStarChar(ctx: Ctx, x: number, y: number, s: number, glow: boolean, color = "#FFE89A") {
  softGlow(ctx, x, y, s, "rgba(255,232,154,0.45)", 18);
  withGlow(ctx, color, s, glow, () => {
    ctx.fillStyle = color;
    const r = 12 * s;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (-Math.PI / 2) + i * (Math.PI * 2 / 5);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath(); ctx.fill();
  });
}

// Symbolic tree — trunk sways left/right, foliage stays stable.
function drawTree(ctx: Ctx, x: number, y: number, s: number, t: number) {
  const sway = Math.sin(t * 1.1) * 0.14; // gentle looping trunk sway L↔R
  // ground hint
  ctx.fillStyle = "rgba(120,100,70,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 13 * s, 8 * s, 1.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // trunk (bent via quadratic with sway)
  ctx.strokeStyle = "#8A6A44";
  ctx.lineWidth = 2.4 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + 12 * s);
  ctx.quadraticCurveTo(x + sway * 20 * s, y + 2 * s, x + sway * 12 * s, y - 4 * s);
  ctx.stroke();
  ctx.lineCap = "butt";
  // foliage — soft pastel canopy, mostly stable
  const cx = x + sway * 12 * s;
  const cy = y - 6 * s;
  ctx.fillStyle = "#A8C887";
  ctx.beginPath(); ctx.arc(cx, cy, 9 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 6 * s, cy + 2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 6 * s, cy + 2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy - 5 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
  // softer highlight
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath(); ctx.arc(cx - 2 * s, cy - 4 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
}

// Slightly heavier anchor (thicker strokes, fuller hooks).
function drawAnchor(ctx: Ctx, x: number, y: number, s: number) {
  ctx.strokeStyle = "#9AAAB8";
  ctx.lineWidth = 2.8 * s;
  ctx.lineCap = "round";
  // ring
  ctx.beginPath(); ctx.arc(x, y - 10 * s, 3.4 * s, 0, Math.PI * 2); ctx.stroke();
  // shaft
  ctx.beginPath(); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x, y + 8 * s); ctx.stroke();
  // crossbar
  ctx.beginPath(); ctx.moveTo(x - 7 * s, y - 3 * s); ctx.lineTo(x + 7 * s, y - 3 * s); ctx.stroke();
  // hooks
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y + 4 * s);
  ctx.quadraticCurveTo(x, y + 15 * s, x + 10 * s, y + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y + 4 * s); ctx.lineTo(x - 12 * s, y + 1 * s); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 10 * s, y + 4 * s); ctx.lineTo(x + 12 * s, y + 1 * s); ctx.stroke();
  ctx.lineCap = "butt";
}

function drawFish(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = "#A8D8E0";
  // body
  ctx.beginPath();
  ctx.ellipse(x - 1 * s, y, 12 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(x + 9 * s, y);
  ctx.lineTo(x + 16 * s, y - 6 * s);
  ctx.lineTo(x + 16 * s, y + 6 * s);
  ctx.closePath(); ctx.fill();
  // top fin
  ctx.fillStyle = "#85BCC6";
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y - 5 * s);
  ctx.quadraticCurveTo(x, y - 11 * s, x + 4 * s, y - 5 * s);
  ctx.closePath(); ctx.fill();
  // belly fin
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y + 5 * s);
  ctx.quadraticCurveTo(x - 1 * s, y + 9 * s, x + 2 * s, y + 5 * s);
  ctx.closePath(); ctx.fill();
  // gill
  ctx.strokeStyle = "#85BCC6";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(x - 4 * s, y, 3 * s, -1.1, 1.1);
  ctx.stroke();
}

// Writing quill — feather with a sharpened nib.
function drawFeather(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  // spine
  ctx.strokeStyle = "#9C8A66";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(0, -14 * s); ctx.lineTo(0, 12 * s); ctx.stroke();
  // vanes
  ctx.fillStyle = "#F2EAD3";
  ctx.beginPath();
  ctx.moveTo(0, -14 * s);
  ctx.quadraticCurveTo(10 * s, -4 * s, 5 * s, 8 * s);
  ctx.quadraticCurveTo(2 * s, 4 * s, 0, 9 * s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -14 * s);
  ctx.quadraticCurveTo(-10 * s, -4 * s, -5 * s, 8 * s);
  ctx.quadraticCurveTo(-2 * s, 4 * s, 0, 9 * s);
  ctx.closePath(); ctx.fill();
  // barbs
  ctx.strokeStyle = "#D8CCA8";
  ctx.lineWidth = 0.6 * s;
  for (let i = -10; i <= 6; i += 2) {
    ctx.beginPath();
    ctx.moveTo(0, i * s);
    ctx.lineTo((i < 0 ? -1 : 1) * (6 - Math.abs(i) * 0.3) * s, i * s + 1 * s);
    ctx.stroke();
  }
  // sharpened nib
  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath();
  ctx.moveTo(-1.4 * s, 9 * s);
  ctx.lineTo(1.4 * s, 9 * s);
  ctx.lineTo(0, 15 * s);
  ctx.closePath(); ctx.fill();
  // ink tip
  ctx.fillStyle = "#2a4a78";
  ctx.beginPath(); ctx.arc(0, 14.5 * s, 0.9 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWaterDrop(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(168,216,232,0.4)", 16);
  withGlow(ctx, "#A8D8E8", s, glow, () => {
    const grd = ctx.createLinearGradient(x, y - 14 * s, x, y + 10 * s);
    grd.addColorStop(0, "#DCEFF7");
    grd.addColorStop(1, "#7FB9CC");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x, y - 14 * s);
    ctx.quadraticCurveTo(x + 10 * s, y, x, y + 11 * s);
    ctx.quadraticCurveTo(x - 10 * s, y, x, y - 14 * s);
    ctx.fill();
  });
  // highlight
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(x - 3 * s, y - 4 * s, 1.6 * s, 4 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSunChar(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(255,224,144,0.5)", 20);
  // rays
  ctx.strokeStyle = "#FFD27A";
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s);
    ctx.lineTo(x + Math.cos(a) * 15 * s, y + Math.sin(a) * 15 * s);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // disc
  withGlow(ctx, "#FFE090", s, glow, () => {
    ctx.fillStyle = "#FFE090";
    ctx.beginPath();
    ctx.arc(x, y, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Crescent moon only — no full-disc background.
function drawMoonChar(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  // Pure crescent: fill the outer disc, then PUNCH OUT the inner disc using
  // 'destination-out'. Two separate subpaths inside a single fill cannot be
  // relied on (the implicit line between arcs can collapse the shape), so we
  // composite instead. The whole operation runs on an offscreen layer via
  // save/restore + globalCompositeOperation so nothing else on the canvas is
  // affected.
  ctx.save();
  withGlow(ctx, "#E8E8F4", s, glow, () => {
    // Outer disc
    ctx.fillStyle = "#E8E8F4";
    ctx.beginPath();
    ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    // Punch the offset disc out → crescent
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x + 5 * s, y - 2 * s, 11 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawRainbow(ctx: Ctx, x: number, y: number, s: number) {
  const colors = ["#F5A8A8", "#F5C8A0", "#F5E0A0", "#B8E0B0", "#A8C8E8", "#C8A8E0"];
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < colors.length; i++) {
    ctx.strokeStyle = colors[i];
    ctx.beginPath();
    ctx.arc(x, y + 6 * s, (5 + i * 2) * s, Math.PI, 0);
    ctx.stroke();
  }
  // clouds
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x - 14 * s, y + 6 * s, 4 * s, 0, Math.PI * 2);
  ctx.arc(x - 10 * s, y + 6 * s, 3 * s, 0, Math.PI * 2);
  ctx.arc(x + 14 * s, y + 6 * s, 4 * s, 0, Math.PI * 2);
  ctx.arc(x + 10 * s, y + 6 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawKey(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  withGlow(ctx, "#FFE070", s, glow, () => {
    ctx.strokeStyle = "#D4A52A";
    ctx.fillStyle = "#FFE070";
    ctx.lineWidth = 1.4 * s;
    // bow (top loop)
    ctx.beginPath();
    ctx.arc(x, y - 7 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // inner hole
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y - 7 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    // shaft
    ctx.fillStyle = "#FFE070";
    ctx.fillRect(x - 1.4 * s, y - 2 * s, 2.8 * s, 14 * s);
    // teeth
    ctx.fillRect(x + 1.4 * s, y + 6 * s, 4 * s, 2 * s);
    ctx.fillRect(x + 1.4 * s, y + 10 * s, 3 * s, 2 * s);
  });
  // tiny face on the bow
  eyes(ctx, x, y - 8 * s, s, 1.4, 0.6, "#5a3a10");
}

// Drachma-style coin token. Width is squeezed by external spin transform.
function drawCoin(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(255,224,144,0.45)", 16);
  withGlow(ctx, "#FFE070", s, glow, () => {
    // outer disc
    const grd = ctx.createRadialGradient(x - 3 * s, y - 3 * s, 1, x, y, 12 * s);
    grd.addColorStop(0, "#FFF1B8");
    grd.addColorStop(1, "#D4A52A");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, Math.PI * 2); ctx.fill();
    // inner rim
    ctx.strokeStyle = "#B98A1F";
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, Math.PI * 2); ctx.stroke();
    // symbolic motif (sun-like cross)
    ctx.strokeStyle = "#9c6a10";
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(x - 5 * s, y); ctx.lineTo(x + 5 * s, y);
    ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y + 5 * s);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.4 * s, 0, Math.PI * 2); ctx.stroke();
  });
}

// Holy aureole — saint halo ring, viewed slightly tilted.
function drawAureole(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(255,232,160,0.55)", 22);
  // outer ring
  withGlow(ctx, "#FFE89A", s, glow, () => {
    ctx.strokeStyle = "#FFE89A";
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 13 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  // inner highlight ring
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.ellipse(x, y - 0.4 * s, 13 * s, 4.5 * s, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // faint rays radiating outward
  ctx.strokeStyle = "rgba(255,232,154,0.55)";
  ctx.lineWidth = 0.9 * s;
  ctx.lineCap = "round";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ix = x + Math.cos(a) * 13 * s;
    const iy = y + Math.sin(a) * 4.5 * s;
    const ox = x + Math.cos(a) * 16 * s;
    const oy = y + Math.sin(a) * 6 * s;
    ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(ox, oy); ctx.stroke();
  }
  ctx.lineCap = "butt";
}

// Biblical chalice — ornate goblet with a wide cup, stem, and footed base.
// Body itself is stable; the silhouette-level motion (gentle side-to-side
// float) is applied by PlayerAvatar so the shape stays clean and elegant.
function drawChalice(ctx: Ctx, x: number, y: number, s: number, glow: boolean, t: number) {
  // soft holy glow behind the cup
  softGlow(ctx, x, y - 4 * s, s, "rgba(255,232,160,0.45)", 18);

  withGlow(ctx, "#FFE89A", s, glow, () => {
    // Cup — wider at the rim, tapering to the stem.
    const cupGrd = ctx.createLinearGradient(x - 10 * s, y - 12 * s, x + 10 * s, y + 2 * s);
    cupGrd.addColorStop(0, "#FFE89A");
    cupGrd.addColorStop(0.5, "#E5B84A");
    cupGrd.addColorStop(1, "#B98A1F");
    ctx.fillStyle = cupGrd;
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y - 11 * s);
    ctx.lineTo(x + 10 * s, y - 11 * s);
    ctx.lineTo(x + 6 * s, y + 1 * s);
    ctx.quadraticCurveTo(x, y + 4 * s, x - 6 * s, y + 1 * s);
    ctx.closePath();
    ctx.fill();
  });

  // Rim band
  ctx.fillStyle = "#FFF3C0";
  ctx.fillRect(x - 10 * s, y - 12 * s, 20 * s, 2 * s);
  ctx.fillStyle = "#C9962A";
  ctx.fillRect(x - 10 * s, y - 10 * s, 20 * s, 1 * s);

  // Wine — gentle surface highlight
  ctx.fillStyle = "#7C1F2E";
  ctx.beginPath();
  ctx.ellipse(x, y - 11 * s, 9 * s, 1.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x - 3 * s, y - 11.4 * s, 3 * s, 0.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ornamental jewel on the cup
  dot(ctx, x, y - 5 * s, 1.6 * s, "#E94560");
  dot(ctx, x, y - 5 * s, 0.6 * s, "rgba(255,255,255,0.85)");

  // Stem
  ctx.fillStyle = "#C9962A";
  ctx.fillRect(x - 1.6 * s, y + 3 * s, 3.2 * s, 6 * s);
  // Knot / node on the stem
  ctx.fillStyle = "#FFE89A";
  ctx.beginPath();
  ctx.ellipse(x, y + 6 * s, 3 * s, 1.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Footed base
  ctx.fillStyle = "#C9962A";
  ctx.beginPath();
  ctx.ellipse(x, y + 11 * s, 9 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFE89A";
  ctx.beginPath();
  ctx.ellipse(x, y + 10 * s, 9 * s, 1.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle internal shimmer driven by t (kept very gentle).
  const shimmer = 0.4 + 0.15 * Math.sin(t * 1.2);
  ctx.fillStyle = `rgba(255,255,255,${shimmer * 0.35})`;
  ctx.fillRect(x - 8 * s, y - 9 * s, 1.4 * s, 8 * s);
}

function drawCrown(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  withGlow(ctx, "#FFE070", s, glow, () => {
    ctx.fillStyle = "#FFE070";
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y + 6 * s);
    ctx.lineTo(x - 10 * s, y - 6 * s);
    ctx.lineTo(x - 6 * s, y - 1 * s);
    ctx.lineTo(x - 2 * s, y - 9 * s);
    ctx.lineTo(x + 2 * s, y - 9 * s);
    ctx.lineTo(x + 6 * s, y - 1 * s);
    ctx.lineTo(x + 10 * s, y - 6 * s);
    ctx.lineTo(x + 12 * s, y + 6 * s);
    ctx.closePath(); ctx.fill();
  });
  // band
  ctx.fillStyle = "#D4A52A";
  ctx.fillRect(x - 12 * s, y + 4 * s, 24 * s, 3 * s);
  // jewels
  dot(ctx, x - 8 * s, y + 5.5 * s, 1.4 * s, "#E94560");
  dot(ctx, x, y + 5.5 * s, 1.6 * s, "#7BB7FF");
  dot(ctx, x + 8 * s, y + 5.5 * s, 1.4 * s, "#7CC8A8");
  // peak gems
  dot(ctx, x - 10 * s, y - 7 * s, 1.2 * s, "#fff");
  dot(ctx, x, y - 10 * s, 1.4 * s, "#fff");
  dot(ctx, x + 10 * s, y - 7 * s, 1.2 * s, "#fff");
  // face on band
  eyes(ctx, x - 3 * s, y + 9 * s, s, 1.6, 0.7, "#5a3a10");
  eyes(ctx, x + 3 * s, y + 9 * s, s, 0, 0.7, "#5a3a10");
}

function drawShield(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  withGlow(ctx, "#D8C8A8", s, glow, () => {
    // shield body
    ctx.fillStyle = "#D8C8A8";
    ctx.beginPath();
    ctx.moveTo(x, y - 13 * s);
    ctx.lineTo(x + 11 * s, y - 8 * s);
    ctx.lineTo(x + 11 * s, y + 2 * s);
    ctx.quadraticCurveTo(x, y + 14 * s, x - 11 * s, y + 2 * s);
    ctx.lineTo(x - 11 * s, y - 8 * s);
    ctx.closePath(); ctx.fill();
  });
  // rim
  ctx.strokeStyle = "#9C8A66";
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - 13 * s);
  ctx.lineTo(x + 11 * s, y - 8 * s);
  ctx.lineTo(x + 11 * s, y + 2 * s);
  ctx.quadraticCurveTo(x, y + 14 * s, x - 11 * s, y + 2 * s);
  ctx.lineTo(x - 11 * s, y - 8 * s);
  ctx.closePath();
  ctx.stroke();
  // cross emblem
  ctx.fillStyle = "#9C3B4A";
  ctx.fillRect(x - 1.6 * s, y - 8 * s, 3.2 * s, 14 * s);
  ctx.fillRect(x - 6 * s, y - 3.6 * s, 12 * s, 3.2 * s);
  // eyes on shield (small, low)
  eyes(ctx, x, y + 6 * s, s, 2, 0.7, "#5a4220");
}

// ============ Dispatcher ============

export function drawAvatarBody(
  ctx: Ctx,
  id: AvatarId,
  x: number,
  y: number,
  opts: DrawAvatarOpts = {},
): void {
  const { alpha = 1, flap = 0, scale = 1, glow = false } = opts;
  const s = scale;
  ctx.save();
  ctx.globalAlpha *= alpha;

  switch (id) {
    case "white_dove":  drawDove(ctx, x, y, s, flap, "#FFFCF0", "#FFF5C8", false, glow); break;
    case "black_dove":  drawDove(ctx, x, y, s, flap, "#2E2620", "#FFE5A0", false, glow); break;
    case "seraph_dove": drawDove(ctx, x, y, s, flap, "#FFE89C", "#FFF0B8", true,  glow); break;
    case "oil_lamp":     drawCandle(ctx, x, y, s, glow, opts.t ?? 0); break;
    case "scroll":       drawOpenBook(ctx, x, y, s, opts.t ?? 0); break;
    case "star":         drawStarChar(ctx, x, y, s, glow); break;
    case "olive_branch": drawTree(ctx, x, y, s, opts.t ?? 0); break;
    case "anchor":       drawAnchor(ctx, x, y, s); break;
    case "ichthys":      drawFish(ctx, x, y, s); break;
    case "feather":      drawFeather(ctx, x, y, s); break;
    case "water_drop":   drawWaterDrop(ctx, x, y, s, glow); break;
    case "sun":          drawSunChar(ctx, x, y, s, glow); break;
    case "moon":         drawMoonChar(ctx, x, y, s, glow); break;
    case "rainbow":      drawRainbow(ctx, x, y, s); break;
    case "golden_key":   drawKey(ctx, x, y, s, glow); break;
    case "crystal":      drawCoin(ctx, x, y, s, glow); break;
    case "laurel":       drawAureole(ctx, x, y, s, glow); break;
    case "celestial":    drawChalice(ctx, x, y, s, glow, opts.t ?? 0); break;
    case "crown":        drawCrown(ctx, x, y, s, glow); break;
    case "shield":       drawShield(ctx, x, y, s, glow); break;
    default:             drawDove(ctx, x, y, s, flap, "#FFFCF0", "#FFF5C8", false, glow);
  }

  ctx.restore();
}