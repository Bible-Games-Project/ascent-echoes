import { useEffect, useRef, useState, useCallback } from "react";

type Phase = "start" | "playing" | "gameover" | "complete";

interface Question {
  q: string;
  answers: [string, string, string]; // top, mid, bottom
  correct: 0 | 1 | 2;
}

const QUESTIONS: Question[] = [
  { q: "Who built the ark?", answers: ["Noah", "Moses", "David"], correct: 0 },
  { q: "Who was swallowed by a great fish?", answers: ["Job", "Jonah", "Joshua"], correct: 1 },
  { q: "Who led Israel out of Egypt?", answers: ["Abraham", "Samuel", "Moses"], correct: 2 },
  { q: "Who was the first man?", answers: ["Adam", "Cain", "Seth"], correct: 0 },
  { q: "Who killed Goliath?", answers: ["Saul", "David", "Solomon"], correct: 1 },
  { q: "How many disciples did Jesus have?", answers: ["10", "7", "12"], correct: 2 },
  { q: "Where was Jesus born?", answers: ["Bethlehem", "Nazareth", "Jerusalem"], correct: 0 },
  { q: "Who denied Jesus three times?", answers: ["Judas", "Peter", "John"], correct: 1 },
  { q: "Who baptized Jesus?", answers: ["Paul", "Andrew", "John the Baptist"], correct: 2 },
  { q: "In how many days was the world created?", answers: ["6", "7", "40"], correct: 0 },
];

