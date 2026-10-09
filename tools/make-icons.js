'use strict';

/* Sinh icon PNG (quả cà chua) không cần thư viện ngoài: tự vẽ pixel + tự mã hoá PNG. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
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
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- vẽ ---------- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function drawTomato(size, scale) {
  const S = 4;
  const W = size * S;
  const H = size * S;
  const px = new Float32Array(W * H * 4);

  const paint = (test, color) => {
    const [r, g, b, a] = color;
    for (let y = 0; y < H; y++) {
      const v = (y + 0.5) / H;
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        if (!test(u, v)) continue;
        const i = (y * W + x) * 4;
        px[i] = px[i] * (1 - a) + r * a;
        px[i + 1] = px[i + 1] * (1 - a) + g * a;
        px[i + 2] = px[i + 2] * (1 - a) + b * a;
        px[i + 3] = px[i + 3] * (1 - a) + a * 255;
      }
    }
  };

  const ell = (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;

  // thân: một khối liền, hơi dẹt và bè vai như quả cà chua thật
  const body = (u, v) => Math.abs((u - 0.5) / 0.345) ** 2.3 + Math.abs((v - 0.585) / 0.28) ** 2.1 <= 1;

  // thân
  paint(body, [0xc4, 0x24, 0x1c, 1]);
  paint((u, v) => body(u, v) && v < 0.63, [0xe8, 0x40, 0x2c, 0.85]);
  paint((u, v) => body(u, v) && v < 0.52, [0xf5, 0x5d, 0x42, 0.7]);
  // bóng đổ dưới
  paint((u, v) => body(u, v) && ((u - 0.62) / 0.30) ** 2 + ((v - 0.80) / 0.18) ** 2 <= 1, [0x8e, 0x14, 0x12, 0.45]);
  // chấm sáng
  paint(ell(0.375, 0.435, 0.125, 0.085), [0xff, 0xff, 0xff, 0.55]);
  paint(ell(0.355, 0.42, 0.06, 0.04), [0xff, 0xff, 0xff, 0.8]);

  // lá đài
  const leaf = (angle, len) => (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.3;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const along = dx * c + dy * s;
    const perp = -dx * s + dy * c;
    if (along < -0.02 || along > len) return false;
    const w = 0.075 * (1 - clamp01(along / len) * 0.85);
    return Math.abs(perp) <= w;
  };
  const leaves = [
    [-90, 0.20],
    [-50, 0.185],
    [-130, 0.185],
    [-16, 0.15],
    [-164, 0.15],
  ];
  for (const [deg, len] of leaves) {
    const a = (deg * Math.PI) / 180;
    paint(leaf(a, len), [0x2f, 0x86, 0x3f, 1]);
    paint((u, v) => leaf(a, len)(u, v) && v < 0.28, [0x46, 0xa8, 0x53, 0.9]);
  }
  // cuống
  paint((u, v) => Math.abs(u - 0.5) <= 0.028 && v > 0.085 && v < 0.235, [0x27, 0x6b, 0x33, 1]);
  paint((u, v) => Math.abs(u - 0.5) <= 0.028 && v > 0.085 && v < 0.16, [0x3d, 0x8b, 0x44, 1]);

  // downsample
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const i = ((y * S + sy) * W + (x * S + sx)) * 4;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
          a += px[i + 3];
        }
      }
      const n = S * S;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });

const jobs = [
  ['icon.png', 256],
  ['tray.png', 32],
  ['tray@2x.png', 64],
];
for (const [name, size] of jobs) {
  const rgba = drawTomato(size);
  fs.writeFileSync(path.join(dir, name), encodePNG(size, size, rgba));
  console.log('wrote', name, size + 'x' + size);
}

/* .ico nhiều kích thước cho shortcut Windows (mỗi entry là một PNG) */
function encodeICO(sizes) {
  const images = sizes.map((size) => ({ size, data: encodePNG(size, size, drawTomato(size)) }));
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir[o] = img.size >= 256 ? 0 : img.size;
    dir[o + 1] = img.size >= 256 ? 0 : img.size;
    dir[o + 2] = 0;
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(img.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += img.data.length;
  });
  return Buffer.concat([head, dir, ...images.map((i) => i.data)]);
}

const icoSizes = [16, 32, 48, 64, 128, 256];
fs.writeFileSync(path.join(dir, 'icon.ico'), encodeICO(icoSizes));
console.log('wrote icon.ico', icoSizes.join('/'));
