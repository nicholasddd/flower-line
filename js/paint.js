// Everything visual that is painted onto 2D canvases: the flower atlas,
// bouquet paintings, journal pages, signboards and surface textures.

export const FLOWERS = [
  { key: 'roses',          name: 'Roses',          height: 0.70, tint: '#a3283a', rows: 0, hueVar: 0.03 },
  { key: 'peonies',        name: 'Peonies',        height: 0.80, tint: '#e9a3b4', rows: 0, hueVar: 0.04 },
  { key: 'carnations',     name: 'Carnations',     height: 0.60, tint: '#e78a9e', rows: 1, hueVar: 0.04 },
  { key: 'begonias',       name: 'Begonias',       height: 0.45, tint: '#f0c4cc', rows: 0, hueVar: 0.03 },
  { key: 'daisies',        name: 'Daisies',        height: 0.50, tint: '#e9ecd8', rows: 0, hueVar: 0.00 },
  { key: 'hydrangeas',     name: 'Hydrangeas',     height: 0.90, tint: '#7f8fd0', rows: 0, hueVar: 0.06 },
  { key: 'orchids',        name: 'Orchids',        height: 0.60, tint: '#e3cf5a', rows: 1, hueVar: 0.05 },
  { key: 'lilies',         name: 'Lilies',         height: 0.90, tint: '#e98aa8', rows: 0, hueVar: 0.04 },
  { key: 'chrysanthemums', name: 'Chrysanthemums', height: 0.60, tint: '#efa4b6', rows: 1, hueVar: 0.05 },
  { key: 'ranunculus',     name: 'Ranunculus',     height: 0.50, tint: '#ef8a3a', rows: 1, hueVar: 0.05 },
  { key: 'dahlias',        name: 'Dahlias',        height: 0.90, tint: '#c37ac8', rows: 1, hueVar: 0.06 },
  { key: 'tulips',         name: 'Tulips',         height: 0.55, tint: '#f28a2e', rows: 1, hueVar: 0.30 },
  { key: 'irises',         name: 'Irises',         height: 0.80, tint: '#6a4fb8', rows: 1, hueVar: 0.04 },
  { key: 'azaleas',        name: 'Azaleas',        height: 0.80, tint: '#f2c6d6', rows: 0, hueVar: 0.05 },
  { key: 'sunflowers',     name: 'Sunflowers',     height: 1.75, tint: '#efc028', rows: 1, hueVar: 0.00 },
  { key: 'violets',        name: 'Violets',        height: 0.30, tint: '#6f6cc4', rows: 0, hueVar: 0.05 },
];

