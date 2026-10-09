'use strict';

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { getPattern, listPatterns } = require('./patterns');
const Store = require('./store');

const RENDERER = path.join(__dirname, 'renderer');
const ASSETS = path.join(__dirname, 'assets');
const ICON = path.join(ASSETS, 'icon.png');
const TRAY_ICON = path.join(ASSETS, 'tray.png');

const SMOKE = !!process.env.DEEPWORK_SMOKE;
const SHOTS = !!process.env.DEEPWORK_SHOTS;

/* Nếu terminal chạy app đóng trước khi app thoát, console.log() ném
   `EPIPE: broken pipe, write` thành uncaughtException → Electron bật hộp thoại
   "A JavaScript error occurred in the main process". Log không quan trọng bằng
   việc app sống, nên bỏ qua riêng EPIPE (mọi lỗi khác vẫn ném như cũ). */
for (const stream of [process.stdout, process.stderr]) {
  if (stream && typeof stream.on === 'function') {
    stream.on('error', (err) => {
      if (!err || err.code !== 'EPIPE') throw err;
    });
  }
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.platform === 'win32') app.setAppUserModelId('com.cauchua.deepwork');

const store = new Store(app.getPath('userData'));
const S = store.settings;

let tray = null;
let quitting = false;
const wins = {};
const dragging = { win: null, cursor: null, origin: null };
const timers = { tips: [] };

/* ------------------------------------------------------------------ windows */

function icon() {
  try {
    return nativeImage.createFromPath(ICON);
  } catch {
    return undefined;
  }
}

function mk(name, file, opts = {}) {
  const w = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    icon: icon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
    ...opts,
  });
  wins[name] = w;
  w.loadFile(path.join(RENDERER, file));

  w.webContents.on('console-message', (a, b, c, d) => {
    const msg = a && a.message ? `${a.level}: ${a.message}` : `${b}: ${c}`;
    console.log(`[${name}] ${msg}`);
  });
  w.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.log(`[${name}] did-fail-load ${code} ${desc} ${url}`);
  });
  w.webContents.on('render-process-gone', (_e, det) => {
    console.log(`[${name}] render-process-gone ${det && det.reason}`);
  });
  w.on('closed', () => {
    if (wins[name] === w) wins[name] = null;
  });
  return w;
}

function workArea(win) {
  const pt = win && !win.isDestroyed() ? win.getBounds() : screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint({ x: pt.x || 0, y: pt.y || 0 }).workArea;
}

function clampTo(bounds, area) {
  const x = Math.min(Math.max(bounds.x, area.x - 4), area.x + area.width - bounds.width + 4);
  const y = Math.min(Math.max(bounds.y, area.y - 4), area.y + area.height - bounds.height + 4);
  return { x: Math.round(x), y: Math.round(y), width: bounds.width, height: bounds.height };
}

function show(name, focus = false) {
  const w = wins[name];
  if (!w || w.isDestroyed()) return;
  if (w.isVisible()) return;
  if (focus) w.show();
  else w.showInactive();
  if (w.__clickThrough !== undefined) w.setIgnoreMouseEvents(!!w.__clickThrough, { forward: true });
}

function hide(name) {
  const w = wins[name];
  if (w && !w.isDestroyed() && w.isVisible()) w.hide();
}

function sendTo(names, payload) {
  for (const name of names) {
    const w = wins[name];
    if (w && !w.isDestroyed()) w.webContents.send('event', payload);
  }
}

function broadcast() {
  const st = publicState();
  for (const key of Object.keys(wins)) {
    const w = wins[key];
    if (w && !w.isDestroyed()) w.webContents.send('state', st);
  }
  if (tray) buildTray();
}

/* ------------------------------------------------------------------ engine */

const engine = {
  mode: 'idle', // idle | focus | break | long | breathe
  running: false,
  total: 0,
  remaining: 0,
  label: '',
  intent: '',
  completed: 0,
  startedAt: null,
  patternId: null,
  steps: null,
  breath: null,
};

const MODE_LABEL = { focus: 'Tập trung', break: 'Nghỉ ngắn', long: 'Nghỉ dài', breathe: 'Hít thở', idle: 'Sẵn sàng' };

