/**
 * Генератор иконок ШАРОБОЯ — чистый Node.js, без зависимостей.
 * Запуск:  node scripts/make-icons.mjs
 * Создаёт в public/: icon-64.png, icon-192.png, icon-512.png,
 * maskable-512.png, apple-touch-icon.png
 *
 * Дизайн: тёмный градиент фона (как на загрузочном экране) +
 * неоновый мятный шар с бликом сверху-слева и свечением.
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "public");
fs.mkdirSync(OUT, { recursive: true });

/* ---------- минимальный PNG-энкодер (RGBA, 8 бит) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // бит на канал
  ihdr[9] = 6;  // цветовой тип: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // фильтр None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- рисование ---------- */

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// фон — как на загрузочном экране
const BG_TOP = hex("#0e3a4e"), BG_MID = hex("#082434"), BG_BOT = hex("#04121c");
function bgPixel(t) {
  return t < 0.46 ? mix(BG_TOP, BG_MID, t / 0.46) : mix(BG_MID, BG_BOT, (t - 0.46) / 0.54);
}

// шар
const BALL = hex("#5dffb0"), BALL_DARK = hex("#0f8f5b"), BALL_HI = hex("#ffffff"), GLOW = hex("#35e0ff");

function render(size, ballFactor) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const R = size * ballFactor;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      let [r, g, b] = bgPixel(y / size);
      const d = Math.hypot(dx, dy);

      // внешнее свечение (мятный ореол)
      if (d > R && d < R * 1.5) {
        const a = (1 - (d - R) / (R * 0.5)) * 0.4;
        [r, g, b] = mix([r, g, b], GLOW, a);
      }

      // сам шар: светлее сверху-слева, темнее к краю
      if (d <= R) {
        const t = d / R;
        let col = mix(BALL, BALL_DARK, clamp01((t - 0.35) / 0.65));
        const hl = 1 - Math.hypot(dx + R * 0.35, dy + R * 0.35) / (R * 0.55);
        if (hl > 0) col = mix(col, BALL_HI, hl * 0.85);
        [r, g, b] = col;
      }

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

const files = [
  ["icon-64.png", 64, 0.42],
  ["icon-192.png", 192, 0.4],
  ["icon-512.png", 512, 0.4],
  // maskable: контент внутри центральных 80% (безопасная зона), фон — во весь холст
  ["maskable-512.png", 512, 0.3],
  ["apple-touch-icon.png", 180, 0.38],
];

for (const [name, size, ball] of files) {
  const buf = render(size, ball);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`✓ public/${name}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)} КБ`);
}
console.log("Иконки сгенерированы.");