export const CELL = 256, COLS = 8, ROWS = 5;

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${Math.max(0, Math.min(100, l))}%,${a})`;
const TAU = Math.PI * 2;

// ---------- brush primitives ----------

function petalPath(ctx, len, wid, tip) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (tip === 'point') {
    ctx.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * 0.6, len, 0);
    ctx.bezierCurveTo(len * 0.75, wid * 0.6, len * 0.3, wid, 0, 0);
  } else if (tip === 'thin') {
    ctx.bezierCurveTo(len * 0.3, -wid, len * 0.92, -wid, len, 0);
    ctx.bezierCurveTo(len * 0.92, wid, len * 0.3, wid, 0, 0);
  } else if (tip === 'frill') {
    ctx.bezierCurveTo(len * 0.2, -wid * 1.1, len * 0.75, -wid, len * 0.9, -wid * 0.8);
    const n = 7;
    for (let i = 0; i <= n; i++) ctx.lineTo(len * (i % 2 ? 0.86 : 1.03), -wid * 0.8 + (1.6 * wid * i) / n);
    ctx.bezierCurveTo(len * 0.75, wid, len * 0.2, wid * 1.1, 0, 0);
  } else {
    ctx.bezierCurveTo(len * 0.2, -wid * 1.1, len * 1.08, -wid * 0.95, len, 0);
    ctx.bezierCurveTo(len * 1.08, wid * 0.95, len * 0.2, wid * 1.1, 0, 0);
  }
  ctx.closePath();
}

function petal(ctx, R, x, y, ang, len, wid, h, s, l, tip = 'round', o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  petalPath(ctx, len, wid, tip);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, hsl(h, s, l + (o.base ?? -14)));
  g.addColorStop(0.55, hsl(h, s, l));
  g.addColorStop(1, hsl(o.tipHue ?? h, s * 0.95, l + (o.tip ?? 6)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = hsl(h, s, l + 14, 0.42);
  ctx.lineWidth = Math.max(1, wid * 0.26);
  ctx.beginPath();
  ctx.moveTo(len * 0.25, -wid * 0.2 * (R() - 0.5));
  ctx.quadraticCurveTo(len * 0.6, -wid * 0.32, len * 0.86, -wid * 0.08);
  ctx.stroke();
  if (o.edge) {
    ctx.strokeStyle = o.edge;
    ctx.lineWidth = Math.max(1, wid * 0.1);
    petalPath(ctx, len, wid, tip);
    ctx.stroke();
  }
  if (o.vein) {
    ctx.strokeStyle = o.vein;
    ctx.lineWidth = Math.max(1, wid * 0.11);
    ctx.beginPath();
    ctx.moveTo(len * 0.08, 0);
    ctx.lineTo(len * 0.72, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function leaf(ctx, R, x, y, ang, len, wid, h = 108, s = 38, l = 32, tip = 'point') {
  petal(ctx, R, x, y, ang, len, wid, h + R() * 14 - 7, s, l + R() * 8 - 4, tip, {
    base: -8, tip: 8, vein: hsl(h, s - 10, l + 14, 0.45),
  });
}

function stem(ctx, x0, y0, x1, y1, w, bend = 0, col) {
  ctx.strokeStyle = col || hsl(105, 36, 28);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
  ctx.stroke();
  ctx.strokeStyle = hsl(95, 40, 44, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.35);
  ctx.beginPath();
  ctx.moveTo(x0 - w * 0.2, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + bend - w * 0.2, (y0 + y1) / 2, x1 - w * 0.2, y1);
  ctx.stroke();
}

function dab(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function radial(ctx, R, cx, cy, n, len, wid, h, s, l, tip, o = {}) {
  const off = o.off ?? R() * TAU;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU + (R() - 0.5) * (o.jit ?? 0.15);
    petal(ctx, R, cx, cy, a, len * (1 - (o.lenJit ?? 0.15) * R()), wid,
      h + (R() - 0.5) * (o.hj ?? 6), s, l + (R() - 0.5) * (o.lj ?? 8), tip, o);
  }
}

function squash(ctx, cx, cy, sy, fn) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, sy);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

// Short translucent strokes clipped to what is already painted, so flat
// fills read as brushwork.
function brushTexture(ctx, R, x0, y0, w, h, n = 260, scale = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * w, y = y0 + R() * h;
    const a = R() * TAU, len = (4 + R() * 12) * scale;
    ctx.strokeStyle = R() < 0.5 ? `rgba(255,248,235,${0.05 + R() * 0.07})` : `rgba(30,10,30,${0.05 + R() * 0.08})`;
    ctx.lineWidth = (1.5 + R() * 3) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- the sixteen flowers ----------
// Each draws into a 256x256 cell; the ground line is y = 256.

const DRAW = {
  roses(ctx, R, v) {
    const heads = v ? [[100, 78, 1], [165, 112, 0.7]] : [[128 + (R() - 0.5) * 20, 72, 1]];
    for (const [cx, cy, k] of heads) {
      stem(ctx, 128 + (cx - 128) * 0.3, 256, cx, cy + 18 * k, 5, (R() - 0.5) * 30);
    }
    for (let i = 0; i < 5; i++) {
      const y = 140 + i * 22;
      leaf(ctx, R, 128 + (i % 2 ? 6 : -6), y, (i % 2 ? -0.6 : Math.PI + 0.6) + (R() - 0.5) * 0.3, 30, 12, 112, 40, 28);
    }
    for (const [cx, cy, k] of heads) {
      const h = 352 + (R() - 0.5) * 10;
      squash(ctx, cx, cy, 0.86, () => {
        radial(ctx, R, cx, cy, 7, 44 * k, 28 * k, h, 72, 34, 'round');
        radial(ctx, R, cx, cy, 5, 30 * k, 22 * k, h, 74, 41, 'round');
        dab(ctx, cx, cy, 19 * k, hsl(h, 70, 38));
        ctx.lineCap = 'round';
        ctx.strokeStyle = hsl(h, 75, 22, 0.8);
        ctx.lineWidth = 3 * k;
        for (let r = 18; r > 3; r -= 4) {
          ctx.beginPath();
          const a0 = R() * TAU;
          ctx.arc(cx + (R() - 0.5) * 3, cy + (R() - 0.5) * 3, r * k, a0, a0 + 3.6);
          ctx.stroke();
        }
        ctx.strokeStyle = hsl(h, 60, 58, 0.5);
        ctx.lineWidth = 2;
        for (let r = 20; r > 5; r -= 5) {
          ctx.beginPath();
          const a0 = R() * TAU;
          ctx.arc(cx, cy, r * k, a0, a0 + 1.8);
          ctx.stroke();
        }
      });
    }
  },

  peonies(ctx, R, v) {
    const cx = 128 + (R() - 0.5) * 16, cy = 84;
    stem(ctx, 128, 256, cx, cy + 30, 6, (R() - 0.5) * 20);
    for (let i = 0; i < 6; i++) {
      const y = 150 + i * 17, side = i % 2 ? 1 : -1;
      for (let j = -1; j <= 1; j++) leaf(ctx, R, 128, y, (side > 0 ? -0.5 : Math.PI + 0.5) + j * 0.35, 34, 11, 115, 34, 30);
    }
    const h = v ? 338 : 350, l0 = v ? 70 : 78;
    squash(ctx, cx, cy, 0.82, () => {
      radial(ctx, R, cx, cy, 9, 60, 34, h, 60, l0 - 4, 'round');
      radial(ctx, R, cx, cy, 8, 47, 28, h, 62, l0, 'round');
      radial(ctx, R, cx, cy, 7, 34, 22, h, 60, l0 + 4, 'frill');
      for (let i = 0; i < 14; i++) {
        petal(ctx, R, cx + (R() - 0.5) * 18, cy + (R() - 0.5) * 14, R() * TAU, 16 + R() * 6, 10, h, 58, l0 + 6, 'frill');
      }
      dab(ctx, cx - 6, cy - 8, 9, hsl(h, 70, 92, 0.35));
    });
  },

  carnations(ctx, R, v) {
    const heads = [[86 + R() * 10, 86], [150, 60 + R() * 10], [176, 118]];
    for (const [x, y] of heads) stem(ctx, 128 + (x - 128) * 0.2, 256, x, y + 18, 3.5, (R() - 0.5) * 20, hsl(150, 22, 42));
    for (let i = 0; i < 6; i++) leaf(ctx, R, 128 + (R() - 0.5) * 20, 160 + i * 14, i % 2 ? -1.1 : Math.PI + 1.1, 36, 5, 150, 22, 44);
    const h = v ? 352 : 340, l = v ? 58 : 74;
    for (const [x, y] of heads) {
      petal(ctx, R, x, y + 24, -Math.PI / 2, 22, 7, 140, 30, 40, 'round');
      squash(ctx, x, y, 0.8, () => {
        radial(ctx, R, x, y, 11, 27, 14, h, 64, l, 'frill', { edge: hsl(h, 70, l - 18, 0.5) });
        radial(ctx, R, x, y, 7, 17, 11, h, 66, l + 6, 'frill');
      });
    }
  },

  begonias(ctx, R, v) {
    for (let i = 0; i < 9; i++) {
      leaf(ctx, R, 128 + (R() - 0.5) * 90, 200 + R() * 40, -Math.PI / 2 + (R() - 0.5) * 2.2, 46, 26, 118, 36, 26, 'round');
    }
    const heads = [[96, 132], [150, 118], [176, 150], [122, 160]];
    for (const [x, y] of heads) {
      stem(ctx, x, 220, x, y + 8, 3, 0, hsl(350, 40, 40));
      const h = v ? 6 : 345;
      squash(ctx, x, y, 0.82, () => {
        radial(ctx, R, x, y, 6, 24, 17, h, 52, v ? 76 : 86, 'round');
        radial(ctx, R, x, y, 5, 14, 11, h, 56, v ? 82 : 90, 'round');
        dab(ctx, x, y, 4, hsl(48, 90, 58));
      });
    }
  },

  daisies(ctx, R, v) {
    const heads = [];
    const n = v ? 4 : 3;
    for (let i = 0; i < n; i++) heads.push([60 + (i / (n - 1)) * 136 + (R() - 0.5) * 16, 56 + R() * 70]);
    for (const [x, y] of heads) stem(ctx, 128 + (x - 128) * 0.3, 256, x, y + 6, 3, (R() - 0.5) * 24);
    for (let i = 0; i < 6; i++) leaf(ctx, R, 128 + (R() - 0.5) * 40, 214 + R() * 30, -Math.PI / 2 + (R() - 0.5) * 2, 30, 7, 100, 36, 34);
    for (const [x, y] of heads) {
      squash(ctx, x, y, 0.78, () => {
        radial(ctx, R, x, y, 18, 31, 5.5, 48, 18, 95, 'thin', { base: -16, tip: 2, lj: 4 });
        dab(ctx, x, y, 9, hsl(44, 92, 52));
        for (let i = 0; i < 10; i++) {
          const a = R() * TAU, r = R() * 7;
          dab(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6, hsl(34, 90, 38, 0.8));
        }
      });
    }
  },

  hydrangeas(ctx, R, v) {
    for (let i = 0; i < 8; i++) {
      leaf(ctx, R, 128 + (R() - 0.5) * 70, 180 + R() * 50, -Math.PI / 2 + (R() - 0.5) * 2.6, 54, 24, 120, 40, 26);
    }
    const cx = 128, cy = 98, r0 = 62;
    const h0 = v ? 285 : 228;
    for (let i = 0; i < 90; i++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * r0;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.82;
      const shade = ((y - cy) / r0) * 12;
      squash(ctx, x, y, 0.85, () => {
        radial(ctx, R, x, y, 4, 10, 8, h0 + R() * 30, 46, 72 - shade + (R() - 0.5) * 8, 'round', { lenJit: 0.1 });
        dab(ctx, x, y, 1.6, hsl(h0, 30, 90));
      });
    }
  },

  orchids(ctx, R, v) {
    for (let i = 0; i < 3; i++) leaf(ctx, R, 110 + i * 10, 240, -Math.PI / 2 + (i - 1) * 0.9, 70, 16, 112, 40, 30, 'round');
    ctx.strokeStyle = hsl(100, 30, 30);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(110, 250);
    ctx.bezierCurveTo(100, 140, 140, 40, 200, 50);
    ctx.stroke();
    const spots = [[124, 120], [150, 68], [192, 58]];
    const h = v ? 320 : 50, l = v ? 82 : 66;
    for (const [x, y] of spots) {
      const k = 0.9 + R() * 0.2;
      for (const a of [-Math.PI / 2, Math.PI * 0.82, Math.PI * 0.18]) petal(ctx, R, x, y, a, 30 * k, 12 * k, h, 80, l, 'round', { vein: hsl(320, 60, 45, 0.6) });
      for (const a of [Math.PI * 1.08, -0.08]) petal(ctx, R, x, y, a, 27 * k, 17 * k, h, 82, l + 4, 'round', { vein: hsl(320, 60, 45, 0.5) });
      petal(ctx, R, x, y + 2, Math.PI / 2, 22 * k, 13 * k, 305, 55, 44, 'round');
      dab(ctx, x, y, 4, hsl(50, 30, 96));
    }
  },

  lilies(ctx, R, v) {
    stem(ctx, 128, 256, 120, 96, 5, -10);
    stem(ctx, 124, 170, 178, 56, 3, 10);
    for (let i = 0; i < 7; i++) leaf(ctx, R, 124, 130 + i * 17, (i % 2 ? -0.9 : Math.PI + 0.9), 36, 7, 108, 38, 30);
    const h = 338, l = v ? 84 : 72;
    const cx = 116, cy = 84;
    squash(ctx, cx, cy, 0.8, () => {
      radial(ctx, R, cx, cy, 6, 58, 18, h, 66, l, 'point', { base: -4, tip: 10, vein: hsl(h, 70, l - 22, 0.6), jit: 0.1 });
      for (let i = 0; i < 26; i++) {
        const a = R() * TAU, r = 8 + R() * 22;
        dab(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4 + R(), hsl(345, 70, 34, 0.8));
      }
      ctx.strokeStyle = hsl(90, 30, 70);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.4, x = cx + Math.cos(a) * 34, y = cy + Math.sin(a) * 34;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        dab(ctx, x, y, 3, hsl(24, 85, 42));
      }
    });
    petal(ctx, R, 178, 56, -Math.PI / 2 - 0.3, 34, 9, h, 50, 80, 'point');
  },

  chrysanthemums(ctx, R, v) {
    const cx = 128, cy = 84;
    stem(ctx, 128, 256, cx, cy + 30, 4.5, (R() - 0.5) * 20);
    for (let i = 0; i < 6; i++) {
      const y = 150 + i * 17;
      leaf(ctx, R, 128, y, i % 2 ? -0.6 : Math.PI + 0.6, 30, 13, 120, 30, 30);
    }
    const h = v ? 330 : 346, l = v ? 70 : 78;
    squash(ctx, cx, cy, 0.8, () => {
      radial(ctx, R, cx, cy, 34, 52, 6.5, h, 62, l - 4, 'thin', { jit: 0.06, lenJit: 0.12 });
      radial(ctx, R, cx, cy, 28, 41, 6, h, 64, l, 'thin', { jit: 0.06 });
      radial(ctx, R, cx, cy, 22, 29, 5.5, h, 66, l + 4, 'thin', { jit: 0.06 });
      radial(ctx, R, cx, cy, 14, 16, 5, h, 66, l + 8, 'thin');
      dab(ctx, cx, cy, 5, hsl(h, 50, l + 10));
    });
  },

  ranunculus(ctx, R, v) {
    const heads = v ? [[100, 96], [168, 120]] : [[128, 86]];
    for (const [x, y] of heads) stem(ctx, 128 + (x - 128) * 0.3, 256, x, y + 24, 4, (R() - 0.5) * 20);
    for (let i = 0; i < 6; i++) leaf(ctx, R, 128 + (R() - 0.5) * 30, 170 + i * 13, i % 2 ? -0.8 : Math.PI + 0.8, 30, 12, 112, 36, 32);
    for (const [x, y] of heads) {
      const k = v ? 0.78 : 1;
      const h = v ? 12 : 26;
      squash(ctx, x, y, 0.8, () => {
        for (let r = 48; r > 5; r -= 5) {
          const rr = r * k, t = (48 - r) / 48;
          dab(ctx, x, y, rr, hsl(h + t * 8, 88, 46 + t * 22));
          ctx.strokeStyle = hsl(h, 80, 32 + t * 20, 0.65);
          ctx.lineWidth = 1.6;
          const segs = Math.max(4, Math.floor(r / 4));
          for (let i = 0; i < segs; i++) {
            const a0 = R() * TAU;
            ctx.beginPath();
            ctx.arc(x, y, rr - 1, a0, a0 + 0.8);
            ctx.stroke();
          }
        }
        dab(ctx, x, y, 4 * k, hsl(90, 50, 40));
      });
    }
  },

  dahlias(ctx, R, v) {
    const cx = 128, cy = 80;
    stem(ctx, 128, 256, cx, cy + 30, 5, (R() - 0.5) * 20);
    for (let i = 0; i < 6; i++) leaf(ctx, R, 128, 150 + i * 17, i % 2 ? -0.5 : Math.PI + 0.5, 34, 13, 115, 36, 28);
    const h = v ? 330 : 302;
    squash(ctx, cx, cy, 0.82, () => {
      radial(ctx, R, cx, cy, 16, 58, 13, h, 52, 64, 'point', { tip: 22, jit: 0.04, off: 0 });
      radial(ctx, R, cx, cy, 14, 45, 12, h, 54, 66, 'point', { tip: 22, jit: 0.04, off: 0.2 });
      radial(ctx, R, cx, cy, 12, 32, 10, h, 56, 70, 'point', { tip: 20, jit: 0.04, off: 0.1 });
      radial(ctx, R, cx, cy, 10, 19, 8, h, 56, 74, 'point', { tip: 16, off: 0.3 });
      dab(ctx, cx, cy, 5, hsl(50, 80, 56));
    });
  },

  tulips(ctx, R, v) {
    const heads = [[102, 92], [158, 76]];
    for (const [x, y] of heads) stem(ctx, x + (128 - x) * 0.3, 256, x, y + 30, 5, (R() - 0.5) * 10, hsl(110, 30, 38));
    for (let i = 0; i < 4; i++) leaf(ctx, R, 100 + i * 18, 256, -Math.PI / 2 + (i - 1.5) * 0.35, 120 + R() * 30, 15, 120, 26, 40);
    const h = v ? 352 : 26;
    for (const [x, y] of heads) {
      const by = y + 34;
      petal(ctx, R, x, by, -Math.PI / 2 - 0.3, 58, 22, h, 90, 46, 'round', { tipHue: h + 18, tip: 12 });
      petal(ctx, R, x, by, -Math.PI / 2 + 0.3, 58, 22, h, 90, 46, 'round', { tipHue: h + 18, tip: 12 });
      petal(ctx, R, x, by, -Math.PI / 2, 62, 24, h, 92, 54, 'round', { tipHue: h + 20, tip: 14 });
    }
  },

  irises(ctx, R, v) {
    for (let i = 0; i < 5; i++) leaf(ctx, R, 100 + i * 14, 256, -Math.PI / 2 + (i - 2) * 0.12, 150 + R() * 40, 8, 120, 30, 36);
    const cx = 128, cy = 72;
    stem(ctx, 128, 256, cx, cy + 20, 4);
    const h = v ? 250 : 266;
    for (const a of [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9, Math.PI / 2]) {
      petal(ctx, R, cx, cy + 6, a, 44, 22, h, 58, 44, 'round', { vein: hsl(48, 95, 60, 0.9), tip: 10 });
    }
    for (const a of [-Math.PI / 2, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45]) {
      petal(ctx, R, cx, cy, a, 40, 17, h, 52, 60, 'round', { tip: 10 });
    }
  },

  azaleas(ctx, R, v) {
    for (let i = 0; i < 46; i++) {
      const a = R() * TAU, rx = R() * 100, ry = R() * 60;
      leaf(ctx, R, 128 + Math.cos(a) * rx, 172 + Math.sin(a) * ry, R() * TAU, 22, 9, 120, 38, 24);
    }
    const h = v ? 342 : 332;
    for (let i = 0; i < 8; i++) {
      const x = 40 + R() * 176, y = 100 + R() * 80;
      squash(ctx, x, y, 0.85, () => {
        radial(ctx, R, x, y, 5, 22, 13, h, 56, v ? 70 : 86, 'round', { base: -12 });
        for (let j = 0; j < 7; j++) dab(ctx, x + (R() - 0.5) * 10, y - 4 - R() * 8, 1.2, hsl(330, 70, 50, 0.8));
        ctx.strokeStyle = hsl(h, 60, 70);
        ctx.lineWidth = 1;
        for (let j = 0; j < 5; j++) {
          const a = -Math.PI / 2 + (j - 2) * 0.3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12 - 6, x + Math.cos(a) * 20, y + Math.sin(a) * 20);
          ctx.stroke();
        }
      });
    }
  },

  sunflowers(ctx, R, v) {
    const cx = 128 + (R() - 0.5) * 10, cy = 62;
    stem(ctx, 128, 256, cx, cy + 20, 8, (R() - 0.5) * 16, hsl(95, 36, 32));
    for (let i = 0; i < 4; i++) {
      leaf(ctx, R, 128, 130 + i * 30, i % 2 ? -0.7 : Math.PI + 0.7, 50, 26, 95, 40, 32, 'round');
    }
    squash(ctx, cx, cy, 0.86, () => {
      radial(ctx, R, cx, cy, 22, 58, 12, 46, 95, 52, 'point', { lj: 10, jit: 0.08 });
      radial(ctx, R, cx, cy, 18, 46, 11, 44, 95, 58, 'point', { lj: 10, off: 0.17 });
      dab(ctx, cx, cy, 30, hsl(26, 52, 16));
      dab(ctx, cx, cy, 22, hsl(28, 50, 24));
      for (let i = 0; i < 110; i++) {
        const a = i * 2.39996, r = Math.sqrt(i / 110) * 27;
        dab(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4, hsl(36, 60, 34 + R() * 12, 0.85));
      }
      dab(ctx, cx - 8, cy - 9, 7, 'rgba(255,220,150,0.12)');
    });
  },

  violets(ctx, R, v) {
    for (let i = 0; i < 12; i++) {
      leaf(ctx, R, 128 + (R() - 0.5) * 110, 240, -Math.PI / 2 + (R() - 0.5) * 2, 30 + R() * 14, 16, 120, 34, 28, 'round');
    }
    const h = v ? 280 : 256;
    for (let i = 0; i < 6; i++) {
      const x = 60 + R() * 136, y = 168 + R() * 44;
      stem(ctx, x, 245, x, y + 4, 2, (R() - 0.5) * 10);
      squash(ctx, x, y, 0.9, () => {
        radial(ctx, R, x, y, 5, 14, 9, h, 55, 56, 'round', { vein: hsl(h, 50, 30, 0.6) });
        dab(ctx, x, y, 3.4, hsl(0, 0, 96));
        dab(ctx, x, y, 1.6, hsl(48, 95, 55));
      });
    }
  },
};

function drawGrass(ctx, R, v) {
  const n = 22 + Math.floor(R() * 10);
  for (let i = 0; i < n; i++) {
    const x = 128 + (R() - 0.5) * 170, top = 70 + R() * 130;
    const bend = (R() - 0.5) * 60;
    const w = 2 + R() * 4;
    ctx.fillStyle = hsl(80 + R() * 40, 30 + R() * 20, 24 + R() * 22);
    ctx.beginPath();
    ctx.moveTo(x - w, 256);
    ctx.quadraticCurveTo(x - w * 0.5 + bend * 0.5, (256 + top) / 2, x + bend, top);
    ctx.quadraticCurveTo(x + w * 0.5 + bend * 0.5, (256 + top) / 2, x + w, 256);
    ctx.fill();
  }
  if (v % 3 === 0) {
    for (let i = 0; i < 4; i++) dab(ctx, 128 + (R() - 0.5) * 150, 120 + R() * 80, 2.5, hsl(50, 30, 92, 0.9));
  }
}

export function buildAtlas() {
  const c = document.createElement('canvas');
  c.width = CELL * COLS;
  c.height = CELL * ROWS;
  const ctx = c.getContext('2d');
  const pad = 6;
  const drawCell = (index, fn) => {
    const col = index % COLS, row = Math.floor(index / COLS);
    ctx.save();
    ctx.translate(col * CELL, row * CELL);
    ctx.beginPath();
    ctx.rect(pad, pad, CELL - pad * 2, CELL - pad);
    ctx.clip();
    // shrink slightly so nothing touches the neighbouring cells
    ctx.translate(CELL / 2, CELL);
    ctx.scale((CELL - pad * 2) / CELL, (CELL - pad) / CELL);
    ctx.translate(-CELL / 2, -CELL);
    fn();
    ctx.restore();
  };
  FLOWERS.forEach((f, t) => {
    for (let v = 0; v < 2; v++) {
      const R = rng(1000 + t * 17 + v * 5);
      drawCell(t * 2 + v, () => DRAW[f.key](ctx, R, v));
    }
  });
  for (let v = 0; v < 8; v++) {
    const R = rng(5000 + v * 13);
    drawCell(32 + v, () => drawGrass(ctx, R, v));
  }
  const R = rng(99);
  brushTexture(ctx, R, 0, 0, c.width, c.height, 26000, 1);
  return c;
}

// Crop of one atlas cell (bloom end only when `bloomOnly`).
export function cellRect(index) {
  return { x: (index % COLS) * CELL, y: Math.floor(index / COLS) * CELL, w: CELL, h: CELL };
}

// ---------- surfaces ----------

export function brushCanvas(base, { size = 256, n = 900, spread = 10, len = 18, width = 5, angle = null, seed = 1, grain = 0.04 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const R = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.fillStyle = base;
  const m = /^#(..)(..)(..)$/.exec(tmp.fillStyle);
  const [r0, g0, b0] = m ? m.slice(1).map((x) => parseInt(x, 16)) : [128, 128, 128];
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const d = (R() - 0.5) * 2 * spread;
    const x = R() * size, y = R() * size;
    const a = angle == null ? R() * TAU : angle + (R() - 0.5) * 0.3;
    const l = len * (0.5 + R());
    ctx.strokeStyle = `rgba(${r0 + d | 0},${g0 + d * 0.9 | 0},${b0 + d * 0.8 | 0},${0.35 + R() * 0.4})`;
    ctx.lineWidth = width * (0.5 + R());
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (x + ox < -l || x + ox > size + l || y + oy < -l || y + oy > size + l) continue;
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  if (grain) {
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const g = (R() - 0.5) * 255 * grain;
      img.data[i] += g; img.data[i + 1] += g; img.data[i + 2] += g;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

export function paperCanvas(size = 512, seed = 3, base = '#efe6d2') {
  const c = brushCanvas(base, { size, n: 1400, spread: 6, len: 26, width: 6, seed, grain: 0.05 });
  const ctx = c.getContext('2d');
  const R = rng(seed + 1);
  ctx.strokeStyle = 'rgba(120,100,70,0.08)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 180; i++) {
    const x = R() * size, y = R() * size, a = R() * TAU, l = 4 + R() * 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return c;
}

// Grey paper grain used by the painterly post pass.
export function grainCanvas(size = 256, seed = 11) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const R = rng(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128 + (R() - 0.5) * 90;
    img.data[i + 1] = 128 + (R() - 0.5) * 90;
    img.data[i + 2] = 128 + (R() - 0.5) * 50;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.5;
  ctx.filter = 'blur(1.5px)';
  ctx.drawImage(c, 0, 0);
  ctx.filter = 'none';
  ctx.lineCap = 'round';
  for (let i = 0; i < 500; i++) {
    const x = R() * size, y = R() * size, a = R() * TAU, l = 6 + R() * 20;
    const v = R() < 0.5 ? 150 : 106;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.25)`;
    ctx.lineWidth = 1 + R() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return c;
}