function fmtLeft(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

let statsCache = null;
function stats() {
  if (!statsCache) statsCache = store.summary();
  return statsCache;
}
function dropStats() {
  statsCache = null;
}

function publicState() {
  const day = store.todaySummary();
  const streak = store.streak();
  const goal = Math.max(1, S.dailyGoal || 8);
  const b = engine.breath;
  let breath = null;
  if (engine.mode === 'breathe' && b && engine.steps) {
    const step = engine.steps[b.index] || engine.steps[engine.steps.length - 1];
    const prep = Math.max(0, b.prep || 0);
    breath = {
      patternId: engine.patternId,
      index: prep > 0 ? 0 : b.index,
      count: engine.steps.length,
      label: prep > 0 ? 'Chuẩn bị' : step.l,
      kind: prep > 0 ? 'prep' : step.k,
      stepTotal: prep > 0 ? BREATH_PREP : step.s,
      stepLeft: prep > 0 ? prep : Math.max(0, b.stepLeft),
      round: Math.floor(b.index / engine.steps.length) + 1,
      prep: prep > 0,
    };
  }
  return {
    mode: engine.mode,
    modeLabel: MODE_LABEL[engine.mode] || engine.mode,
    running: engine.running,
    total: engine.total,
    remaining: engine.remaining,
    progress: engine.total > 0 ? Math.min(1, Math.max(0, 1 - engine.remaining / engine.total)) : 0,
    clock: fmtLeft(engine.remaining),
    label: engine.label,
    intent: engine.intent,
    completed: engine.completed,
    breath,
    today: day,
    goal,
    goalProgress: Math.min(1, day.focus / goal),
    streak,
    week: store.week(),
    summary: stats(),
    settings: { ...S },
    patterns: listPatterns(),
  };
}

function tick() {
  const now = Date.now();
  const dt = Math.min(2, (now - (tick.last || now)) / 1000);
  tick.last = now;
  if (!engine.running) return;

  if (engine.mode === 'breathe') {
    tickBreathe(dt);
    return;
  }

  engine.remaining -= dt;
  if (engine.remaining <= 0) {
    engine.remaining = 0;
    finishTimer();
    return;
  }
  broadcast();
}

function endPrep() {
  engine.breath.prep = 0;
  const first = engine.steps[0];
  sendTo(['breathe', 'audio', 'timer'], { type: 'phase', kind: first.k, label: first.l, dur: first.s });
}

function tickBreathe(dt) {
  const b = engine.breath;
  const steps = engine.steps;
  if (!b || !steps) return;
  if (b.prep > 0) {
    b.prep -= dt;
    if (b.prep > 0) {
      broadcast();
      return;
    }
    endPrep();
    broadcast();
    return;
  }
  engine.remaining = Math.max(0, engine.remaining - dt);
  b.stepLeft -= dt;
  let guard = 0;
  while (b.stepLeft <= 0 && guard++ < 500) {
    const prev = steps[b.index];
    b.index += 1;
    if (b.index >= steps.length) {
      finishBreathe();
      return;
    }
    const cur = steps[b.index];
    b.stepLeft += cur.s;
    if (cur.k !== prev.k || cur.s !== prev.s) {
      sendTo(['breathe', 'audio', 'timer'], { type: 'phase', kind: cur.k, label: cur.l, dur: cur.s });
    }
  }
  broadcast();
}

function setMode(mode) {
  engine.mode = mode;
  layout();
}

function idle() {
  engine.running = false;
  engine.total = 0;
  engine.remaining = 0;
  engine.steps = null;
  engine.breath = null;
  engine.patternId = null;
  engine.label = '';
  engine.intent = '';
  clearTips();
  setMode('idle');
}

function startFocus(minutes, intent) {
  clearTips();
  engine.mode = 'focus';
  engine.running = true;
  engine.total = Math.max(1, minutes) * 60;
  engine.remaining = engine.total;
  engine.label = `${MODE_LABEL.focus} ${minutes}′`;
  engine.intent = (intent || '').trim();
  engine.startedAt = Date.now();
  if (engine.intent) store.day().intents.push({ t: Date.now(), text: engine.intent, seconds: 0 });
  store.save();
  sendTo(['audio'], { type: 'cue', cue: 'start' });
  setMode('focus');
  broadcast();
}

function startBreak() {
  const long = engine.completed > 0 && engine.completed % Math.max(1, S.longEvery) === 0;
  engine.mode = long ? 'long' : 'break';
  engine.running = true;
  engine.total = (long ? S.longBreakMin : S.shortBreakMin) * 60;
  engine.remaining = engine.total;
  engine.label = long ? `${MODE_LABEL.long} ${S.longBreakMin}′` : `${MODE_LABEL.break} ${S.shortBreakMin}′`;
  scheduleTips(long);
  sendTo(['audio'], { type: 'cue', cue: 'break' });
  setMode(engine.mode);
  broadcast();
}

function finishTimer() {
  const wasFocus = engine.mode === 'focus';
  engine.running = false;
  if (wasFocus) {
    store.addFocus(engine.total, engine.intent);
    dropStats();
    engine.completed += 1;
    cue('bell');
    notify('Phiên tập trung xong 🍅', 'Nghỉ thôi: đứng dậy, uống nước, nhìn ra xa 6m trong 20 giây.');
    if (S.autoChain) {
      startBreak();
      return;
    }
  } else {
    store.addBreak();
    dropStats();
    cue('bell');
    const msg = S.eyeRest ? 'Nhìn ra xa 6m trong 20 giây rồi quay lại.' : 'Sẵn sàng cho phiên tiếp theo.';
    notify('Hết giờ nghỉ', msg);
    if (S.autoChain && S.autoStartFocus) {
      startFocus(S.focusMin, engine.intent);
      return;
    }
  }
  idle();
  broadcast();
}

function stopSession(reason) {
  const spent = engine.total - engine.remaining;
  if (engine.mode === 'focus' && reason) {
    store.addAbort(reason, spent);
    dropStats();
  }
  cue('soft');
  idle();
  broadcast();
}

function skip() {
  if (engine.mode === 'focus' || engine.mode === 'break' || engine.mode === 'long') {
    engine.remaining = 0;
    finishTimer();
  }
}

const BREATH_PREP = 5; /* giây chuẩn bị trước khi bài thở bắt đầu */

function startBreathe(id) {
  const p = getPattern(id);
  if (!p) return;
  const built = p.build();
  clearTips();
  engine.patternId = p.id;
  engine.steps = built.steps;
  engine.mode = 'breathe';
  engine.running = true;
  engine.total = built.steps.reduce((a, s) => a + s.s, 0);
  engine.remaining = engine.total;
  engine.label = p.name;
  engine.intent = '';
  engine.breath = { index: 0, stepLeft: built.steps[0].s, prep: BREATH_PREP };
  engine.startedAt = Date.now();
  store.patch({ lastPattern: p.id });
  sendTo(['breathe', 'audio', 'timer'], {
    type: 'pattern',
    pattern: { id: p.id, name: p.name, tag: p.tag, desc: p.desc, goal: p.goal, icon: p.icon, steps: built.steps },
  });
  sendTo(['audio'], { type: 'cue', cue: 'start' });
  setMode('breathe');
  broadcast();
}

function finishBreathe() {
  const spent = engine.total;
  store.addBreathing(engine.patternId || 'unknown', spent);
  dropStats();
  cue('bell');
  notify('Xong bài hít thở', 'Cơ thể đã sẵn sàng. Bắt đầu phiên tập trung chứ?');
  engine.running = false;
  sendTo(['breathe'], { type: 'breathe-done' });
  broadcast();
}

function breatheSkipStep() {
  if (engine.mode !== 'breathe' || !engine.breath) return;
  if (engine.breath.prep > 0) {
    endPrep();
    broadcast();
    return;
  }
  engine.breath.stepLeft = 0;
  tickBreathe(0);
}

function breatheLoop() {
  if (engine.mode !== 'breathe' || !engine.steps || !engine.breath) return;
  engine.breath.index = 0;
  engine.breath.stepLeft = engine.steps[0].s;
  engine.breath.prep = BREATH_PREP;
  engine.remaining = engine.total;
  engine.running = true;
  broadcast();
}

/* ------------------------------------------------------------------ tips */

function clearTips() {
  for (const t of timers.tips) clearTimeout(t);
  timers.tips = [];
}

function scheduleTips(long) {
  clearTips();
  if (S.eyeRest) {
    timers.tips.push(
      setTimeout(() => {
        notify('20-20-20 👁', 'Nhìn vào một vật cách 6 mét trong 20 giây. Mắt cũng cần nghỉ.');
        sendTo(['timer'], { type: 'toast', text: 'Nhìn ra xa 6m trong 20 giây' });
      }, 20000)
    );
  }
  const breakMin = Math.floor(engine.total / 60);
  const at = Math.min(S.waterEveryMin || 25, Math.max(1, breakMin - 1));
  if (long && breakMin > 1) {
    timers.tips.push(
      setTimeout(() => {
        notify('Uống nước 💧', 'Vai, cổ, mắt — thả lỏng. Uống một cốc nước.');
        sendTo(['timer'], { type: 'toast', text: 'Uống nước & thả lỏng vai cổ' });
      }, at * 60 * 1000)
    );
  }
}

/* ------------------------------------------------------------------ layout */

function defaultPlacement(name, w, h) {
  const area = screen.getPrimaryDisplay().workArea;
  if (name === 'orb') return { x: area.x + area.width - w - 28, y: area.y + area.height - h - 60 };
  if (name === 'timer') return { x: area.x + Math.round((area.width - w) / 2), y: area.y + area.height - h - 90 };
  if (name === 'breathe') return { x: area.x + Math.round((area.width - w) / 2), y: area.y + Math.round((area.height - h) / 2) };
  if (name === 'settings') return { x: area.x + Math.round((area.width - w) / 2), y: area.y + Math.round((area.height - h) / 2) };
  return { x: area.x + 60, y: area.y + 60 };
}

function place(name) {
  const w = wins[name];
  if (!w || w.isDestroyed()) return;
  const b = w.getBounds();
  const saved = store.positions[name];
  const pos = saved && Number.isFinite(saved[0]) ? { x: saved[0], y: saved[1] } : defaultPlacement(name, b.width, b.height);
  const next = clampTo({ x: pos.x, y: pos.y, width: b.width, height: b.height }, workArea(w));
  w.setBounds(next);
  if (!saved) store.setPos(name, [next.x, next.y]);
}

function menuPlacement() {
  const w = wins.menu;
  const orb = wins.orb;
  const b = w.getBounds();
  const area = workArea(w);
  let x = area.x + area.width - b.width - 28;
  let y = area.y + area.height - b.height - 40;
  if (orb && !orb.isDestroyed()) {
    const ob = orb.getBounds();
    x = ob.x + ob.width / 2 > area.x + area.width / 2 ? ob.x - b.width - 12 : ob.x + ob.width + 12;
    y = ob.y + ob.height > area.y + area.height / 2 ? ob.y + ob.height - b.height : ob.y;
  }
  return clampTo({ x, y, width: b.width, height: b.height }, area);
}

function layout() {
  const active = ['focus', 'break', 'long'].includes(engine.mode);

  if (S.hideOrb) hide('orb');
  else show('orb');

  if (active) {
    place('timer');
    show('timer');
  } else {
    hide('timer');
  }

  if (engine.mode === 'breathe') {
    place('breathe');
    show('breathe', true);
  } else {
    hide('breathe');
  }

  if (engine.mode !== 'idle' || !wins.menu) hide('menu');
}

/* ------------------------------------------------------------------ audio */

let audioKind = S.ambient;
function cue(name) {
  if (!S.sound) return;
  sendTo(['audio'], { type: 'cue', cue: name });
}

function applyAmbient() {
  sendTo(['audio'], { type: 'ambient', kind: S.ambient, volume: S.ambientVolume, beat: S.binauralBeat });
}

function notify(title, body) {
  if (!S.notify) return;
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: true, icon: ICON }).show();
    }
  } catch {
    /* bỏ qua */
  }
}

