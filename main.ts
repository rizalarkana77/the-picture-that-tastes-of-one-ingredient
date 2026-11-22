// The picture that tastes of one ingredient — a single strawberry, macro.
// Node 22, stdlib only. Renders 1024x1024 RGB PNG to $MAKEFUN_OUTPUT_DIR/entry.png
// (default ./out/entry.png). No network, fully deterministic.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---- deterministic PRNG (mulberry32) ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261122);

// ---- tiny value-noise field for organic texture ----
const PERM = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
function hash2(ix: number, iy: number): number {
  return PERM[(PERM[ix & 255] + iy) & 255] / 255;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const u = smooth(fx), v = smooth(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number): number {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.13 + 7.7, y * 2.13 + 3.1) * 0.3
    + vnoise(x * 4.31 + 13.7, y * 4.31 + 9.4) * 0.15;
}

// ---- helpers ----
const clamp = (v: number, lo = 0, hi = 1) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix3(c1: number[], c2: number[], t: number): number[] {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---- scene layout ----
const CX = 512, CY = 575;          // berry centre
const R = 348;                     // berry radius scale
const TILT = -0.10;                // slight lean, radians
const cosT = Math.cos(TILT), sinT = Math.sin(TILT);

// Berry outline: teardrop, widest at the shoulders, pointed at the bottom.
// r(a): a = angle from centre, -PI/2 = top, +PI/2 = bottom.
function berryRadius(a: number): number {
  const s = Math.sin(a);
  let r = R * (0.82 - 0.38 * s);              // wide shoulders, tapering to a soft tip
  r *= 1 + 0.05 * Math.cos(2 * a);            // shoulder bulge
  r *= 1 - 0.06 * Math.pow(Math.max(0, s), 2); // gentle tip taper, no dent
  return r;
}
// Signed-ish distance: negative inside the berry, ~0 at the edge.
function berryField(x: number, y: number): number {
  let dx = x - CX, dy = y - CY;
  const rx = dx * cosT + dy * sinT, ry = -dx * sinT + dy * cosT;
  const a = Math.atan2(ry, rx);
  const rr = Math.hypot(rx, ry);
  return rr - berryRadius(a);
}

// Seeds: precompute positions in berry-local polar space so they follow the shape.
type Seed = { x: number; y: number; s: number; rot: number; tone: number };
const seeds: Seed[] = [];
{
  for (let ring = 0; ring < 7; ring++) {
    const frac = 0.18 + ring * 0.11;
    const count = Math.round(5 + ring * 2.2);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.55 + (rnd() - 0.5) * 0.16;
      if (ring >= 5 && Math.sin(a) > 0.8) continue; // keep seeds off the crowded tip
      const rr = berryRadius(a) * frac * (0.94 + rnd() * 0.08);
      const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr;
      const x = CX + lx * cosT - ly * sinT;
      const y = CY + lx * sinT + ly * cosT;
      seeds.push({ x, y, s: 6 + rnd() * 2.5, rot: a + Math.PI / 2, tone: rnd() });
    }
  }
}

// Water droplets on the berry.
type Drop = { x: number; y: number; r: number };
const drops: Drop[] = [];
{
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const frac = 0.15 + rnd() * 0.75;
    const rr = berryRadius(a) * frac;
    const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr;
    const x = CX + lx * cosT - ly * sinT;
    const y = CY + lx * sinT + ly * cosT;
    drops.push({ x, y, r: 2.5 + rnd() * 5 });
  }
}

// Calyx leaves: pointed blades fanning from the top of the berry.
type Leaf = { ang: number; len: number; wid: number };
const leaves: Leaf[] = [];
{
  const base = [-1.35, -1.02, -0.68, -0.34, 0, 0.34, 0.68, 1.02, 1.35];
  for (const ang of base) {
    leaves.push({ ang: ang + (rnd() - 0.5) * 0.08, len: 150 + rnd() * 80, wid: 30 + rnd() * 12 });
  }
}
const CALYX = { x: 512, y: 250 }; // calyx hub

// Soft background bokeh spots.
type Bokeh = { x: number; y: number; r: number; warm: number; a: number };
const bokeh: Bokeh[] = [];
{
  for (let i = 0; i < 26; i++) {
    bokeh.push({
      x: rnd() * W, y: rnd() * H,
      r: 14 + rnd() * 46, warm: rnd(), a: 0.05 + rnd() * 0.10,
    });
  }
}

