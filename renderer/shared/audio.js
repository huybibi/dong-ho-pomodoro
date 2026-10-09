'use strict';

/* Bộ sinh âm thanh: không dùng file mp3 nào, mọi thứ được tổng hợp bằng Web Audio. */
window.Sound = (function () {
  let ctx = null;
  let master = null;
  let cueBus = null;
  let ambBus = null;
  let ambVol = 0.4;
  let current = 'off';
  const buffers = {};
  const cleaners = [];
  const schedulers = [];

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    cueBus = ctx.createGain();
    cueBus.gain.value = 0.6;
    cueBus.connect(master);
    ambBus = ctx.createGain();
    ambBus.gain.value = ambVol;
    ambBus.connect(master);
    return ctx;
  }

  function resume() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noise(seconds, brown, key) {
    ensure();
    const cacheKey = `${key}:${seconds}`;
    if (buffers[cacheKey]) return buffers[cacheKey];
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2;
        } else {
          d[i] = w;
        }
      }
    }
    buffers[cacheKey] = buf;
    return buf;
  }

  function loopSource(buffer, gainValue) {
    ensure();
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    const g = ctx.createGain();
    g.gain.value = gainValue == null ? 1 : gainValue;
    s.connect(g);
    s.start();
    cleaners.push(() => {
      try {
        s.stop();
      } catch {
        /* đã dừng */
      }
    });
    return g;
  }

  function filt(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }

  function every(ms, fn) {
    const id = setInterval(fn, ms);
    schedulers.push(() => clearInterval(id));
    return id;
  }

  /* ---------------- âm thanh nền ---------------- */

  function stopAmbient() {
    while (cleaners.length) {
      const fn = cleaners.pop();
      try {
        fn();
      } catch {
        /* bỏ qua */
      }
    }
    while (schedulers.length) {
      const fn = schedulers.pop();
      try {
        fn();
      } catch {
        /* bỏ qua */
      }
    }
    current = 'off';
  }

  function buildAmbient(kind, beat) {
    const out = ambBus;
    if (kind === 'brown') {
      const g = loopSource(noise(6, true, 'brown'), 0.55);
      g.connect(filt('lowpass', 520)).connect(out);
      return;
    }
    if (kind === 'rain') {
      const a = loopSource(noise(5, false, 'white'), 0.22);
      a.connect(filt('highpass', 700)).connect(filt('lowpass', 7600)).connect(out);
      const b = loopSource(noise(7, true, 'brown'), 0.5);
      const blp = filt('lowpass', 340);
      b.connect(blp).connect(out);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.11;
      lg.gain.value = 0.16;
      lfo.connect(lg).connect(blp.frequency);
      lfo.start();
      cleaners.push(() => {
        try {
          lfo.stop();
        } catch {
          /* bỏ qua */
        }
      });
      return;
    }
    if (kind === 'ocean') {
      const g = loopSource(noise(8, true, 'brown'), 0.7);
      const lp = filt('lowpass', 780);
      const swell = ctx.createGain();
      swell.gain.value = 0.55;
      g.connect(lp).connect(swell).connect(out);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.085;
      lg.gain.value = 0.42;
      lfo.connect(lg).connect(swell.gain);
      lfo.start();
      cleaners.push(() => {
        try {
          lfo.stop();
        } catch {
          /* bỏ qua */
        }
      });
      return;
    }
    if (kind === 'cafe') {
      const bed = loopSource(noise(6, true, 'brown'), 0.4);
      bed.connect(filt('lowpass', 420)).connect(out);
      every(1400, () => {
        if (ctx.state !== 'running') return;
        const t = ctx.currentTime;
        const s = ctx.createBufferSource();
        s.buffer = noise(1.6, false, 'white1.6');
        const bp = filt('bandpass', 180 + Math.random() * 420, 1.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
        s.connect(bp).connect(g).connect(out);
        s.start(t);
        s.stop(t + 1.7);
      });
      return;
    }
    if (kind === 'fire') {
      const bed = loopSource(noise(5, true, 'brown'), 0.35);
      bed.connect(filt('lowpass', 360)).connect(out);
      every(70, () => {
        if (Math.random() > 0.55 || ctx.state !== 'running') return;
        const t = ctx.currentTime;
        const s = ctx.createBufferSource();
        s.buffer = noise(0.12, false, 'white0.12');
        const hp = filt('highpass', 900 + Math.random() * 2200);
        const g = ctx.createGain();
        const peak = 0.03 + Math.random() * 0.09;
        g.gain.setValueAtTime(peak, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.05);
        s.connect(hp).connect(g).connect(out);
        s.start(t);
        s.stop(t + 0.12);
      });
      return;
    }
    if (kind === 'bowl') {
      const drone = ctx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 432;
      const dg = ctx.createGain();
      dg.gain.value = 0.07;
      drone.connect(dg).connect(out);
      drone.start();
      cleaners.push(() => {
        try {
          drone.stop();
        } catch {
          /* bỏ qua */
        }
      });
      const strike = () => {
        const t = ctx.currentTime;
        for (const [f, a, dur] of [
          [136.1, 0.14, 12],
          [272.2, 0.06, 9],
          [408.3, 0.03, 6],
        ]) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(a, t + 0.06);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + dur + 0.1);
        }
      };
      strike();
      every(17000, () => ctx.state === 'running' && strike());
      return;
    }
    if (kind === 'binaural') {
      const bed = loopSource(noise(6, true, 'brown'), 0.18);
      bed.connect(filt('lowpass', 380)).connect(out);
      const base = 200;
      for (const [freq, pan] of [
        [base, -1],
        [base + (beat || 10), 1],
      ]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.1;
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (p) {
          p.pan.value = pan;
          o.connect(g).connect(p).connect(out);
        } else {
          o.connect(g).connect(out);
        }
        o.start();
        cleaners.push(() => {
          try {
            o.stop();
          } catch {
            /* bỏ qua */
          }
        });
      }
      return;
    }
  }

  function ambient(kind, volume, beat) {
    ensure();
    resume();
    if (typeof volume === 'number') {
      ambVol = volume;
      if (ambBus) ambBus.gain.value = ambVol;
    }
    if (kind === current) return;
    stopAmbient();
    current = kind;
    if (!kind || kind === 'off') return;
    try {
      buildAmbient(kind, beat);
    } catch {
      /* thiết bị âm thanh lạ thì bỏ qua */
    }
  }

  /* ---------------- tiếng báo ---------------- */

  function blip(freq, at, dur, peak, type) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(cueBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function cue(name, volume) {
    ensure();
    resume();
    if (typeof volume === 'number') cueBus.gain.value = volume;
    if (name === 'bell') {
      blip(880, 0, 1.6, 0.3);
      blip(1320, 0.02, 1.2, 0.18);
      blip(1760, 0.05, 0.9, 0.1);
      blip(2640, 0.08, 0.6, 0.05);
    } else if (name === 'start') {
      blip(523.25, 0, 0.35, 0.22);
      blip(783.99, 0.12, 0.5, 0.2);
    } else if (name === 'break') {
      blip(392, 0, 0.6, 0.2);
      blip(293.66, 0.16, 0.8, 0.18);
    } else if (name === 'soft') {
      blip(320, 0, 0.3, 0.14, 'triangle');
    } else if (name === 'tick') {
      blip(1200, 0, 0.06, 0.08, 'square');
    }
  }

  /* Tiếng dẫn nhịp thở: cao dần khi hít vào, trầm dần khi thở ra. */
  function guide(kind, seconds) {
    ensure();
    resume();
    const dur = Math.max(1.2, Math.min(10, seconds || 4));
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const g = ctx.createGain();
    let f0 = 200;
    let f1 = 300;
    if (kind === 'out') {
      f0 = 300;
      f1 = 150;
    } else if (kind === 'hold') {
      f0 = 250;
      f1 = 250;
    } else if (kind === 'holdout') {
      f0 = 150;
      f1 = 150;
    }
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + Math.min(0.6, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(cueBus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  function setVolume(v) {
    ensure();
    cueBus.gain.value = v;
  }

  return { ambient, cue, guide, setVolume, resume, stopAmbient, get current() { return current; } };
})();
