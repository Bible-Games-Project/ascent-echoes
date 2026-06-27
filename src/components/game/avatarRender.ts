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

// Tiny eyes used on most character avatars to read as "alive".
function eyes(ctx: Ctx, x: number, y: number, s: number, spread = 2.2, r = 0.9, color = "#222") {
  dot(ctx, x - spread * s, y, r * s, color);
  dot(ctx, x + spread * s, y, r * s, color);
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

function drawOilLamp(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y - 8 * s, s, "rgba(255,200,112,0.35)", 16);
  // flame
  withGlow(ctx, "#FFD27A", s, glow, () => {
    ctx.fillStyle = "#FFE3A0";
    ctx.beginPath();
    ctx.moveTo(x, y - 14 * s);
    ctx.quadraticCurveTo(x + 4 * s, y - 8 * s, x, y - 4 * s);
    ctx.quadraticCurveTo(x - 4 * s, y - 8 * s, x, y - 14 * s);
    ctx.fill();
  });
  // wick
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(x - 0.6 * s, y - 4 * s, 1.2 * s, 2 * s);
  // lamp body (terracotta)
  ctx.fillStyle = "#C99A6B";
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * s, 11 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // spout
  ctx.beginPath();
  ctx.moveTo(x + 8 * s, y + 1 * s);
  ctx.lineTo(x + 14 * s, y + 3 * s);
  ctx.lineTo(x + 8 * s, y + 5 * s);
  ctx.closePath(); ctx.fill();
  // handle
  ctx.strokeStyle = "#A8794E";
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.arc(x - 9 * s, y + 3 * s, 3 * s, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x - 3 * s, y + 1 * s, 3 * s, 1 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, x, y + 3 * s, s, 2.4, 0.8, "#3a2a1a");
}

function drawScroll(ctx: Ctx, x: number, y: number, s: number) {
  // parchment body
  ctx.fillStyle = "#F4E6BE";
  ctx.fillRect(x - 10 * s, y - 8 * s, 20 * s, 16 * s);
  // lines of text
  ctx.strokeStyle = "#B59A66";
  ctx.lineWidth = 0.8 * s;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, y - 5 * s + i * 3 * s);
    ctx.lineTo(x + 7 * s, y - 5 * s + i * 3 * s);
    ctx.stroke();
  }
  // rolled ends
  ctx.fillStyle = "#C9A66B";
  ctx.beginPath();
  ctx.ellipse(x - 10 * s, y, 3 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.ellipse(x + 10 * s, y, 3 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
  // little face on the parchment
  eyes(ctx, x, y, s, 2.4, 0.9, "#5a4220");
  ctx.strokeStyle = "#5a4220";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(x, y + 3 * s, 1.6 * s, 0, Math.PI);
  ctx.stroke();
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
  // face
  eyes(ctx, x, y - 1 * s, s, 2.4, 1, "#7a5a20");
  ctx.strokeStyle = "#7a5a20";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.arc(x, y + 2 * s, 1.6 * s, 0, Math.PI);
  ctx.stroke();
}

function drawOliveBranch(ctx: Ctx, x: number, y: number, s: number) {
  // stem
  ctx.strokeStyle = "#8A7A4A";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y + 6 * s);
  ctx.quadraticCurveTo(x, y - 2 * s, x + 14 * s, y - 6 * s);
  ctx.stroke();
  // leaves
  ctx.fillStyle = "#A8C887";
  const leafPts: Array<[number, number, number]> = [
    [-10, 2, -0.6], [-4, -2, -0.4], [2, -5, -0.3], [8, -8, -0.2],
    [-7, 7, 0.8], [-1, 4, 0.6], [5, 0, 0.4], [11, -3, 0.3],
  ];
  for (const [dx, dy, rot] of leafPts) {
    ctx.save();
    ctx.translate(x + dx * s, y + dy * s);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4 * s, 1.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // olives
  dot(ctx, x - 2 * s, y + 1 * s, 1.6 * s, "#6B7E3D");
  dot(ctx, x + 4 * s, y - 2 * s, 1.6 * s, "#6B7E3D");
}

function drawAnchor(ctx: Ctx, x: number, y: number, s: number) {
  ctx.strokeStyle = "#A8B8C8";
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  // ring
  ctx.beginPath(); ctx.arc(x, y - 10 * s, 3 * s, 0, Math.PI * 2); ctx.stroke();
  // shaft
  ctx.beginPath(); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x, y + 8 * s); ctx.stroke();
  // crossbar
  ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 3 * s); ctx.lineTo(x + 6 * s, y - 3 * s); ctx.stroke();
  // hooks
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y + 4 * s);
  ctx.quadraticCurveTo(x, y + 14 * s, x + 9 * s, y + 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y + 4 * s); ctx.lineTo(x - 11 * s, y + 1 * s); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 9 * s, y + 4 * s); ctx.lineTo(x + 11 * s, y + 1 * s); ctx.stroke();
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
  // eye
  dot(ctx, x - 7 * s, y - 1 * s, 1.4 * s, "#fff");
  dot(ctx, x - 7 * s, y - 1 * s, 0.8 * s, "#222");
  // gill
  ctx.strokeStyle = "#85BCC6";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(x - 4 * s, y, 3 * s, -1.1, 1.1);
  ctx.stroke();
}