function leafField(x: number, y: number): number {
  // Returns 0..1 coverage of the calyx leaves at (x,y).
  let cov = 0;
  for (const lf of leaves) {
    const dx = x - CALYX.x, dy = y - CALYX.y;
    const ca = Math.cos(-lf.ang), sa = Math.sin(-lf.ang);
    const u = dx * ca - dy * sa;      // along the leaf
    const v = dx * sa + dy * ca;      // across the leaf
    if (u < 0 || u > lf.len) continue;
    const half = lf.wid * Math.sin(Math.PI * clamp(u / lf.len, 0, 1) * 0.82) * (1 - u / lf.len * 0.55) + 2;
    const d = Math.abs(v) / Math.max(half, 1);
    cov = Math.max(cov, clamp(1.15 - d, 0, 1));
  }
  return cov;
}

// ---- render ----
const img = new Uint8Array(W * H * 3);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 3;
    // --- background: dark warm room, soft spotlight behind the berry ---
    const dxc = (x - 512) / 512, dyc = (y - 470) / 512;
    const dCentre = Math.hypot(dxc, dyc);
    const glow = Math.exp(-dCentre * dCentre * 2.6);
    let col = mix3([26, 14, 10], [92, 48, 26], glow * 0.85);
    // vignette
    const vig = 1 - 0.42 * Math.pow(clamp(dCentre, 0, 1.4), 2.2);
    col = col.map(c => c * vig);
    // bokeh
    for (const b of bokeh) {
      const d = Math.hypot(x - b.x, y - b.y) / b.r;
      if (d < 1) {
        const w = b.a * (1 - d * d);
        const bc = b.warm > 0.5 ? [255, 190, 110] : [255, 150, 90];
        col = mix3(col, bc, w);
      }
    }
    // ground shadow under the berry
    const sh = Math.exp(-((Math.pow((x - 512) / 300, 2) + Math.pow((y - 905) / 55, 2)) * 1.6));
    col = mix3(col, [10, 5, 4], sh * 0.55);

    const f = berryField(x, y);
    const leafCov = f > -6 ? leafField(x, y) : 0;

    if (leafCov > 0.02 && f > -40) {
      // --- calyx leaves (drawn over background, under berry edge) ---
      const n = fbm(x * 0.02, y * 0.02);
      // centre vein: darker line down each blade's middle
      let veinDark = 0;
      for (const lf of leaves) {
        const dx = x - CALYX.x, dy = y - CALYX.y;
        const ca = Math.cos(-lf.ang), sa = Math.sin(-lf.ang);
        const u = dx * ca - dy * sa;
        const v = dx * sa + dy * ca;
        if (u < 0 || u > lf.len) continue;
        veinDark = Math.max(veinDark, Math.exp(-Math.pow(v / 3.5, 2)) * clamp(u / 40, 0, 1));
      }
      let leaf = mix3([26, 66, 24], [62, 118, 40], clamp(n * 1.1));
      leaf = mix3(leaf, [14, 42, 16], veinDark * 0.5);
      const edge = clamp((leafCov - 0.02) / 0.25, 0, 1);
      col = mix3(col, leaf, edge);
    }

    if (f < 0) {
      // --- berry body ---
      // approximate surface normal from the field gradient
      const e = 2;
      const gx = berryField(x + e, y) - berryField(x - e, y);
      const gy = berryField(x, y + e) - berryField(x, y - e);
      const gl = Math.hypot(gx, gy) || 1;
      const nx = gx / gl, ny = gy / gl;
      // light from upper-left
      const lx = -0.55, ly = -0.83;
      const diff = clamp(-(nx * lx + ny * ly) * 0.5 + 0.62, 0, 1.15);
      // curvature: shoulders bright, tip deep
      const depth = clamp(-f / 130, 0, 1);
      const n = fbm(x * 0.012 + 3, y * 0.012 + 8);
      const mottle = 0.86 + n * 0.28;

      let base = mix3([198, 16, 28], [152, 8, 22], depth);      // bright red -> deep crimson
      base = mix3(base, [255, 96, 52], Math.pow(clamp(1 - depth, 0, 1), 2.4) * 0.5);
      base = base.map(c => c * mottle);
      let c = base.map(v => v * (0.5 + 0.78 * diff));

      // glossy specular: one soft highlight upper-left, kept small so the red stays rich
      const hx = (x - 395) / 150, hy = (y - 410) / 190;
      const spec = Math.exp(-(hx * hx + hy * hy) * 1.4);
      c = mix3(c, [255, 235, 220], spec * 0.22);
      // second, smaller glint lower-right
      const gx2 = (x - 650) / 110, gy2 = (y - 715) / 150;
      const spec2 = Math.exp(-(gx2 * gx2 + gy2 * gy2) * 1.8);
      c = mix3(c, [255, 210, 190], spec2 * 0.25);

      // rim light on the right edge
      const rim = Math.exp(-Math.pow(clamp(-f / 26, 0, 1) * 1.4, 2)) * clamp(nx * 0.9 + 0.2, 0, 1);
      c = mix3(c, [255, 120, 70], rim * 0.30);

      // seeds: pale golden achenes sitting in dimples
      for (const s of seeds) {
        const dx = x - s.x, dy = y - s.y;
        const ca = Math.cos(-s.rot), sa = Math.sin(-s.rot);
        const u = dx * ca - dy * sa, v = dx * sa + dy * ca;
        const q = (u * u) / (s.s * s.s) + (v * v) / ((s.s * 0.62) * (s.s * 0.62));
        if (q < 1.25) {
          const t = clamp(1.25 - q, 0, 1);
          const dimple = mix3(c, [110, 10, 16], t * 0.4);
          const seedCol = mix3([226, 190, 116], [206, 164, 92], s.tone);
          const seedMask = q < 0.85 ? clamp((0.85 - q) / 0.3, 0, 1) : 0;
          // tiny shadow on the seed's lower edge
          const sh2 = clamp((v / s.s) * 0.5 + 0.4, 0, 1);
          const sc = seedCol.map(vv => vv * (0.82 + 0.18 * sh2));
          c = mix3(dimple, sc, seedMask);
          break;
        }
      }

      // water droplets: bright rim + glint
      for (const d of drops) {
        const dx = x - d.x, dy = y - d.y;
        const q = Math.hypot(dx, dy) / d.r;
        if (q < 1) {
          const rimD = Math.exp(-Math.pow((q - 0.82) * 7, 2));
          c = mix3(c, [255, 246, 235], rimD * 0.45);
          const glint = Math.exp(-(Math.pow((dx + d.r * 0.3) / (d.r * 0.35), 2)
            + Math.pow((dy + d.r * 0.35) / (d.r * 0.35), 2)));
          c = mix3(c, [255, 255, 255], glint * 0.7);
          break;
        }
      }

      // soft edge anti-aliasing against the background:
      // t = 1 deep inside, fading to 0 just outside the outline
      const edgeA = clamp(0.5 - f / 1.6, 0, 1);
      col = mix3(col, c, edgeA);
    }

    img[idx] = clamp(col[0], 0, 255);
    img[idx + 1] = clamp(col[1], 0, 255);
    img[idx + 2] = clamp(col[2], 0, 255);
  }
}

// ---- stem ----
{
  // short green-brown stem rising from the calyx hub
  for (let y = 196; y < 272; y++) {
    const wob = Math.sin((y - 196) * 0.06) * 6;
    const cx = 512 + wob + (y - 196) * 0.12;
    for (let x = Math.floor(cx - 7); x <= Math.ceil(cx + 7); x++) {
      const d = Math.abs(x - cx) / 7;
      if (d > 1) continue;
      const i = (y * W + x) * 3;
      const shade = 0.7 + 0.3 * (1 - d);
      const sc = [74 * shade, 108 * shade, 44 * shade];
      const a = clamp(1.1 - d, 0, 1);
      img[i] = lerp(img[i], sc[0], a);
      img[i + 1] = lerp(img[i + 1], sc[1], a);
      img[i + 2] = lerp(img[i + 2], sc[2], a);
    }
  }
}

// ---- PNG encode (filter 0, zlib level 9) ----
function crc32(buf: Buffer): number {
  let table = (crc32 as any)._t as Int32Array | undefined;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as any)._t = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  raw.set(img.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, png);
console.log(`wrote ${outPath} ${png.length} bytes ${W}x${H}`);