export function signCanvas(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const ctx = c.getContext('2d');
  const wood = brushCanvas('#e8dcc2', { size: 512, n: 900, spread: 12, len: 60, width: 5, angle: 0, seed: text.length * 7 });
  ctx.drawImage(wood, 0, 0, 512, 512, 0, 0, 512, 160);
  ctx.strokeStyle = '#3e5a4a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = '#2f4a3c';
  ctx.font = '86px "Caveat", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 86);
  return c;
}

// ---------- bouquets, journal pages ----------

export const BOUQUETS = [
  { name: 'Morning Platform', flowers: ['peonies', 'ranunculus', 'daisies'], paper: '#e9d6c0', ribbon: '#c46a5a', price: '฿2,400', note: 'peonies, ranunculus, field daisies' },
  { name: 'Window Seat', flowers: ['roses', 'carnations', 'roses'], paper: '#d9c9b6', ribbon: '#7a2232', price: '฿1,900', note: 'garden roses, carnations' },
  { name: 'Last Light', flowers: ['sunflowers', 'chrysanthemums', 'dahlias'], paper: '#c8a57c', ribbon: '#3f5d48', price: '฿2,200', note: 'sunflowers, mums, dahlias' },
  { name: 'Night Train', flowers: ['irises', 'hydrangeas', 'violets'], paper: '#2f3550', ribbon: '#d8c08a', price: '฿2,600', note: 'irises, hydrangea, violets' },
  { name: 'Passing Orchard', flowers: ['tulips', 'azaleas', 'tulips'], paper: '#f0e2d6', ribbon: '#e08a3a', price: '฿1,800', note: 'tulips, azaleas' },
  { name: 'Sleeper Car', flowers: ['lilies', 'orchids', 'begonias'], paper: '#e6e0ec', ribbon: '#8a6aa8', price: '฿3,200', note: 'lilies, orchids, begonias' },
  { name: 'Slow Rain', flowers: ['hydrangeas', 'begonias', 'daisies'], paper: '#c9d6d8', ribbon: '#5a7a8a', price: '฿2,100', note: 'hydrangea, begonias, daisies' },
  { name: 'The Long Way Home', flowers: ['daisies', 'ranunculus', 'chrysanthemums', 'violets'], paper: '#d8cdb0', ribbon: '#a0583a', price: '฿2,000', note: 'whatever the fields gave us' },
];

