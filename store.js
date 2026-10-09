'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longEvery: 4,
  autoChain: true,
  autoStartFocus: false,
  sound: true,
  volume: 0.6,
  guideAudio: true,
  ambient: 'off',
  ambientVolume: 0.4,
  binauralBeat: 10,
  dailyGoal: 8,
  timerScale: 1,
  hideOrb: false,
  orbScale: 1,
  notify: true,
  eyeRest: true,
  waterEveryMin: 25,
  lastPattern: 'box',
  focusPresets: [15, 25, 50, 90],
};

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftKey = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dayKey(d);
};

const emptyDay = () => ({
  focus: 0,
  seconds: 0,
  breaks: 0,
  aborts: 0,
  breathingSeconds: 0,
  reasons: {},
  breathing: {},
  intents: [],
});

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'deepwork.json');
    let raw = {};
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) || {};
    } catch {
      raw = {};
    }
    this.data = {
      settings: { ...DEFAULTS, ...(raw.settings || {}) },
      days: raw.days || {},
      meta: {
        createdAt: Date.now(),
        totalFocusSeconds: 0,
        totalSessions: 0,
        totalAborts: 0,
        totalBreathingSeconds: 0,
        bestStreak: 0,
        ...(raw.meta || {}),
      },
      positions: raw.positions || {},
    };
    this._t = null;
  }

  get settings() {
    return this.data.settings;
  }

  get positions() {
    return this.data.positions;
  }

  patch(obj) {
    Object.assign(this.data.settings, obj);
    this.save();
  }

  setPos(name, pos) {
    this.data.positions[name] = pos;
    this.save();
  }

  save() {
    if (this._t) clearTimeout(this._t);
    this._t = setTimeout(() => this.flush(), 300);
  }

  flush() {
    if (this._t) {
      clearTimeout(this._t);
      this._t = null;
    }
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      /* ghi hỏng thì bỏ qua, không được làm sập app */
    }
  }

  day(key = dayKey()) {
    if (!this.data.days[key]) this.data.days[key] = emptyDay();
    const d = this.data.days[key];
    if (!d.reasons) d.reasons = {};
    if (!d.breathing) d.breathing = {};
    if (!d.intents) d.intents = [];
    return d;
  }

  addFocus(seconds, intent) {
    const d = this.day();
    d.focus += 1;
    d.seconds += Math.round(seconds);
    if (intent) d.intents.push({ t: Date.now(), text: intent, seconds: Math.round(seconds) });
    this.data.meta.totalSessions += 1;
    this.data.meta.totalFocusSeconds += Math.round(seconds);
    this.save();
  }

  addBreak() {
    this.day().breaks += 1;
    this.save();
  }

  addAbort(reason, seconds) {
    const d = this.day();
    d.aborts += 1;
    const key = reason || 'không rõ';
    d.reasons[key] = (d.reasons[key] || 0) + 1;
    this.data.meta.totalAborts += 1;
    this.data.meta.totalFocusSeconds += Math.round(Math.max(0, seconds || 0));
    this.save();
  }

  addBreathing(patternId, seconds) {
    const d = this.day();
    d.breathing[patternId] = (d.breathing[patternId] || 0) + 1;
    d.breathingSeconds += Math.round(seconds);
    this.data.meta.totalBreathingSeconds += Math.round(seconds);
    this.save();
  }

  streak() {
    const active = (k) => (this.data.days[k] && this.data.days[k].focus > 0) || false;
    let cur = 0;
    let start = null;
    if (active(dayKey())) start = 0;
    else if (active(shiftKey(-1))) start = -1;
    if (start !== null) {
      let i = start;
      while (active(shiftKey(i))) {
        cur += 1;
        i -= 1;
      }
    }
    if (cur > this.data.meta.bestStreak) {
      this.data.meta.bestStreak = cur;
      this.save();
    }
    return { current: cur, best: this.data.meta.bestStreak };
  }

  week() {
    const out = [];
    const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = -6; i <= 0; i++) {
      const key = shiftKey(i);
      const d = this.data.days[key] || emptyDay();
      const dt = new Date();
      dt.setDate(dt.getDate() + i);
      out.push({ key, label: names[dt.getDay()], focus: d.focus, seconds: d.seconds, day: dt.getDate() });
    }
    return out;
  }

  todaySummary() {
    const d = this.day();
    return {
      focus: d.focus,
      seconds: d.seconds,
      breaks: d.breaks,
      aborts: d.aborts,
      breathingSeconds: d.breathingSeconds,
      breathing: { ...d.breathing },
      reasons: { ...d.reasons },
      intents: d.intents.slice(-12),
    };
  }

  allReasons(limit = 6) {
    const agg = {};
    for (const key of Object.keys(this.data.days)) {
      const r = this.data.days[key].reasons || {};
      for (const k of Object.keys(r)) agg[k] = (agg[k] || 0) + r[k];
    }
    return Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([reason, count]) => ({ reason, count }));
  }

  breathingTotals() {
    const agg = {};
    for (const key of Object.keys(this.data.days)) {
      const b = this.data.days[key].breathing || {};
      for (const k of Object.keys(b)) agg[k] = (agg[k] || 0) + b[k];
    }
    return agg;
  }

  summary() {
    const meta = this.data.meta;
    return {
      totalSessions: meta.totalSessions,
      totalFocusSeconds: meta.totalFocusSeconds,
      totalBreathingSeconds: meta.totalBreathingSeconds,
      totalAborts: meta.totalAborts,
      bestStreak: meta.bestStreak,
      activeDays: Object.keys(this.data.days).filter((k) => (this.data.days[k].focus || 0) > 0).length,
      reasons: this.allReasons(),
      breathing: this.breathingTotals(),
    };
  }
}

module.exports = Store;
module.exports.dayKey = dayKey;
module.exports.DEFAULTS = DEFAULTS;
