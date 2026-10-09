'use strict';

/* Sinh icon (icon.png, tray.png, tray@2x.png, icon.ico) từ CHÍNH hình quả cà chua
   đang nổi trên desktop: lấy nguyên khối <svg id="tomato"> trong renderer/orb/index.html
   rồi nhờ Chromium vẽ và chụp lại — không vẽ tay pixel nữa.

   Chạy: npm run icons   (hoặc: electron tools/make-icons.js) */

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const BIG = 512; /* vẽ một lần ở 512 rồi thu nhỏ cho mọi kích thước */

const SVG = (() => {
  const html = fs.readFileSync(path.join(ROOT, 'renderer', 'orb', 'index.html'), 'utf8');
  const m = html.match(/<svg id="tomato"[\s\S]*?<\/svg>/);
  if (!m) throw new Error('không tìm thấy <svg id="tomato"> trong renderer/orb/index.html');
  return m[0];
})();

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  svg { display: block; width: 100%; height: 100%; }
</style></head><body>${SVG}</body></html>`;

/* ---------- .ico nhiều kích thước (mỗi entry là một PNG) ---------- */

function encodeICO(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0;
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.data.length;
  });
  return Buffer.concat([head, dir, ...entries.map((e) => e.data)]);
}

app.whenReady().then(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });

  const win = new BrowserWindow({
    width: BIG,
    height: BIG,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    resizable: false,
    skipTaskbar: true,
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PAGE));
  await new Promise((r) => setTimeout(r, 800));

  const cap = await win.webContents.capturePage();
  const size = cap.getSize();
  const bmp = cap.getBitmap();
  const at = (x, y) => {
    const i = (y * size.width + x) * 4;
    return { b: bmp[i], g: bmp[i + 1], r: bmp[i + 2], a: bmp[i + 3] };
  };
  const corner = at(2, 2);
  const center = at(size.width >> 1, size.height >> 1);
  console.log('capture', `${size.width}x${size.height}`, 'góc:', JSON.stringify(corner), 'tâm:', JSON.stringify(center));
  if (corner.a > 8) throw new Error('nền không trong suốt — icon sẽ có nền vuông');

  const jobs = [
    ['icon.png', 256],
    ['tray.png', 32],
    ['tray@2x.png', 64],
  ];
  for (const [name, px] of jobs) {
    fs.writeFileSync(path.join(ASSETS, name), cap.resize({ width: px, height: px, quality: 'best' }).toPNG());
    console.log('wrote', name, `${px}x${px}`);
  }

  const icoSizes = [16, 32, 48, 64, 128, 256];
  fs.writeFileSync(
    path.join(ASSETS, 'icon.ico'),
    encodeICO(icoSizes.map((px) => ({ size: px, data: cap.resize({ width: px, height: px, quality: 'best' }).toPNG() })))
  );
  console.log('wrote icon.ico', icoSizes.join('/'));

  win.destroy();
  app.quit();
});