const keyIndex = (k) => FLOWERS.findIndex((f) => f.key === k);

export function drawBouquet(ctx, atlas, b, cx, cy, size, seed) {
  const R = rng(seed);
  const s = size;
  // stems below the binding
  ctx.strokeStyle = '#4f6a3a';
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    ctx.moveTo(cx + (R() - 0.5) * s * 0.05, cy + s * 0.2);
    ctx.lineTo(cx + (R() - 0.5) * s * 0.16, cy + s * 0.48);
    ctx.stroke();
  }
  // back paper
  ctx.fillStyle = b.paper;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.32);
  ctx.lineTo(cx - s * 0.42, cy - s * 0.18);
  ctx.lineTo(cx - s * 0.18, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.2, cy - s * 0.32);
  ctx.lineTo(cx + s * 0.44, cy - s * 0.14);
  ctx.closePath();
  ctx.fill();
  // foliage
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.6;
    leaf(ctx, R, cx, cy, a, s * (0.26 + R() * 0.1), s * 0.05, 110, 34, 30);
  }
  // blooms in a dome, back to front
  const spots = [];
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.3;
    const r = s * (0.06 + R() * 0.17);
    spots.push({ x: cx + Math.cos(a) * r * 1.3, y: cy - s * 0.06 + Math.sin(a) * r, f: b.flowers[i % b.flowers.length], v: R() < 0.5 ? 0 : 1 });
  }
  spots.sort((p, q) => p.y - q.y);
  for (const p of spots) {
    const cell = cellRect(keyIndex(p.f) * 2 + p.v);
    const bw = s * 0.4;
    // only the top part of the cell holds the bloom
    const crop = p.f === 'violets' || p.f === 'begonias' || p.f === 'azaleas' ? [40, 100, 180, 150] : [20, 4, 216, 176];
    ctx.drawImage(atlas, cell.x + crop[0], cell.y + crop[1], crop[2], crop[3], p.x - bw / 2, p.y - bw * 0.45, bw, bw * crop[3] / crop[2]);
  }
  // front wrap
  const g = ctx.createLinearGradient(cx - s * 0.3, 0, cx + s * 0.3, 0);
  g.addColorStop(0, shadeHex(b.paper, -0.18));
  g.addColorStop(0.5, b.paper);
  g.addColorStop(1, shadeHex(b.paper, -0.1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.34);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.02);
  ctx.quadraticCurveTo(cx, cy + s * 0.08, cx + s * 0.32, cy - s * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = s * 0.004;
  ctx.stroke();
  // ribbon
  ctx.fillStyle = b.ribbon;
  const by = cy + s * 0.2;
  ctx.fillRect(cx - s * 0.07, by - s * 0.014, s * 0.14, s * 0.028);
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + d * s * 0.05, by - s * 0.012, s * 0.05, s * 0.024, d * 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.quadraticCurveTo(cx + d * s * 0.03, by + s * 0.08, cx + d * s * 0.06, by + s * 0.14);
    ctx.lineTo(cx + d * s * 0.075, by + s * 0.13);
    ctx.quadraticCurveTo(cx + d * s * 0.04, by + s * 0.07, cx + d * s * 0.01, by);
    ctx.fill();
  }
  brushTexture(ctx, R, cx - s * 0.5, cy - s * 0.5, s, s, 1800, s / 600);
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (x) => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export const PAGE_W = 800, PAGE_H = 1100;

