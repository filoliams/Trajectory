// Draws Trajectory's mark (a rising arc of dots ending in a node) and writes the app's icon PNGs.
// Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GROUND = [0x0b, 0x0b, 0x0f];
const LIME = [0xc6, 0xf4, 0x32];
const WHITE = [0xff, 0xff, 0xff];

/** The mark on a 1024 grid: trail dots along a curve, then the target node and its ring. */
function shapes() {
  const at = (t) => {
    const [x0, y0, cx, cy, x1, y1] = [210, 800, 400, 160, 800, 400];
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
  };
  // Space the trail evenly along the curve's length, not its parameter, so dots don't bunch at the peak.
  const pts = Array.from({ length: 401 }, (_, i) => at(i / 400));
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const atLength = (f) => pts[len.findIndex((l) => l >= f * len[len.length - 1])];
  const dots = [0, 0.14, 0.28, 0.42, 0.56, 0.7].map((f, i) => ({ c: atLength(f), r: 22 + i * 5, a: 0.3 + i * 0.13 }));
  const [ex, ey] = at(1);
  const all = [...dots, { c: [ex, ey], r: 150, ring: 18, a: 0.35 }, { c: [ex, ey], r: 96, a: 1 }];
  // Centre the mark's bounding box on the canvas.
  const box = (k, f) => f(...all.map((s) => s.c[k] + (f === Math.min ? -1 : 1) * (s.r + (s.ring ?? 0) / 2)));
  const [dx, dy] = [0, 1].map((k) => 512 - (box(k, Math.min) + box(k, Math.max)) / 2);
  return all.map((s) => ({ ...s, c: [s.c[0] + dx, s.c[1] + dy] }));
}

/** RGBA pixels. `scale` shrinks the mark about the centre (Android's safe zone; 0 draws only the ground); `bg` false leaves it transparent. */
function render(size, { bg = true, color = LIME, scale = 1 } = {}) {
  const px = new Uint8ClampedArray(size * size * 4);
  const k = size / 1024;
  const list = shapes().map((s) => ({ ...s, c: [(512 + (s.c[0] - 512) * scale) * k, (512 + (s.c[1] - 512) * scale) * k], r: s.r * scale * k, ring: s.ring && s.ring * scale * k }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b, a] = bg ? [...GROUND, 1] : [0, 0, 0, 0];
      for (const s of list) {
        const d = Math.hypot(x + 0.5 - s.c[0], y + 0.5 - s.c[1]);
        const edge = s.ring ? Math.abs(d - s.r) - s.ring / 2 : d - s.r;
        const cover = Math.min(1, Math.max(0, 0.5 - edge)) * s.a;
        if (cover <= 0) continue;
        // Source-over compositing.
        const na = cover + a * (1 - cover);
        [r, g, b] = [0, 1, 2].map((i) => (color[i] * cover + [r, g, b][i] * a * (1 - cover)) / na);
        a = na;
      }
      px.set([r, g, b, a * 255], (y * size + x) * 4);
    }
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(size, px) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) raw.set(px.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = (name, size, opts) => writeFileSync(new URL(`../assets/images/${name}`, import.meta.url), png(size, render(size, opts)));
out('icon.png', 1024, { scale: 0.86 });
out('favicon.png', 96);
out('splash-icon.png', 512, { bg: false });
out('android-icon-foreground.png', 1024, { bg: false, scale: 0.62 });
out('android-icon-background.png', 1024, { scale: 0 });
out('android-icon-monochrome.png', 1024, { bg: false, color: WHITE, scale: 0.62 });
console.log('icons written');