/* ------------------------------------------------------------------ tray */

function buildTray() {
  if (!tray) return;
  engine.remaining; // noop giữ nhịp cập nhật
  const running = engine.running && (engine.mode === 'focus' || engine.mode === 'break' || engine.mode === 'long');
  const menu = Menu.buildFromTemplate([
    { label: running ? `${MODE_LABEL[engine.mode]} · ${fmtLeft(engine.remaining)}` : 'Đồng hồ Pomodoro', enabled: false },
    { label: `Hôm nay: ${store.todaySummary().focus}/${S.dailyGoal} phiên · chuỗi ${store.streak().current} ngày`, enabled: false },
    { type: 'separator' },
    running
      ? { label: engine.running ? 'Tạm dừng' : 'Tiếp tục', click: () => togglePause() }
      : { label: `Bắt đầu tập trung ${S.focusMin}′`, click: () => startFocus(S.focusMin, engine.intent) },
    running ? { label: 'Kết thúc phiên', click: () => stopSession('kết thúc sớm') } : { label: 'Nghỉ ngắn', click: () => startBreak() },
    {
      label: 'Hít thở tập trung',
      submenu: listPatterns().map((p) => ({
        label: `${p.name} — ${p.tag} (~${Math.round(p.seconds / 60)}′)`,
        click: () => startBreathe(p.id),
      })),
    },
    { type: 'separator' },
    {
      label: 'Âm thanh nền',
      submenu: [
        ['off', 'Tắt'],
        ['brown', 'Tiếng nâu (brown noise)'],
        ['rain', 'Mưa'],
        ['ocean', 'Sóng biển'],
        ['cafe', 'Quán cà phê'],
        ['fire', 'Lửa'],
        ['bowl', 'Chuông xoay 432Hz'],
        ['binaural', 'Binaural beats (tập trung sâu)'],
      ].map(([id, label]) => ({
        label,
        type: 'radio',
        checked: S.ambient === id,
        click: () => {
          S.ambient = id;
          store.patch({ ambient: id });
          applyAmbient();
        },
      })),
    },
    { label: 'Hiện cà chua', type: 'checkbox', checked: !S.hideOrb, click: (i) => { store.patch({ hideOrb: !i.checked }); layout(); } },
    { type: 'separator' },
    { label: 'Thống kê & Cài đặt…', click: () => openSettings() },
    { label: 'Thoát', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  const tip = running ? `${MODE_LABEL[engine.mode]} · ${fmtLeft(engine.remaining)}` : 'Đồng hồ Pomodoro';
  tray.setToolTip(tip);
}

function togglePause() {
  if (!engine.running && engine.total > 0 && engine.remaining > 0) {
    engine.running = true;
    broadcast();
    return;
  }
  if (engine.mode === 'idle') return;
  engine.running = !engine.running;
  broadcast();
}

/* ------------------------------------------------------------------ settings window */

function openSettings() {
  if (!wins.settings || wins.settings.isDestroyed()) {
    mk('settings', 'settings/index.html', {
      width: 940,
      height: 660,
      minWidth: 820,
      minHeight: 560,
      transparent: false,
      backgroundColor: '#141110',
      resizable: true,
      skipTaskbar: false,
      hasShadow: true,
      roundedCorners: true,
      show: false,
    });
    wins.settings.once('ready-to-show', () => {
      place('settings');
      wins.settings.show();
      wins.settings.focus();
    });
    wins.settings.on('moved', () => {
      const b = wins.settings.getBounds();
      store.setPos('settings', [b.x, b.y]);
    });
  } else {
    wins.settings.show();
    wins.settings.focus();
  }
  hide('menu');
}

/* ------------------------------------------------------------------ menu */

function toggleMenu() {
  const w = wins.menu;
  if (!w || w.isDestroyed()) return;
  if (w.isVisible()) {
    w.hide();
    return;
  }
  w.setBounds(menuPlacement());
  w.webContents.send('nav', 'main');
  w.show();
  w.focus();
}

/* ------------------------------------------------------------------ ipc */

ipcMain.handle('state:get', () => publicState());

ipcMain.handle('action', (_e, name, payload = {}) => {
  switch (name) {
    case 'focus:start':
      startFocus(payload.minutes || S.focusMin, payload.intent);
      hide('menu');
      break;
    case 'focus:toggle':
      togglePause();
      break;
    case 'focus:skip':
      skip();
      break;
    case 'focus:stop':
      stopSession(payload.reason);
      break;
    case 'focus:extend':
      if (engine.total > 0) {
        engine.total += payload.minutes * 60;
        engine.remaining += payload.minutes * 60;
        broadcast();
      }
      break;
    case 'break:start':
      startBreak();
      break;
    case 'breathe:start':
      startBreathe(payload.patternId);
      hide('menu');
      break;
    case 'breathe:skip':
      breatheSkipStep();
      break;
    case 'breathe:loop':
      breatheLoop();
      break;
    case 'breathe:stop':
      if (engine.mode === 'breathe') {
        if (engine.remaining < engine.total * 0.5) {
          store.addBreathing(engine.patternId || 'unknown', engine.total - engine.remaining);
          dropStats();
        }
        idle();
        broadcast();
      }
      break;
    case 'settings:set': {
      const patch = payload.patch || {};
      store.patch(patch);
      if ('ambient' in patch || 'ambientVolume' in patch || 'binauralBeat' in patch) applyAmbient();
      if ('hideOrb' in patch) layout();
      broadcast();
      break;
    }
    case 'ambient:set':
      S.ambient = payload.kind;
      if (typeof payload.volume === 'number') S.ambientVolume = payload.volume;
      store.patch({ ambient: S.ambient, ambientVolume: S.ambientVolume });
      applyAmbient();
      broadcast();
      break;
    case 'orbs:set':
      store.patch({ hideOrb: !!payload.hide });
      layout();
      broadcast();
      break;
    case 'menu:toggle':
      toggleMenu();
      break;
    case 'menu:close':
      hide('menu');
      break;
    case 'menu:nav':
      if (wins.menu && !wins.menu.isDestroyed()) wins.menu.webContents.send('nav', payload.view);
      break;
    case 'settings:open':
      openSettings();
      break;
    case 'pos:reset':
      store.data.positions = {};
      store.flush();
      for (const n of ['orb', 'timer', 'breathe']) place(n);
      layout();
      break;
    case 'stats:reset':
      store.data.days = {};
      store.data.meta.totalFocusSeconds = 0;
      store.data.meta.totalSessions = 0;
      store.data.meta.totalAborts = 0;
      store.data.meta.totalBreathingSeconds = 0;
      store.data.meta.bestStreak = 0;
      store.flush();
      dropStats();
      broadcast();
      break;
    case 'sound:test':
      cue(payload.cue || 'bell');
      break;
    case 'state:request':
      broadcast();
      break;
    default:
      break;
  }
  return true;
});

ipcMain.on('win:close', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.close();
});

ipcMain.on('win:hide', (e, name) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (name && wins[name]) hide(name);
  else if (w) w.hide();
});

ipcMain.on('win:show', (e, name) => {
  if (name && wins[name]) wins[name].show();
});

ipcMain.on('win:size', (e, w2, h2) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w.isDestroyed()) return;
  const b = w.getBounds();
  const area = workArea(w);
  let y = b.y;
  if (w === wins.timer) y = b.y + b.height - h2;
  w.setBounds(clampTo({ x: b.x, y, width: Math.round(w2), height: Math.round(h2) }, area));
});

