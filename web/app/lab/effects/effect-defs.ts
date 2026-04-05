export type EffectDef = {
  name: string;
  description: string;
  tags: string[];
  init: (canvas: HTMLCanvasElement) => () => void;
};

function createNoise2D() {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 3;
    return h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y;
  };

  return (x: number, y: number) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v,
    );
  };
}

// ---------------------------------------------------------------------------
// 1. Trunk Rings
// ---------------------------------------------------------------------------
const trunkRings: EffectDef = {
  name: "Trunk Rings",
  description:
    "Noise-distorted concentric rings radiating fuchsia\u2009\u2192\u2009cyan with pulsing glow waves. From the Goblin Day share page.",
  tags: ["noise", "radial", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;
    const ox = Math.random() * 100;
    const oyBase = Math.random() * 100;
    let oyOff = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.38;
      const cy = H * 0.3;
      oyOff -= 0.015;
      const ringScale = Math.max(W, H) * 0.008;

      for (let ring = 0; ring < 65; ring++) {
        const baseR = ring * ringScale + 10;
        ctx.beginPath();
        for (let a = 0; a <= 360; a += 2) {
          const rad = (a * Math.PI) / 180;
          const n = noise(
            Math.cos(rad) * 0.02 * ring + ox,
            Math.sin(rad) * 0.02 * ring + oyBase + oyOff,
          );
          const r = baseR + 1.5 * n * 25;
          const x = cx + Math.cos(rad) * r;
          const y = cy + Math.sin(rad) * r;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const rt = ring / 65;
        const cr = Math.floor(180 - 180 * rt);
        const cg = Math.floor(200 * rt);
        const cb = Math.floor(120 + 135 * rt);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.max(0.4 - rt * 0.25, 0.05)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const maxR = Math.max(W, H) * 0.8;
      for (let i = 0; i < 5; i++) {
        const r = (t * 0.8 + (i * maxR) / 5) % maxR;
        const alpha = 0.07 * (1 - r / maxR);
        if (alpha <= 0.005) continue;
        const c = i % 2 === 0 ? "0,240,255" : "220,0,140";
        const g = ctx.createRadialGradient(cx, cy, Math.max(r - 30, 0), cx, cy, r + 30);
        g.addColorStop(0, `rgba(${c},0)`);
        g.addColorStop(0.4, `rgba(${c},${alpha})`);
        g.addColorStop(0.6, `rgba(${c},${alpha})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 2. Flow Field
// ---------------------------------------------------------------------------
const flowField: EffectDef = {
  name: "Flow Field",
  description:
    "Particles trace luminous paths through a Perlin noise vector field, building up layered trails over time.",
  tags: ["noise", "particles", "trails"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;
    const W = canvas.width;
    const H = canvas.height;
    const NUM = Math.min(Math.floor((W * H) / 300), 2000);

    const particles = Array.from({ length: NUM }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
    }));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.025)";
      ctx.fillRect(0, 0, W, H);

      for (const p of particles) {
        const angle = noise(p.x * 0.003, p.y * 0.003 + t * 0.0003) * Math.PI * 4;
        p.x += Math.cos(angle) * 1.5;
        p.y += Math.sin(angle) * 1.5;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        const hue = ((angle / Math.PI) * 180 + 200) % 360;
        ctx.fillStyle = `hsla(${hue},70%,60%,0.4)`;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
      }
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 3. Aurora
// ---------------------------------------------------------------------------
const aurora: EffectDef = {
  name: "Aurora",
  description:
    "Shimmering horizontal bands of light displaced by layered noise \u2014 the northern lights rendered procedurally.",
  tags: ["noise", "gradient", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "rgba(0,0,8,0.12)";
      ctx.fillRect(0, 0, W, H);

      for (let band = 0; band < 5; band++) {
        const baseY = H * (0.15 + band * 0.14);
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 3) {
          const n1 = noise(x * 0.004 + band * 10, t * 0.008);
          const n2 = noise(x * 0.001 + band * 5, t * 0.005 + 100);
          const y = baseY + n1 * H * 0.08 + n2 * H * 0.12;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();

        const hue = 130 + band * 25;
        const grad = ctx.createLinearGradient(0, baseY - H * 0.1, 0, baseY + H * 0.15);
        grad.addColorStop(0, `hsla(${hue},80%,50%,0)`);
        grad.addColorStop(0.3, `hsla(${hue},80%,50%,0.07)`);
        grad.addColorStop(0.5, `hsla(${hue},70%,60%,0.11)`);
        grad.addColorStop(1, `hsla(${hue},80%,50%,0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 4. Plasma
// ---------------------------------------------------------------------------
const plasma: EffectDef = {
  name: "Plasma",
  description:
    "Classic demoscene plasma \u2014 overlapping sine waves creating hypnotic interference patterns at half resolution.",
  tags: ["sine", "interference", "pixel"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;

    const scale = 2;
    const bw = Math.ceil(canvas.width / scale);
    const bh = Math.ceil(canvas.height / scale);
    const buf = document.createElement("canvas");
    buf.width = bw;
    buf.height = bh;
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(bw, bh);

    const draw = () => {
      const data = img.data;
      const tt = t * 0.015;

      for (let y = 0; y < bh; y++) {
        const sy = y * scale;
        for (let x = 0; x < bw; x++) {
          const sx = x * scale;
          const v =
            (Math.sin(sx * 0.02 + tt) +
              Math.sin(sy * 0.03 + tt * 0.7) +
              Math.sin((sx + sy) * 0.015 + tt * 0.5) +
              Math.sin(Math.sqrt(sx * sx + sy * sy) * 0.015 - tt)) /
            4;

          const i = (y * bw + x) * 4;
          data[i] = ((Math.sin(v * Math.PI) * 0.5 + 0.5) * 200) | 0;
          data[i + 1] = ((Math.sin(v * Math.PI + 2) * 0.5 + 0.5) * 100) | 0;
          data[i + 2] = ((Math.sin(v * Math.PI + 4) * 0.5 + 0.5) * 255) | 0;
          data[i + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 5. Constellation
// ---------------------------------------------------------------------------
const constellation: EffectDef = {
  name: "Constellation",
  description:
    "Drifting points connected by proximity \u2014 a slowly evolving network map in cool silver and cyan.",
  tags: ["particles", "connections", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    const W = canvas.width;
    const H = canvas.height;
    const NUM = Math.min(Math.floor((W * H) / 4000), 150);
    const threshold = Math.min(W, H) * 0.18;

    const pts = Array.from({ length: NUM }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, W, H);

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        p.x = Math.max(0, Math.min(W, p.x));
        p.y = Math.max(0, Math.min(H, p.y));
      }

      ctx.lineWidth = 0.5;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < threshold) {
            const alpha = (1 - d / threshold) * 0.3;
            ctx.strokeStyle = `rgba(100,210,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = "rgba(180,225,255,0.8)";
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 6. Unknown Pleasures
// ---------------------------------------------------------------------------
const unknownPleasures: EffectDef = {
  name: "Unknown Pleasures",
  description:
    "Layered noise-displaced horizon lines with occlusion \u2014 the Joy Division album cover, alive and breathing.",
  tags: ["noise", "lines", "generative"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const numLines = 40;
      const lineSpacing = H / (numLines + 6);
      const margin = W * 0.15;

      for (let i = 0; i < numLines; i++) {
        const baseY = (i + 3) * lineSpacing;
        const centerInfluence = 1 - Math.abs(i - numLines / 2) / (numLines / 2);
        const amplitude = centerInfluence * H * 0.08 + H * 0.01;

        const buildPath = () => {
          ctx.beginPath();
          for (let x = margin; x <= W - margin; x += 2) {
            const nx = (x / W) * 4;
            const ny = i * 0.3 + t * 0.005;
            const n = noise(nx, ny);
            const xNorm = (x - margin) / (W - 2 * margin);
            const bell = Math.exp(-((xNorm - 0.5) * (xNorm - 0.5)) / 0.08);
            const y = baseY - n * amplitude * bell;
            if (x <= margin) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        };

        // Fill below the line to occlude lines behind
        buildPath();
        ctx.lineTo(W - margin, H);
        ctx.lineTo(margin, H);
        ctx.closePath();
        ctx.fillStyle = "#000";
        ctx.fill();

        // Stroke the line on top
        buildPath();
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + centerInfluence * 0.5})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 7. Mesh Gradient
// ---------------------------------------------------------------------------
const meshGradient: EffectDef = {
  name: "Mesh Gradient",
  description:
    "Soft animated gradient orbs drifting and blending \u2014 coral, cyan, purple, and gold in additive light.",
  tags: ["gradient", "blending", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;

    const blobs = [
      { phase: 0, speed: 0.007, color: [255, 107, 122] }, // coral
      { phase: 1.5, speed: 0.005, color: [0, 212, 232] }, // cyan
      { phase: 3.0, speed: 0.009, color: [167, 139, 250] }, // vibe
      { phase: 4.5, speed: 0.006, color: [255, 217, 61] }, // gold
    ];

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";
      for (const blob of blobs) {
        const x = W * (0.5 + 0.35 * Math.sin(t * blob.speed + blob.phase));
        const y = H * (0.5 + 0.35 * Math.cos(t * blob.speed * 1.3 + blob.phase));
        const r = Math.min(W, H) * 0.45;
        const [cr, cg, cb] = blob.color;

        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},0.3)`);
        g.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.12)`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = "source-over";

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 8. Particle Vortex
// ---------------------------------------------------------------------------
const particleVortex: EffectDef = {
  name: "Particle Vortex",
  description:
    "Particles in elliptical orbit around a center point, perturbed by noise, leaving rainbow trails.",
  tags: ["particles", "orbital", "trails"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;
    const W = canvas.width;
    const H = canvas.height;

    const particles = Array.from({ length: 300 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 20 + Math.random() * Math.min(W, H) * 0.4,
      speed: 0.003 + Math.random() * 0.006,
      size: 1 + Math.random() * 1.5,
    }));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;

      for (const p of particles) {
        p.angle += p.speed;
        const n = noise(p.radius * 0.01, t * 0.001);
        const r = p.radius + n * 20;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.6;

        const hue = ((p.angle * 30 + t * 0.3) % 360 + 360) % 360;
        ctx.fillStyle = `hsla(${hue},80%,60%,0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 9. Moiré Waves
// ---------------------------------------------------------------------------
const moireWaves: EffectDef = {
  name: "Moir\u00e9 Waves",
  description:
    "Expanding concentric rings from multiple sources create shimmering interference patterns in additive color.",
  tags: ["geometry", "interference", "additive"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;

    const sources = [
      { x: 0.25, y: 0.35, speed: 0.8, color: "0,220,255" },
      { x: 0.75, y: 0.55, speed: 1.2, color: "220,0,180" },
      { x: 0.5, y: 0.8, speed: 1.0, color: "0,255,160" },
    ];

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";
      const maxR = Math.max(W, H) * 0.95;
      const ringSpacing = 18;

      for (const src of sources) {
        const sx = src.x * W;
        const sy = src.y * H;
        const offset = (t * src.speed) % ringSpacing;

        for (let r = offset; r < maxR; r += ringSpacing) {
          const alpha = 0.12 * (1 - r / maxR);
          if (alpha < 0.005) continue;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${src.color},${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 10. Dot Grid
// ---------------------------------------------------------------------------
const dotGrid: EffectDef = {
  name: "Dot Grid",
  description:
    "A matrix of dots whose size and color pulse in response to drifting Lissajous attractors \u2014 halftone meets data viz.",
  tags: ["geometry", "attractor", "grid"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);

      const spacing = Math.max(12, Math.min(W, H) * 0.035);
      const maxR = spacing * 0.38;
      const range = Math.min(W, H) * 0.5;

      const a1x = W * (0.5 + 0.35 * Math.sin(t * 0.008));
      const a1y = H * (0.5 + 0.35 * Math.cos(t * 0.011));
      const a2x = W * (0.5 + 0.3 * Math.cos(t * 0.007));
      const a2y = H * (0.5 + 0.3 * Math.sin(t * 0.009));

      for (let x = spacing / 2; x < W; x += spacing) {
        for (let y = spacing / 2; y < H; y += spacing) {
          const d1 = Math.sqrt((x - a1x) ** 2 + (y - a1y) ** 2);
          const d2 = Math.sqrt((x - a2x) ** 2 + (y - a2y) ** 2);
          const inf = Math.max(0, 1 - d1 / range) + Math.max(0, 1 - d2 / range);
          const r = maxR * Math.min(inf, 1.2) * 0.7 + maxR * 0.08;

          const hue = (d1 * 0.5 + d2 * 0.3 + t * 0.4) % 360;
          const lum = 25 + Math.min(inf, 1) * 40;
          ctx.fillStyle = `hsla(${hue},55%,${lum}%,${0.15 + Math.min(inf, 1) * 0.7})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(r, 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 11. Fireflies
// ---------------------------------------------------------------------------
const fireflies: EffectDef = {
  name: "Fireflies",
  description:
    "Gently drifting points of warm light that pulse and glow \u2014 amber halos on deep black.",
  tags: ["particles", "glow", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;
    const W = canvas.width;
    const H = canvas.height;

    const flies = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
    }));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, W, H);

      for (const f of flies) {
        f.x += f.vx + Math.sin(t * 0.01 + f.phase) * 0.2;
        f.y += f.vy + Math.cos(t * 0.012 + f.phase) * 0.15;
        if (f.x < -20) f.x = W + 20;
        if (f.x > W + 20) f.x = -20;
        if (f.y < -20) f.y = H + 20;
        if (f.y > H + 20) f.y = -20;

        const brightness = Math.sin(t * f.speed + f.phase) * 0.5 + 0.5;
        const r = f.size * (1 + brightness);

        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 8);
        grad.addColorStop(0, `rgba(255,200,60,${0.3 * brightness})`);
        grad.addColorStop(0.3, `rgba(255,160,30,${0.1 * brightness})`);
        grad.addColorStop(1, "rgba(255,120,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(f.x - r * 8, f.y - r * 8, r * 16, r * 16);

        ctx.fillStyle = `rgba(255,230,150,${0.5 + brightness * 0.5})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 12. Noise Terrain
// ---------------------------------------------------------------------------
const noiseTerrain: EffectDef = {
  name: "Noise Terrain",
  description:
    "Wireframe landscape receding toward a glowing horizon \u2014 synthwave terrain displaced by Perlin noise.",
  tags: ["noise", "wireframe", "retro"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Sun glow behind horizon
      const sunY = H * 0.35;
      const sunGrad = ctx.createRadialGradient(W / 2, sunY, 10, W / 2, sunY, H * 0.35);
      sunGrad.addColorStop(0, "rgba(255,80,40,0.25)");
      sunGrad.addColorStop(0.5, "rgba(160,0,80,0.08)");
      sunGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);

      const horizon = H * 0.5;
      const numLines = 35;
      const numPoints = 80;

      for (let i = numLines; i >= 0; i--) {
        const depth = i / numLines;
        const perspY = horizon + (H - horizon) * (1 - Math.pow(depth, 1.5));

        ctx.beginPath();
        for (let j = 0; j <= numPoints; j++) {
          const xNorm = j / numPoints;
          const x = xNorm * W;
          const n = noise(xNorm * 3, depth * 4 + t * 0.008);
          const displacement = n * (1 - depth) * H * 0.12;
          const y = perspY - displacement;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const hue = 280 + depth * 40;
        const alpha = (1 - depth) * 0.6 + 0.08;
        ctx.strokeStyle = `hsla(${hue},80%,60%,${alpha})`;
        ctx.lineWidth = 1 + (1 - depth) * 0.5;
        ctx.stroke();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 13. Spiral Galaxy
// ---------------------------------------------------------------------------
const spiralGalaxy: EffectDef = {
  name: "Spiral Galaxy",
  description:
    "Thousands of stars tracing logarithmic spiral arms around a bright galactic core.",
  tags: ["particles", "spiral", "space"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const stars = Array.from({ length: 1500 }, () => {
      const arm = Math.floor(Math.random() * 3);
      const dist = Math.random() * Math.min(W, H) * 0.42;
      const armAngle = (arm / 3) * Math.PI * 2;
      const spiralAngle = armAngle + dist * 0.008;
      const spread = (Math.random() - 0.5) * 0.5 * (1 + dist * 0.003);
      return {
        dist,
        baseAngle: spiralAngle + spread,
        speed: 0.0005 + (1 / (dist + 50)) * 0.05,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
        hue: 200 + Math.random() * 60,
      };
    });

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, W, H);

      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 35);
      coreGrad.addColorStop(0, "rgba(255,240,220,0.12)");
      coreGrad.addColorStop(0.5, "rgba(200,180,255,0.04)");
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coreGrad;
      ctx.fillRect(cx - 35, cy - 35, 70, 70);

      for (const s of stars) {
        const angle = s.baseAngle + t * s.speed;
        const x = cx + Math.cos(angle) * s.dist;
        const y = cy + Math.sin(angle) * s.dist * 0.6;
        ctx.fillStyle = `hsla(${s.hue},40%,80%,${s.brightness * 0.45})`;
        ctx.fillRect(x, y, s.size, s.size);
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 14. Electric Arc
// ---------------------------------------------------------------------------
const electricArc: EffectDef = {
  name: "Electric Arc",
  description:
    "Branching bolts of electricity that flicker and reform \u2014 recursive midpoint displacement lightning.",
  tags: ["generative", "electric", "dynamic"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;
    const W = canvas.width;
    const H = canvas.height;

    function bolt(
      ctx: CanvasRenderingContext2D,
      x1: number, y1: number, x2: number, y2: number, depth: number,
    ) {
      if (depth <= 0) { ctx.lineTo(x2, y2); return; }
      const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * Math.abs(y2 - y1) * 0.3;
      const my = (y1 + y2) / 2 + (Math.random() - 0.5) * Math.abs(x2 - x1) * 0.3;
      bolt(ctx, x1, y1, mx, my, depth - 1);
      bolt(ctx, mx, my, x2, y2, depth - 1);
    }

    ctx.fillStyle = "#000005";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,5,0.15)";
      ctx.fillRect(0, 0, W, H);

      if (t % 4 === 0) {
        const numBolts = 2 + Math.floor(Math.random() * 2);
        for (let b = 0; b < numBolts; b++) {
          const x1 = Math.random() * W * 0.4 + W * 0.1;
          const y1 = Math.random() * H * 0.15;
          const x2 = Math.random() * W * 0.4 + W * 0.4;
          const y2 = H * 0.7 + Math.random() * H * 0.3;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          bolt(ctx, x1, y1, x2, y2, 5);
          ctx.strokeStyle = "rgba(100,140,255,0.12)";
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.strokeStyle = "rgba(140,180,255,0.7)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (Math.random() > 0.4) {
            const bt = 0.3 + Math.random() * 0.4;
            const bx = x1 + (x2 - x1) * bt + (Math.random() - 0.5) * 30;
            const by = y1 + (y2 - y1) * bt;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            bolt(ctx, bx, by, bx + (Math.random() - 0.5) * W * 0.3, by + Math.random() * H * 0.3, 4);
            ctx.strokeStyle = "rgba(140,180,255,0.35)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 15. Rain
// ---------------------------------------------------------------------------
const rain: EffectDef = {
  name: "Rain",
  description:
    "Luminous streaks of rain falling at a slight wind angle through darkness.",
  tags: ["particles", "weather", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    const W = canvas.width;
    const H = canvas.height;

    const drops = Array.from({ length: 250 }, () => ({
      x: Math.random() * (W + 100) - 50,
      y: Math.random() * H,
      speed: 4 + Math.random() * 8,
      length: 8 + Math.random() * 25,
      alpha: 0.08 + Math.random() * 0.25,
    }));

    ctx.fillStyle = "#000005";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,5,0.12)";
      ctx.fillRect(0, 0, W, H);

      const groundGrad = ctx.createLinearGradient(0, H * 0.88, 0, H);
      groundGrad.addColorStop(0, "rgba(0,0,0,0)");
      groundGrad.addColorStop(1, "rgba(50,70,110,0.025)");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, H * 0.88, W, H * 0.12);

      const wind = -0.3;
      ctx.lineWidth = 1;

      for (const d of drops) {
        d.y += d.speed;
        d.x += wind * d.speed;
        if (d.y > H + d.length) {
          d.y = -d.length;
          d.x = Math.random() * (W + 100) - 50;
        }
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + wind * d.length, d.y + d.length);
        ctx.strokeStyle = `rgba(150,180,220,${d.alpha})`;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 16. Bokeh
// ---------------------------------------------------------------------------
const bokeh: EffectDef = {
  name: "Bokeh",
  description:
    "Soft out-of-focus circles of light drifting upward \u2014 cinematic depth-of-field made ambient.",
  tags: ["circles", "cinematic", "ambient"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    const W = canvas.width;
    const H = canvas.height;

    const circles = Array.from({ length: 25 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 15 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.1 - Math.random() * 0.3,
      hue: [340, 200, 45, 280, 160][Math.floor(Math.random() * 5)],
      alpha: 0.04 + Math.random() * 0.08,
    }));

    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(5,5,8,0.035)";
      ctx.fillRect(0, 0, W, H);

      for (const c of circles) {
        c.x += c.vx;
        c.y += c.vy;
        if (c.y < -c.r * 2) { c.y = H + c.r; c.x = Math.random() * W; }
        if (c.x < -c.r) c.x = W + c.r;
        if (c.x > W + c.r) c.x = -c.r;

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${c.hue},60%,65%,${c.alpha * 1.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        grad.addColorStop(0, `hsla(${c.hue},60%,70%,${c.alpha * 0.5})`);
        grad.addColorStop(0.7, `hsla(${c.hue},50%,60%,${c.alpha * 0.2})`);
        grad.addColorStop(1, `hsla(${c.hue},50%,50%,0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 17. Waveform
// ---------------------------------------------------------------------------
const waveform: EffectDef = {
  name: "Waveform",
  description:
    "A neon oscilloscope trace \u2014 multiple harmonics combine into a breathing, luminous waveform.",
  tags: ["sine", "neon", "audio"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;

    ctx.fillStyle = "#000005";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "rgba(0,0,5,0.07)";
      ctx.fillRect(0, 0, W, H);

      const cy = H / 2;
      const waves = [
        { freq: 0.02, amp: H * 0.18, speed: 0.03, color: "0,240,255", width: 2 },
        { freq: 0.015, amp: H * 0.11, speed: 0.02, color: "220,0,180", width: 1.5 },
        { freq: 0.035, amp: H * 0.06, speed: 0.04, color: "0,255,160", width: 1 },
      ];

      for (const w of waves) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
          const v =
            Math.sin(x * w.freq + t * w.speed) +
            Math.sin(x * w.freq * 2.1 + t * w.speed * 0.7) * 0.3 +
            Math.sin(x * w.freq * 0.5 + t * w.speed * 1.3) * 0.5;
          const y = cy + v * w.amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${w.color},0.07)`;
        ctx.lineWidth = w.width * 6;
        ctx.stroke();
        ctx.strokeStyle = `rgba(${w.color},0.6)`;
        ctx.lineWidth = w.width;
        ctx.stroke();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 18. Smoke
// ---------------------------------------------------------------------------
const smoke: EffectDef = {
  name: "Smoke",
  description:
    "Layered Perlin turbulence drifting horizontally \u2014 volumetric fog at third resolution.",
  tags: ["noise", "volumetric", "pixel"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;

    const scale = 3;
    const bw = Math.ceil(canvas.width / scale);
    const bh = Math.ceil(canvas.height / scale);
    const buf = document.createElement("canvas");
    buf.width = bw;
    buf.height = bh;
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(bw, bh);

    const draw = () => {
      const data = img.data;
      const tt = t * 0.003;

      for (let y = 0; y < bh; y++) {
        const sy = y * scale;
        for (let x = 0; x < bw; x++) {
          const sx = x * scale;
          const n1 = noise(sx * 0.004 + tt, sy * 0.004) * 0.5;
          const n2 = noise(sx * 0.008 + tt * 2, sy * 0.008 + 50) * 0.25;
          const n3 = noise(sx * 0.016 + tt * 3, sy * 0.016 + 100) * 0.125;
          const v = Math.max(0, Math.min(1, n1 + n2 + n3 + 0.5));
          const b = v * 45;

          const i = (y * bw + x) * 4;
          data[i] = b * 0.7;
          data[i + 1] = b * 0.8;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }

      bctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 19. Starfield
// ---------------------------------------------------------------------------
const starfield: EffectDef = {
  name: "Starfield",
  description:
    "Stars streaming past at different depths \u2014 the classic warp-speed parallax effect with motion streaks.",
  tags: ["particles", "parallax", "space"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const stars = Array.from({ length: 300 }, () => ({
      x: (Math.random() - 0.5) * W * 3,
      y: (Math.random() - 0.5) * H * 3,
      z: Math.random() * 1500 + 1,
    }));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        s.z -= 3;
        if (s.z <= 1) {
          s.z = 1500;
          s.x = (Math.random() - 0.5) * W * 3;
          s.y = (Math.random() - 0.5) * H * 3;
        }
        const sx = cx + (s.x / s.z) * 100;
        const sy = cy + (s.y / s.z) * 100;
        const r = Math.max(0.3, (1 - s.z / 1500) * 2.5);
        const alpha = Math.max(0.1, 1 - s.z / 1500);

        if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) {
          ctx.fillStyle = `rgba(200,220,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();

          if (s.z < 300) {
            const prevSx = cx + (s.x / (s.z + 6)) * 100;
            const prevSy = cy + (s.y / (s.z + 6)) * 100;
            ctx.strokeStyle = `rgba(200,220,255,${alpha * 0.3})`;
            ctx.lineWidth = r * 0.5;
            ctx.beginPath();
            ctx.moveTo(prevSx, prevSy);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 20. Cellular
// ---------------------------------------------------------------------------
const cellular: EffectDef = {
  name: "Cellular",
  description:
    "Conway\u2019s Game of Life with color-fading trails \u2014 each generation leaves a ghostly hue-shifted imprint.",
  tags: ["automata", "generative", "grid"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let animId = 0;
    let t = 0;
    const cellSize = 4;
    const cols = Math.floor(canvas.width / cellSize);
    const rows = Math.floor(canvas.height / cellSize);

    let grid = new Uint8Array(cols * rows);
    let next = new Uint8Array(cols * rows);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random() > 0.7 ? 1 : 0;

    const idx = (x: number, y: number) =>
      ((y + rows) % rows) * cols + ((x + cols) % cols);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (t % 3 === 0) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                neighbors += grid[idx(x + dx, y + dy)];
              }
            }
            const i = y * cols + x;
            next[i] =
              (grid[i] && (neighbors === 2 || neighbors === 3)) ||
              (!grid[i] && neighbors === 3)
                ? 1
                : 0;
          }
        }
        [grid, next] = [next, grid];
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (grid[y * cols + x]) {
            const hue = (x * 2 + y * 3 + t * 0.5) % 360;
            ctx.fillStyle = `hsla(${hue},70%,55%,0.7)`;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
          }
        }
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// 21. Pollen Season
// ---------------------------------------------------------------------------
const pollenSeason: EffectDef = {
  name: "Pollen Season",
  description:
    "Golden haze and drifting pollen specks \u2014 Atlanta\u2019s legendary spring rendered as layered noise fog with floating particles.",
  tags: ["noise", "particles", "seasonal"],
  init(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const noise = createNoise2D();
    let animId = 0;
    let t = 0;
    const W = canvas.width;
    const H = canvas.height;

    // Fog layer — quarter resolution
    const scale = 3;
    const bw = Math.ceil(W / scale);
    const bh = Math.ceil(H / scale);
    const buf = document.createElement("canvas");
    buf.width = bw;
    buf.height = bh;
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(bw, bh);

    // Pollen particles — mix of sizes
    const specks = Array.from({ length: 150 }, () => {
      const depth = Math.random(); // 0 = far, 1 = close
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        depth,
        size: 0.8 + depth * 3,
        speed: 0.15 + depth * 0.6,
        drift: (Math.random() - 0.5) * 0.4,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02,
        glowChance: Math.random(),
      };
    });

    const draw = () => {
      // --- Layer 1: golden noise fog ---
      const data = img.data;
      const tt = t * 0.002;

      for (let y = 0; y < bh; y++) {
        const sy = y * scale;
        for (let x = 0; x < bw; x++) {
          const sx = x * scale;
          const n1 = noise(sx * 0.003 + tt, sy * 0.003 + 20) * 0.5;
          const n2 = noise(sx * 0.007 + tt * 1.5, sy * 0.007 + 60) * 0.25;
          const n3 = noise(sx * 0.014 + tt * 2.5, sy * 0.014 + 120) * 0.125;
          const v = Math.max(0, Math.min(1, n1 + n2 + n3 + 0.5));

          const i = (y * bw + x) * 4;
          // Warm golden-green: heavier on R/G, light on B
          data[i] = v * 130;      // R
          data[i + 1] = v * 112;  // G
          data[i + 2] = v * 28;   // B
          data[i + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, W, H);

      // --- Layer 2: floating pollen specks ---
      const windX = Math.sin(t * 0.003) * 0.3 + 0.15; // gentle rightward drift
      const windY = Math.cos(t * 0.002) * 0.1 - 0.05; // slight upward

      for (const s of specks) {
        s.x += (windX + s.drift) * s.speed;
        s.y += (windY + Math.sin(t * s.wobbleSpeed + s.wobblePhase) * 0.3) * s.speed;

        // Wrap around
        if (s.x > W + 10) { s.x = -10; s.y = Math.random() * H; }
        if (s.x < -10) { s.x = W + 10; s.y = Math.random() * H; }
        if (s.y > H + 10) { s.y = -10; s.x = Math.random() * W; }
        if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }

        // Sunlight catch — some particles glow brighter
        const sunCatch = s.glowChance > 0.7
          ? 0.6 + Math.sin(t * 0.02 + s.wobblePhase) * 0.35
          : 0;

        if (sunCatch > 0.1) {
          // Glow halo for bright specks
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 8);
          gr.addColorStop(0, `rgba(255,225,80,${sunCatch * 0.35})`);
          gr.addColorStop(0.4, `rgba(255,200,40,${sunCatch * 0.12})`);
          gr.addColorStop(1, "rgba(255,180,20,0)");
          ctx.fillStyle = gr;
          ctx.fillRect(s.x - s.size * 8, s.y - s.size * 8, s.size * 16, s.size * 16);
        }

        // Core speck
        const alpha = 0.4 + s.depth * 0.5 + sunCatch;
        const lum = 70 + s.depth * 20 + sunCatch * 30;
        ctx.fillStyle = `hsla(48,75%,${Math.min(lum, 95)}%,${Math.min(alpha, 1)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Layer 3: subtle warm vignette overlay ---
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.3, W * 0.1, W * 0.5, H * 0.5, W * 0.7);
      vig.addColorStop(0, "rgba(255,210,60,0.02)");
      vig.addColorStop(0.5, "rgba(200,170,30,0.01)");
      vig.addColorStop(1, "rgba(60,50,10,0.04)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const effects: EffectDef[] = [
  trunkRings,
  flowField,
  aurora,
  plasma,
  constellation,
  unknownPleasures,
  meshGradient,
  particleVortex,
  moireWaves,
  dotGrid,
  fireflies,
  noiseTerrain,
  spiralGalaxy,
  electricArc,
  rain,
  bokeh,
  waveform,
  smoke,
  starfield,
  cellular,
  pollenSeason,
];