const SCROLL_SPEED = 280; // px/s world scroll
const GATE_SPACING = 900; // px between gates in world coords
const PLAYER_X_RATIO = 0.22;

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [hud, setHud] = useState({ lives: 3, progress: 0, qIndex: 0 });
  const [portrait, setPortrait] = useState(false);

  // Mutable game state in refs to avoid re-renders
  const state = useRef({
    width: 800,
    height: 450,
    lane: 1 as 0 | 1 | 2,
    targetLane: 1 as 0 | 1 | 2,
    playerY: 0,
    lives: 3,
    worldX: 0, // distance scrolled
    gates: [] as { worldX: number; qi: number; resolved: boolean; hitLane: number | null }[],
    nextGateIdx: 0,
    shake: 0,
    flash: 0,
    time: 0,
    completed: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    dunes: [] as { x: number; y: number; w: number; h: number; layer: number }[],
    stars: [] as { x: number; y: number; r: number; tw: number }[],
    running: false,
  });

  const laneY = (h: number, lane: number) => {
    // lanes spread across vertical playfield, leaving room for UI top + ground bottom
    const top = h * 0.30;
    const bottom = h * 0.78;
    return top + ((bottom - top) / 2) * lane;
  };

  const resetGame = useCallback(() => {
    const s = state.current;
    s.lane = 1;
    s.targetLane = 1;
    s.lives = 3;
    s.worldX = 0;
    s.shake = 0;
    s.flash = 0;
    s.completed = 0;
    s.particles = [];
    s.gates = QUESTIONS.map((_, i) => ({
      worldX: 700 + i * GATE_SPACING,
      qi: i,
      resolved: false,
      hitLane: null,
    }));
    s.nextGateIdx = 0;
    setHud({ lives: 3, progress: 0, qIndex: 0 });
  }, []);

  // Orientation
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Resize canvas
  useEffect(() => {
    const onResize = () => {
      const c = canvasRef.current;
      const w = wrapRef.current;
      if (!c || !w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = w.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      c.style.width = rect.width + "px";
      c.style.height = rect.height + "px";
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.current.width = rect.width;
      state.current.height = rect.height;
      // regenerate decorative dunes
      const s = state.current;
      s.dunes = [];
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 14; i++) {
          s.dunes.push({
            x: Math.random() * rect.width * 2,
            y: rect.height * (0.55 + layer * 0.08) + Math.random() * 10,
            w: 220 + Math.random() * 260 - layer * 30,
            h: 80 + Math.random() * 60 + layer * 20,
            layer,
          });
        }
      }
      s.stars = [];
      for (let i = 0; i < 80; i++) {
        s.stars.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height * 0.5,
          r: Math.random() * 1.4 + 0.3,
          tw: Math.random() * Math.PI * 2,
        });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Input
  useEffect(() => {
    const move = (dir: -1 | 1) => {
      const s = state.current;
      s.targetLane = Math.max(0, Math.min(2, s.targetLane + dir)) as 0 | 1 | 2;
    };
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { move(-1); e.preventDefault(); }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { move(1); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);

    let touchStartY: number | null = null;
    const el = wrapRef.current;
    const onTS = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTE = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > 25) move(dy < 0 ? -1 : 1);
      touchStartY = null;
    };
    const onClick = (e: MouseEvent) => {
      if (phase !== "playing" || !el) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const s = state.current;
      const targetY = laneY(s.height, s.targetLane);
      if (y < targetY - 20) move(-1);
      else if (y > targetY + 20) move(1);
    };
    el?.addEventListener("touchstart", onTS, { passive: true });
    el?.addEventListener("touchend", onTE);
    el?.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("touchstart", onTS);
      el?.removeEventListener("touchend", onTE);
      el?.removeEventListener("click", onClick);
    };
  }, [phase]);

  // Main loop
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    state.current.running = true;

    const tick = (now: number) => {
      const s = state.current;
      if (!s.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.time += dt;
      s.worldX += SCROLL_SPEED * dt;

      // smooth lane interp
      const targetY = laneY(s.height, s.targetLane);
      s.playerY += (targetY - s.playerY) * Math.min(1, dt * 12);
      if (Math.abs(s.playerY - laneY(s.height, s.targetLane)) < 1) s.lane = s.targetLane;

      // Gate collision: when current gate's screen x near player x
      const playerX = s.width * PLAYER_X_RATIO;
      const g = s.gates[s.nextGateIdx];
      if (g && !g.resolved) {
        const gateScreenX = g.worldX - s.worldX;
        if (gateScreenX <= playerX + 10) {
          // resolve based on current lane
          const q = QUESTIONS[g.qi];
          const hit = s.lane;
          g.resolved = true;
          g.hitLane = hit;
          if (hit === q.correct) {
            // particles burst golden
            for (let i = 0; i < 30; i++) {
              s.particles.push({
                x: gateScreenX, y: laneY(s.height, hit),
                vx: Math.random() * 120 - 60, vy: Math.random() * -180 - 20,
                life: 0.8 + Math.random() * 0.4,
                color: `hsl(${40 + Math.random() * 20}, 95%, ${60 + Math.random() * 20}%)`,
              });
            }
          } else {
            s.lives -= 1;
            s.shake = 1;
            s.flash = 1;
            for (let i = 0; i < 40; i++) {
              s.particles.push({
                x: gateScreenX, y: laneY(s.height, hit),
                vx: Math.random() * 200 - 100, vy: Math.random() * -220 - 20,
                life: 0.6 + Math.random() * 0.4,
                color: `hsl(${Math.random() * 20}, 90%, ${50 + Math.random() * 20}%)`,
              });
            }
          }
          s.completed += 1;
          s.nextGateIdx += 1;
          setHud({ lives: s.lives, progress: s.completed, qIndex: Math.min(s.nextGateIdx, QUESTIONS.length - 1) });
          if (s.lives <= 0) {
            s.running = false;
            setPhase("gameover");
            return;
          }
          if (s.completed >= QUESTIONS.length) {
            s.running = false;
            setPhase("complete");
            return;
          }
        }
      }

      // decay effects
      s.shake *= Math.pow(0.001, dt);
      s.flash *= Math.pow(0.01, dt);

      // particles
      s.particles = s.particles.filter((p) => {
        p.life -= dt;
        p.vy += 380 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return p.life > 0;
      });

      draw();
      raf = requestAnimationFrame(tick);
    };

    const draw = () => {
      const c = canvasRef.current;
      const s = state.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const W = s.width, H = s.height;

      // shake
      const sx = (Math.random() - 0.5) * 14 * s.shake;
      const sy = (Math.random() - 0.5) * 14 * s.shake;
      ctx.save();
      ctx.translate(sx, sy);

      // Sky gradient (dawn -> dusk subtle shift)
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0b1d3a");
      sky.addColorStop(0.35, "#2a3a6b");
      sky.addColorStop(0.6, "#c2734a");
      sky.addColorStop(0.85, "#f0a868");
      sky.addColorStop(1, "#f4c98a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Sun
      const sunX = W * 0.78, sunY = H * 0.42;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 220);
      sunGrad.addColorStop(0, "rgba(255,230,180,0.95)");
      sunGrad.addColorStop(0.3, "rgba(255,180,120,0.4)");
      sunGrad.addColorStop(1, "rgba(255,150,90,0)");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,240,210,0.95)";
      ctx.beginPath(); ctx.arc(sunX, sunY, 38, 0, Math.PI * 2); ctx.fill();

      // Stars (top)
      for (const st of s.stars) {
        const a = 0.4 + Math.sin(s.time * 2 + st.tw) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      }

      // Parallax dunes (3 layers)
      const layerSpeeds = [0.15, 0.4, 0.8];
      const layerColors = ["#3a2a55", "#6b3a55", "#a9583f"];
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = layerColors[layer];
        for (const d of s.dunes) {
          if (d.layer !== layer) continue;
          const x = ((d.x - s.worldX * layerSpeeds[layer]) % (W * 2) + W * 2) % (W * 2) - d.w;
          ctx.beginPath();
          ctx.moveTo(x, H);
          ctx.quadraticCurveTo(x + d.w / 2, d.y - d.h, x + d.w, H);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Ground (foreground)
      const groundY = H * 0.82;
      const ground = ctx.createLinearGradient(0, groundY, 0, H);
      ground.addColorStop(0, "#c46a3a");
      ground.addColorStop(1, "#2a1410");
      ctx.fillStyle = ground;
      ctx.fillRect(0, groundY, W, H - groundY);

      // sand texture / scroll lines
      ctx.strokeStyle = "rgba(255,200,150,0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const y = groundY + 8 + i * ((H - groundY) / 18);
        const off = (s.worldX * (0.5 + i * 0.05)) % 40;
        ctx.beginPath();
        for (let x = -off; x < W; x += 40) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 20, y);
        }
        ctx.stroke();
      }

      // Lane guide subtle
      for (let i = 0; i < 3; i++) {
        const y = laneY(H, i);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Draw gates
      const playerX = W * PLAYER_X_RATIO;
      for (let i = s.nextGateIdx; i < Math.min(s.gates.length, s.nextGateIdx + 2); i++) {
        const g = s.gates[i];
        const x = g.worldX - s.worldX;
        if (x > W + 200 || x < -200) continue;
        const q = QUESTIONS[g.qi];
        for (let lane = 0; lane < 3; lane++) {
          const y = laneY(H, lane);
          drawDoor(ctx, x, y, lane === q.correct, g.resolved && g.hitLane === lane, g.resolved);
          // Answer label on door
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, 'Segoe UI'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // backdrop
          const txt = q.answers[lane];
          const tw = ctx.measureText(txt).width + 16;
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          roundRect(ctx, x - tw / 2, y - 10, tw, 22, 6);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText(txt, x, y + 2);
          ctx.restore();
        }

        // Question banner above next gate as it approaches
        if (i === s.nextGateIdx && x < W && x > playerX - 100) {
          // (DOM overlay handles this, but draw subtle marker)
        }
      }

      // Player
      const py = s.playerY || laneY(H, 1);
      drawPlayer(ctx, playerX, py, s.time);

      // Vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Red flash
      if (s.flash > 0.02) {
        ctx.fillStyle = `rgba(220,40,40,${s.flash * 0.4})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.restore();
    };

    raf = requestAnimationFrame((t) => { last = t; tick(t); });
    return () => {
      state.current.running = false;
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  const start = () => {
    resetGame();
    setPhase("playing");
  };

  const currentQ = QUESTIONS[hud.qIndex];

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none touch-none">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* HUD */}
        {phase === "playing" && (
          <>
            {/* Question banner */}
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 max-w-[88%] text-center">
              <div className="inline-block px-5 py-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 shadow-2xl">
                <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">Question {hud.qIndex + 1} / 10</div>
                <div className="text-white text-sm sm:text-base font-semibold mt-0.5">{currentQ?.q}</div>
              </div>
            </div>

            {/* Health */}
            <div className="absolute top-3 left-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <Heart key={i} filled={i < hud.lives} />
              ))}
            </div>

            {/* Progress */}
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
              {hud.progress} / 10
            </div>
          </>
        )}

        {/* Start screen */}
        {phase === "start" && (
          <Overlay>
            <div className="text-amber-300 text-xs uppercase tracking-[0.3em] mb-3">A Cinematic Journey</div>
            <h1 className="text-white text-4xl sm:text-6xl font-bold tracking-tight">Gates of Wisdom</h1>
            <p className="text-white/70 mt-4 max-w-md text-sm sm:text-base">
              Pass through ten gates. Choose the door of truth. Swipe up or down — or use W / S — to change lane.
            </p>
            <button onClick={start} className="mt-8 px-8 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold shadow-2xl hover:scale-105 transition">
              Begin Journey
            </button>
          </Overlay>
        )}

        {phase === "gameover" && (
          <Overlay>
            <div className="text-red-400 text-xs uppercase tracking-[0.3em] mb-3">The Journey Ends</div>
            <h1 className="text-white text-4xl sm:text-5xl font-bold">Game Over</h1>
            <p className="text-white/70 mt-3">You reached gate {hud.progress} of 10.</p>
            <button onClick={start} className="mt-8 px-8 py-3 rounded-full bg-white text-black font-semibold hover:scale-105 transition">
              Try Again
            </button>
          </Overlay>
        )}

        {phase === "complete" && (
          <Overlay>
            <div className="text-amber-300 text-xs uppercase tracking-[0.3em] mb-3">Level 1 Complete</div>
            <h1 className="text-white text-4xl sm:text-6xl font-bold">Wisdom Earned</h1>
            <p className="text-white/70 mt-3">All ten gates passed. {hud.lives} {hud.lives === 1 ? "life" : "lives"} remaining.</p>
            <button onClick={start} className="mt-8 px-8 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold shadow-2xl hover:scale-105 transition">
              Play Again
            </button>
          </Overlay>
        )}

        {/* Portrait warning on mobile */}
        {portrait && (
          <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-center px-6">
            <div className="text-5xl mb-4 animate-pulse">↻</div>
            <div className="text-white text-xl font-semibold">Please rotate your device</div>
            <div className="text-white/60 mt-2 text-sm">This journey is best in landscape.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-black/40 via-black/55 to-black/70 backdrop-blur-sm">
      {children}
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "#ef4444" : "none"} stroke={filled ? "#fecaca" : "rgba(255,255,255,0.3)"} strokeWidth="2">
      <path d="M12 21s-7-4.5-9.5-9C.5 8 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6.5 4 4.5 8C19 16.5 12 21 12 21z" />
    </svg>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, isCorrect: boolean, wasHit: boolean, resolved: boolean) {
  const w = 56, h = 110;
  ctx.save();
  // frame shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - w / 2 + 4, y - h / 2 + 6, w, h);

  // door frame
  const frameGrad = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  frameGrad.addColorStop(0, "#3a2418");
  frameGrad.addColorStop(0.5, "#6b4226");
  frameGrad.addColorStop(1, "#3a2418");
  ctx.fillStyle = frameGrad;
  ctx.fillRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8);

  // door body
  let body: CanvasGradient;
  if (resolved && isCorrect) {
    body = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    body.addColorStop(0, "#fde68a");
    body.addColorStop(1, "#f59e0b");
  } else if (resolved && wasHit && !isCorrect) {
    body = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    body.addColorStop(0, "#7f1d1d");
    body.addColorStop(1, "#450a0a");
  } else {
    body = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    body.addColorStop(0, "#8b6f47");
    body.addColorStop(1, "#4a3825");
  }
  ctx.fillStyle = body;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);

  // door panel detail
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - w / 2 + 6, y - h / 2 + 8, w - 12, h - 16);
  ctx.strokeRect(x - w / 2 + 10, y - h / 2 + 12, w - 20, (h - 16) / 2 - 4);
  ctx.strokeRect(x - w / 2 + 10, y + 4, w - 20, (h - 16) / 2 - 8);

  // handle
  ctx.fillStyle = "#f5d28a";
  ctx.beginPath(); ctx.arc(x + w / 2 - 8, y + 8, 2.5, 0, Math.PI * 2); ctx.fill();

  // glow for correct after resolve
  if (resolved && isCorrect) {
    const g = ctx.createRadialGradient(x, y, 5, x, y, 80);
    g.addColorStop(0, "rgba(255,220,120,0.5)");
    g.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 80, y - 80, 160, 160);
  }
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 8) * 2;
  ctx.save();
  ctx.translate(x, y + bob);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(0, 38, 18, 4, 0, 0, Math.PI * 2); ctx.fill();

  // cloak
  const cloak = ctx.createLinearGradient(0, -25, 0, 35);
  cloak.addColorStop(0, "#e63946");
  cloak.addColorStop(1, "#7a1c2b");
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-14, -10);
  ctx.quadraticCurveTo(-22, 25, -10, 36);
  ctx.lineTo(10, 36);
  ctx.quadraticCurveTo(22, 25, 14, -10);
  ctx.quadraticCurveTo(0, -18, -14, -10);
  ctx.closePath();
  ctx.fill();

  // scarf trailing
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.quadraticCurveTo(-30 + Math.sin(t * 6) * 4, -4, -36, 4 + Math.sin(t * 6) * 3);
  ctx.quadraticCurveTo(-22, 0, -6, 0);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = "#f5d6b4";
  ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI * 2); ctx.fill();

  // hood
  ctx.fillStyle = "#b22234";
  ctx.beginPath();
  ctx.moveTo(-12, -18);
  ctx.quadraticCurveTo(-12, -34, 0, -34);
  ctx.quadraticCurveTo(12, -34, 12, -18);
  ctx.quadraticCurveTo(0, -22, -12, -18);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}