ipcMain.on('win:clickThrough', (e, flag) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w.isDestroyed()) return;
  w.__clickThrough = !!flag;
  // Hoãn tới khi cửa sổ thực sự hiện (xem show()): đặt chế độ chuột xuyên qua lúc cửa sổ
  // còn ẩn không có tác dụng và dễ khiến Windows áp trạng thái ẩn.
  if (w.isVisible()) w.setIgnoreMouseEvents(!!flag, { forward: true });
});

ipcMain.on('drag:start', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w.isDestroyed()) return;
  dragging.win = w;
  dragging.cursor = screen.getCursorScreenPoint();
  dragging.origin = w.getBounds();
});

ipcMain.on('drag:move', (e, x, y) => {
  const w = dragging.win;
  if (!w || w.isDestroyed() || !dragging.origin || !dragging.cursor) return;
  const dx = x - dragging.cursor.x;
  const dy = y - dragging.cursor.y;
  w.setBounds({ x: Math.round(dragging.origin.x + dx), y: Math.round(dragging.origin.y + dy), width: dragging.origin.width, height: dragging.origin.height });
});

ipcMain.on('drag:end', () => {
  const w = dragging.win;
  dragging.win = null;
  dragging.cursor = null;
  dragging.origin = null;
  if (!w || w.isDestroyed()) return;
  const b = w.getBounds();
  const area = workArea(w);
  const snap = 30;
  let { x, y } = b;
  if (x < area.x + snap) x = area.x + 6;
  else if (x + b.width > area.x + area.width - snap) x = area.x + area.width - b.width - 6;
  if (y < area.y + snap) y = area.y + 6;
  else if (y + b.height > area.y + area.height - snap) y = area.y + area.height - b.height - 6;
  const next = clampTo({ x, y, width: b.width, height: b.height }, area);
  w.setBounds(next);
  for (const name of Object.keys(wins)) {
    if (wins[name] === w) store.setPos(name, [next.x, next.y]);
  }
});