function drawFeather(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.4);
  // spine
  ctx.strokeStyle = "#9C8A66";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(0, -14 * s); ctx.lineTo(0, 14 * s); ctx.stroke();
  // vanes
  ctx.fillStyle = "#F2EAD3";
  ctx.beginPath();
  ctx.moveTo(0, -14 * s);
  ctx.quadraticCurveTo(10 * s, -4 * s, 6 * s, 10 * s);
  ctx.quadraticCurveTo(2 * s, 6 * s, 0, 12 * s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -14 * s);
  ctx.quadraticCurveTo(-10 * s, -4 * s, -6 * s, 10 * s);
  ctx.quadraticCurveTo(-2 * s, 6 * s, 0, 12 * s);
  ctx.closePath(); ctx.fill();
  // barbs
  ctx.strokeStyle = "#D8CCA8";
  ctx.lineWidth = 0.6 * s;
  for (let i = -10; i <= 8; i += 2) {
    ctx.beginPath();
    ctx.moveTo(0, i * s);
    ctx.lineTo((i < 0 ? -1 : 1) * (6 - Math.abs(i) * 0.3) * s, i * s + 1 * s);
    ctx.stroke();
  }
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
  // face
  eyes(ctx, x, y + 1 * s, s, 2.2, 0.9, "#1f4a55");
  ctx.strokeStyle = "#1f4a55";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(x, y + 4 * s, 1.4 * s, 0, Math.PI);
  ctx.stroke();
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
  // face
  ctx.fillStyle = "#C28A3A";
  dot(ctx, x - 3 * s, y - 1 * s, 1.2 * s, "#7a4a18");
  dot(ctx, x + 3 * s, y - 1 * s, 1.2 * s, "#7a4a18");
  // cheeks
  dot(ctx, x - 5 * s, y + 2 * s, 1.2 * s, "rgba(255,150,120,0.5)");
  dot(ctx, x + 5 * s, y + 2 * s, 1.2 * s, "rgba(255,150,120,0.5)");
  ctx.strokeStyle = "#7a4a18";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.arc(x, y + 2 * s, 2 * s, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawMoonChar(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(216,216,232,0.4)", 18);
  withGlow(ctx, "#E8E8F4", s, glow, () => {
    ctx.fillStyle = "#E8E8F4";
    ctx.beginPath();
    ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x + 5 * s, y - 2 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  });
  // sleepy face on the crescent
  ctx.strokeStyle = "#6a6a88";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.arc(x - 4 * s, y - 1 * s, 1.2 * s, Math.PI + 0.2, Math.PI * 2 - 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 4 * s, y + 4 * s, 1.2 * s, 0, Math.PI);
  ctx.stroke();
  // little star companion
  ctx.fillStyle = "#FFE89A";
  const r = 2 * s;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (-Math.PI / 2) + i * (Math.PI * 2 / 5);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + 13 * s + Math.cos(a) * r, y + 7 * s + Math.sin(a) * r);
    ctx.lineTo(x + 13 * s + Math.cos(a2) * r * 0.45, y + 7 * s + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath(); ctx.fill();
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
  // face on left cloud
  eyes(ctx, x - 12 * s, y + 5 * s, s, 1.6, 0.7, "#444");
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 0.7 * s;
  ctx.beginPath();
  ctx.arc(x - 12 * s, y + 7 * s, 1 * s, 0, Math.PI);
  ctx.stroke();
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

function drawCrystal(ctx: Ctx, x: number, y: number, s: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(200,216,255,0.5)", 16);
  withGlow(ctx, "#C8D8FF", s, glow, () => {
    ctx.fillStyle = "#DCE7FF";
    ctx.beginPath();
    ctx.moveTo(x, y - 13 * s);
    ctx.lineTo(x + 8 * s, y - 4 * s);
    ctx.lineTo(x + 5 * s, y + 12 * s);
    ctx.lineTo(x - 5 * s, y + 12 * s);
    ctx.lineTo(x - 8 * s, y - 4 * s);
    ctx.closePath(); ctx.fill();
  });
  // facets
  ctx.strokeStyle = "rgba(120,140,200,0.55)";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - 13 * s); ctx.lineTo(x, y + 12 * s);
  ctx.moveTo(x - 8 * s, y - 4 * s); ctx.lineTo(x + 8 * s, y - 4 * s);
  ctx.stroke();
  // highlight
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y - 10 * s);
  ctx.lineTo(x - 5 * s, y - 4 * s);
  ctx.lineTo(x - 3 * s, y - 3 * s);
  ctx.lineTo(x, y - 9 * s);
  ctx.closePath(); ctx.fill();
  // eyes embedded
  eyes(ctx, x, y + 2 * s, s, 2.2, 0.9, "#3b4a78");
}