function pageBase(seed, left) {
  const c = document.createElement('canvas');
  c.width = PAGE_W; c.height = PAGE_H;
  const ctx = c.getContext('2d');
  const p = paperCanvas(512, seed, '#f1e8d4');
  ctx.drawImage(p, 0, 0, PAGE_W, PAGE_H);
  // gutter shadow toward the spine
  const g = ctx.createLinearGradient(left ? PAGE_W : 0, 0, left ? PAGE_W - 120 : 120, 0);
  g.addColorStop(0, 'rgba(70,50,30,0.28)');
  g.addColorStop(1, 'rgba(70,50,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { c, ctx };
}

function pressed(ctx, atlas, key, x, y, w, rot, seed) {
  const i = keyIndex(key);
  const cell = cellRect(i * 2 + (seed % 2));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = 0.85;
  ctx.filter = 'saturate(0.7) sepia(0.25)';
  ctx.drawImage(atlas, cell.x, cell.y, CELL, CELL, -w / 2, -w / 2, w, w);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  // a strip of tape over the stem
  ctx.fillStyle = 'rgba(235,225,200,0.75)';
  ctx.rotate(0.3);
  ctx.fillRect(-w * 0.18, w * 0.18, w * 0.36, w * 0.1);
  ctx.restore();
}

export function buildPages(atlas) {
  const pages = [];
  // 0: inside cover, an endpaper
  {
    const c = document.createElement('canvas');
    c.width = PAGE_W; c.height = PAGE_H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2f4a3e';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    const R = rng(77);
    for (let i = 0; i < 70; i++) {
      const x = R() * PAGE_W, y = R() * PAGE_H;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(R() * TAU);
      ctx.globalAlpha = 0.22;
      radial(ctx, R, 0, 0, 5, 18, 10, 40, 40, 80, 'round');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const { c: plate, ctx: p } = pageBase(5, false);
    ctx.drawImage(plate, 0, 0, 512, 400, 90, 370, 620, 270);
    ctx.strokeStyle = 'rgba(214,180,110,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(104, 384, 592, 242);
    ctx.fillStyle = '#3a2e22';
    ctx.textAlign = 'center';
    ctx.font = '62px "Pinyon Script", cursive';
    ctx.fillText('Pressed along the line', PAGE_W / 2, 495);
    ctx.font = '34px "Caveat", cursive';
    ctx.fillStyle = '#5a4a3a';
    ctx.fillText('bouquets we have made, and kept', PAGE_W / 2, 565);
    void p;
    brushTexture(ctx, R, 0, 0, PAGE_W, PAGE_H, 3000, 1.6);
    pages.push(c);
  }
  BOUQUETS.forEach((b, i) => {
    const left = (i + 1) % 2 === 0;
    const { c, ctx } = pageBase(20 + i, left);
    drawBouquet(ctx, atlas, b, PAGE_W / 2, 480, 760, 300 + i);
    ctx.fillStyle = '#2e2620';
    ctx.textAlign = 'center';
    ctx.font = '78px "Pinyon Script", cursive';
    ctx.fillText(b.name, PAGE_W / 2, 900);
    ctx.font = '36px "Caveat", cursive';
    ctx.fillStyle = '#5b4b3b';
    ctx.fillText(`${b.note}  ·  from ${b.price}`, PAGE_W / 2, 960);
    pressed(ctx, atlas, b.flowers[0], left ? 120 : PAGE_W - 120, 120, 150, left ? -0.4 : 0.5, i);
    pages.push(c);
  });
  {
    const { c, ctx } = pageBase(90, false);
    pressed(ctx, atlas, 'violets', 400, 380, 260, 0.2, 1);
    pressed(ctx, atlas, 'daisies', 250, 250, 160, -0.6, 0);
    ctx.fillStyle = '#2e2620';
    ctx.textAlign = 'center';
    ctx.font = '60px "Pinyon Script", cursive';
    ctx.fillText('Or let us choose', PAGE_W / 2, 720);
    ctx.font = '36px "Caveat", cursive';
    ctx.fillStyle = '#5b4b3b';
    ctx.fillText('the envelope on the table is for that', PAGE_W / 2, 785);
    pages.push(c);
  }
  return pages;
}