ipcMain.on('app:quit', () => {
  quitting = true;
  app.quit();
});

/* ------------------------------------------------------------------ boot */

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.cauchua.deepwork');

  mk('audio', 'audio/index.html', { width: 2, height: 2, x: -3000, y: -3000, show: false, skipTaskbar: true });

  mk('orb', 'orb/index.html', { width: 150, height: 150, transparent: true });
  wins.orb.setAlwaysOnTop(true, 'screen-saver');
  wins.orb.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  place('orb');
  wins.orb.on('moved', () => {
    const b = wins.orb.getBounds();
    store.setPos('orb', [b.x, b.y]);
  });

  // Quả cà chua phải được hiện tường minh: cửa sổ tạo bằng show:false không tự hiện, và hiện
  // trước khi trang vẽ xong thì chỉ thấy một khung trong suốt. Chờ khung hình đầu tiên.
  wins.orb.once('ready-to-show', () => {
    if (!S.hideOrb) show('orb');
  });

  mk('timer', 'timer/index.html', { width: 230, height: 96, transparent: true });
  wins.timer.setAlwaysOnTop(true, 'screen-saver');
  wins.timer.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  wins.timer.on('moved', () => {
    const b = wins.timer.getBounds();
    store.setPos('timer', [b.x, b.y]);
  });

  mk('breathe', 'breathe/index.html', { width: 440, height: 600, transparent: true });
  wins.breathe.setAlwaysOnTop(true, 'screen-saver');
  wins.breathe.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  place('breathe');
  wins.breathe.on('moved', () => {
    const b = wins.breathe.getBounds();
    store.setPos('breathe', [b.x, b.y]);
  });

  mk('menu', 'menu/index.html', { width: 372, height: 580, transparent: true });
  wins.menu.setAlwaysOnTop(true, 'screen-saver');
  wins.menu.on('blur', () => {
    if (wins.menu && wins.menu.isVisible()) wins.menu.hide();
  });

  try {
    tray = new Tray(fs.existsSync(TRAY_ICON) ? TRAY_ICON : ICON);
    tray.on('click', () => toggleMenu());
    tray.on('double-click', () => openSettings());
    buildTray();
  } catch (err) {
    console.log('tray failed', err && err.message);
  }

  const shorts = [
    ['Control+Alt+P', () => (engine.mode === 'focus' ? togglePause() : startFocus(S.focusMin, engine.intent))],
    ['Control+Alt+B', () => startBreathe(S.lastPattern || 'box')],
    ['Control+Alt+X', () => stopSession('phím tắt')],
    ['Control+Alt+M', () => toggleMenu()],
    ['Control+Alt+H', () => {
      store.patch({ hideOrb: !S.hideOrb });
      layout();
      broadcast();
    }],
  ];
  for (const [acc, fn] of shorts) {
    try {
      globalShortcut.register(acc, fn);
    } catch {
      /* trùng phím tắt thì bỏ qua */
    }
  }

  setInterval(tick, 100);
  broadcast();

  // Bảo hiểm: nếu vì lý do nào đó 'ready-to-show' không phát ra, vẫn hiện quả cà chua.
  setTimeout(() => {
    if (S.hideOrb) return;
    if (wins.orb && !wins.orb.isDestroyed() && !wins.orb.isVisible()) show('orb');
  }, 1500);

  if (SMOKE) {
    const names = () => Object.keys(wins).filter((k) => wins[k] && !wins[k].isDestroyed()).join(',');
    const timerShown = () => !!(wins.timer && !wins.timer.isDestroyed() && wins.timer.isVisible());
    const log = (tag, v) => console.log(`SMOKE ${tag}:`, JSON.stringify(v));

    setTimeout(() => {
      log('windows', names());
      log('state', { mode: engine.mode, patterns: listPatterns().length, goal: S.dailyGoal });
      startFocus(1, 'Viết xong README');
      engine.remaining = 6;
    }, 1200);

    setTimeout(() => {
      log('focusRunning', { mode: engine.mode, timerShown: timerShown(), remaining: Math.round(engine.remaining * 10) / 10, intent: engine.intent });
      stopSession('Mất tập trung');
      log('afterAbort', { mode: engine.mode, today: store.todaySummary(), timerShown: timerShown() });
    }, 3000);

    setTimeout(() => {
      startFocus(1, 'Viết xong README');
      engine.remaining = 1.5;
    }, 3800);

    setTimeout(() => {
      log('afterFinish', { mode: engine.mode, completed: engine.completed, remaining: Math.round(engine.remaining), today: store.todaySummary() });
      startBreathe('box');
      openSettings();
    }, 6200);

    setTimeout(async () => {
      log('breathe', publicState().breath);
      log('windows', names());
      log('bounds', Object.fromEntries(Object.entries(wins).map(([k, w]) => [k, w && !w.isDestroyed() ? { b: w.getBounds(), v: w.isVisible() } : null])));
      log('stats', store.summary());
      log('week', store.week().map((d) => d.focus));
      log('streak', store.streak());

      const orbBody = await wins.orb.webContents.executeJavaScript('document.querySelector("#fruit #body path").getAttribute("d")');
      log('prep', { breath: publicState().breath, remaining: Math.round(engine.remaining * 10) / 10, total: engine.total });

      const probes = {
        orb: '({tag: document.querySelector("svg") ? "svg" : "none", txt: document.body.innerText.replace(/\\s+/g, " ").slice(0, 40), hit: ((at) => { const e = document.elementFromPoint(at[0], at[1]); return !!(e && e.closest && e.closest("#fruit")); })([75, 75]), edge: ((at) => { const e = document.elementFromPoint(at[0], at[1]); return !!(e && e.closest && e.closest("#fruit")); })([6, 6])})',
        timer: '({txt: document.body.innerText.replace(/\\s+/g, " ").slice(0, 40), card: ((c) => { const s = getComputedStyle(c); const r = c.getBoundingClientRect(); return { bg: s.backgroundColor, blur: s.backdropFilter, shadow: s.boxShadow, radius: s.borderRadius, box: Math.round(r.width) + "x" + Math.round(r.height) }; })(document.querySelector("#card")), clock: getComputedStyle(document.querySelector("#clock")).fontSize, ts: getComputedStyle(document.querySelector("#card")).getPropertyValue("--ts")})',
        breathe: '({txt: document.body.innerText.replace(/\\s+/g, " ").slice(0, 50), phase: document.querySelector("#phase").textContent, step: document.querySelector("#step").textContent, count: document.querySelector("#count").textContent, kind: (document.body.className.match(/k-[a-z]+/) || [""])[0]})',
        menu: `({txt: document.body.innerText.replace(/\\s+/g, " ").slice(0, 60), btns: document.querySelectorAll("button").length, tomatoSharesOrb: document.querySelector("#mini #fruit path") ? document.querySelector("#mini #fruit path").getAttribute("d") === ${JSON.stringify(orbBody)} : false})`,
        settings: '({tabs: document.querySelectorAll(".tab").length, cards: document.querySelectorAll(".stat").length, bars: document.querySelectorAll(".wbar").length, txt: document.body.innerText.replace(/\\s+/g, " ").slice(0, 40)})',
      };
      for (const [name, expr] of Object.entries(probes)) {
        try {
          log(`dom:${name}`, await wins[name].webContents.executeJavaScript(expr));
        } catch (e) {
          log(`dom:${name}`, `ERR ${e.message}`);
        }
      }

      breatheSkipStep();
      log('afterPrepSkip', publicState().breath);
      try {
        log('dom:breathe2', await wins.breathe.webContents.executeJavaScript('({txt: document.body.innerText.replace(/\\s+/g, " ").slice(0, 50), phase: document.querySelector("#phase").textContent, step: document.querySelector("#step").textContent, kind: (document.body.className.match(/k-[a-z]+/) || [""])[0]})'));
      } catch (e) {
        log('dom:breathe2', `ERR ${e.message}`);
      }
      console.log('SMOKE OK');
      quitting = true;
      app.quit();
    }, 7800);
  }

  /* Ảnh demo cho README (dev-only): DEEPWORK_SHOTS=1 node_modules\electron\dist\electron.exe .
     Chụp chính các cửa sổ thật bằng capturePage() — ảnh chụp màn hình kiểu GDI
     không bắt được cửa sổ trong suốt của Electron. Mỗi ảnh được tự kiểm chứng
     bằng img.getBitmap(): % pixel đục + RGB trung bình. */
  if (SHOTS) {
    const dir = path.join(ASSETS, 'shots');
    fs.mkdirSync(dir, { recursive: true });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const DESK =
      'html,body{background:linear-gradient(135deg,#2b3440 0%,#1b212b 45%,#0e1218 100%) !important;}';
    const paint = (name, css) => {
      const w = wins[name];
      if (!w || w.isDestroyed() || !css) return Promise.resolve();
      const expr = `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(
        css,
      )}; document.head.appendChild(s); return true; })()`;
      return w.webContents.executeJavaScript(expr).catch(() => false);
    };
    const shot = async (name, file, css, ms) => {
      const w = wins[name];
      if (!w || w.isDestroyed()) return console.log('SHOT skip:', name);
      await paint(name, css);
      await wait(ms || 500);
      const img = await w.webContents.capturePage();
      const out = path.join(dir, file);
      fs.writeFileSync(out, img.toPNG());
      const { width, height } = img.getSize();
      const bm = img.getBitmap();
      let opaque = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < bm.length; i += 4) {
        if (bm[i + 3] > 8) {
          opaque += 1;
          r += bm[i + 2];
          g += bm[i + 1];
          b += bm[i];
        }
      }
      const n = Math.max(1, opaque);
      console.log(
        'SHOT',
        file,
        JSON.stringify({
          size: `${width}x${height}`,
          opaquePct: Math.round((opaque / (width * height)) * 100),
          mean: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
          bytes: fs.statSync(out).size,
        }),
      );
    };

    (async () => {
      await wait(1600);
      store.patch({ timerScale: 2 });
      startFocus(45, 'Viết xong báo cáo Q3');
      engine.remaining = 18 * 60 + 24;
      broadcast();
      await wait(900);
      await shot('orb', 'orb.png', DESK, 700);
      await shot('timer', 'hero.png', DESK, 700);
      toggleMenu();
      await shot('menu', 'menu.png', DESK, 900);
      startBreathe('box');
      await shot('breathe', 'breathe.png', DESK, 2600);
      openSettings();
      await wait(1600);
      await shot('settings', 'settings.png', null, 900);
      console.log('SHOTS done');
      quitting = true;
      app.quit();
    })();
  }
});

app.on('window-all-closed', (e) => {
  if (!quitting) e.preventDefault();
});

app.on('before-quit', () => {
  quitting = true;
  store.flush();
  globalShortcut.unregisterAll();
});