function drawLaurel(ctx: Ctx, x: number, y: number, s: number) {
  // ribbon ring
  ctx.strokeStyle = "#9CB877";
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.arc(x, y, 11 * s, 0, Math.PI * 2);
  ctx.stroke();
  // leaves around
  ctx.fillStyle = "#A8C887";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const lx = x + Math.cos(a) * 11 * s;
    const ly = y + Math.sin(a) * 11 * s;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.5 * s, 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // central face
  ctx.fillStyle = "#FFF2D8";
  ctx.beginPath();
  ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, x, y - 1 * s, s, 1.8, 0.8, "#5a4220");
  ctx.strokeStyle = "#5a4220";
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.arc(x, y + 1 * s, 1.4 * s, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

function drawCelestial(ctx: Ctx, x: number, y: number, s: number, flap: number, glow: boolean) {
  softGlow(ctx, x, y, s, "rgba(255,240,192,0.6)", 22);
  // central radiant being
  withGlow(ctx, "#FFF0C0", s, glow, () => {
    ctx.fillStyle = "#FFF6D8";
    ctx.beginPath();
    ctx.ellipse(x, y, 6 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 8 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  // 6 radiating beams (slow pulse via flap)
  const beam = 14 + flap * 2;
  ctx.strokeStyle = "rgba(255,232,154,0.85)";
  ctx.lineWidth = 1.4 * s;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s);
    ctx.lineTo(x + Math.cos(a) * beam * s, y + Math.sin(a) * beam * s);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // tiny eyes in the head
  eyes(ctx, x, y - 8 * s, s, 1.4, 0.6, "#9c7a20");
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
    case "oil_lamp":     drawOilLamp(ctx, x, y, s, glow); break;
    case "scroll":       drawScroll(ctx, x, y, s); break;
    case "star":         drawStarChar(ctx, x, y, s, glow); break;
    case "olive_branch": drawOliveBranch(ctx, x, y, s); break;
    case "anchor":       drawAnchor(ctx, x, y, s); break;
    case "ichthys":      drawFish(ctx, x, y, s); break;
    case "feather":      drawFeather(ctx, x, y, s); break;
    case "water_drop":   drawWaterDrop(ctx, x, y, s, glow); break;
    case "sun":          drawSunChar(ctx, x, y, s, glow); break;
    case "moon":         drawMoonChar(ctx, x, y, s, glow); break;
    case "rainbow":      drawRainbow(ctx, x, y, s); break;
    case "golden_key":   drawKey(ctx, x, y, s, glow); break;
    case "crystal":      drawCrystal(ctx, x, y, s, glow); break;
    case "laurel":       drawLaurel(ctx, x, y, s); break;
    case "celestial":    drawCelestial(ctx, x, y, s, flap, glow); break;
    case "crown":        drawCrown(ctx, x, y, s, glow); break;
    case "shield":       drawShield(ctx, x, y, s, glow); break;
    default:             drawDove(ctx, x, y, s, flap, "#FFFCF0", "#FFF5C8", false, glow);
  }

  ctx.restore();
}