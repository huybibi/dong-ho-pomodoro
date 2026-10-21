'use strict';

const R = 112;
const C = 2 * Math.PI * R;

const ring = U.q('#ring .prog');
ring.style.strokeDasharray = String(C);

const orb = U.q('#orb');
const phaseEl = U.q('#phase');
const countEl = U.q('#count');
const stepEl = U.q('#step');
const leftEl = U.q('#left');
const descEl = U.q('#desc');
const voice = U.q('#voice');

let pattern = null;
let lastSig = '';
let lastScale = 0.55;
let lastLeft = '';
let voiceWant = false;
let voiceAt = 0;

const LABEL = { prep: 'Chuẩn bị', in: 'Hít vào', out: 'Thở ra', hold: 'Nín thở', holdout: 'Nín thở' };

function setVoiceLevel(st) {
  const v = st && st.settings ? Number(st.settings.volume) : 0.6;
  voice.volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.6));
  voice.muted = !(st && st.settings && st.settings.sound);
}

function playVoice(t) {
  if (!pattern || pattern.id !== 'wimhof') return;
  if (Number.isFinite(t)) voiceAt = Math.max(0, t);
  if (voice.readyState >= 1) {
    try { voice.currentTime = voiceAt; } catch (_) {}
  }
  voiceWant = true;
  const p = voice.play();
  if (p && p.catch) p.catch(() => {});
}

function stopVoice() {
  voiceWant = false;
  voiceAt = 0;
  voice.pause();
  try { voice.currentTime = 0; } catch (_) {}
}

function retryVoice() {
  if (!voiceWant || !voice.paused || !pattern || pattern.id !== 'wimhof') return;
  if (voice.readyState >= 1) {
    try { voice.currentTime = voiceAt; } catch (_) {}
  }
  const p = voice.play();
  if (p && p.catch) p.catch(() => {});
}

voice.addEventListener('canplay', retryVoice);
voice.addEventListener('loadedmetadata', retryVoice);

function applyBg(st) {
  const v = st && st.settings && Number.isFinite(Number(st.settings.uiOpacity))
    ? Math.min(1, Math.max(0.3, Number(st.settings.uiOpacity))) : 0.86;
  document.documentElement.style.setProperty('--bg-alpha', String(v));
}

function setPhase(kind, seconds) {
  document.body.className = document.body.className
    .split(' ')
    .filter((c) => !c.startsWith('k-'))
    .join(' ');
  document.body.classList.add(`k-${kind}`);

  let target = lastScale;
  if (kind === 'in') target = 1;
  else if (kind === 'out') target = 0.55;
  else if (kind === 'hold') target = 1;
  else if (kind === 'holdout') target = 0.55;
  else if (kind === 'prep') target = 0.55;

  const dur = Math.max(0.2, Math.min(30, seconds || 4));
  const slow = kind === 'hold' || kind === 'holdout' || kind === 'prep';
  orb.style.transition = `transform ${slow ? 0.6 : dur}s linear, background 0.6s, box-shadow 0.6s`;
  orb.style.transform = `scale(${target})`;
  lastScale = target;
}

function paint(st) {
  applyBg(st);
  setVoiceLevel(st);
  const b = st.breath;
  if (!b) return;

  if (st.mode !== 'breathe') {
    if (!document.body.classList.contains('finished')) window.tomato.win.hide('breathe');
    if (!voice.paused || voiceWant) stopVoice();
    return;
  }

  const sig = `${b.index}|${b.kind}|${b.stepTotal}`;
  if (sig !== lastSig) {
    lastSig = sig;
    setPhase(b.kind, b.stepTotal);
    phaseEl.textContent = b.label && b.label.length > 26 ? LABEL[b.kind] : b.label || LABEL[b.kind];
    descEl.textContent = b.label && b.label.length > 26 ? b.label : '';
  }

  countEl.textContent = b.stepLeft > 9.5 ? String(Math.ceil(b.stepLeft)) : b.stepLeft.toFixed(1);
  stepEl.textContent = b.prep ? 'Chuẩn bị' : `Bước ${b.index + 1}/${b.count}`;
  if (st.clock !== lastLeft) {
    lastLeft = st.clock;
    leftEl.textContent = `còn ${st.clock}`;
  }
  ring.style.strokeDashoffset = String(C * (1 - Math.min(1, Math.max(0, st.progress))));

  if (pattern && pattern.id === 'wimhof' && !b.prep && !voice.paused) {
    const step = pattern.steps[b.index];
    if (step && Number.isFinite(step.at)) {
      const want = step.at + (b.stepTotal - b.stepLeft);
      if (Math.abs(voice.currentTime - want) > 0.5) {
        voiceAt = Math.max(0, want);
        try { voice.currentTime = voiceAt; } catch (_) {}
      }
    }
  }
}

U.q('#close').addEventListener('click', () => {
  document.body.classList.remove('finished');
  window.tomato.action('breathe:stop');
  window.tomato.win.hide('breathe');
});
U.q('#skip').addEventListener('click', () => window.tomato.action('breathe:skip'));
U.q('#loop').addEventListener('click', () => {
  document.body.classList.remove('finished');
  window.tomato.action('breathe:loop');
});
U.q('#done').addEventListener('click', () => {
  window.tomato.action('breathe:stop');
  window.tomato.win.hide('breathe');
});
U.q('#again').addEventListener('click', () => {
  document.body.classList.remove('finished');
  if (pattern) window.tomato.action('breathe:start', { patternId: pattern.id });
});
U.q('#go-focus').addEventListener('click', () => {
  document.body.classList.remove('finished');
  window.tomato.win.hide('breathe');
  window.tomato.action('focus:start', { minutes: 25 });
});

U.drag(U.q('#head'), null);

window.tomato.onEvent((ev) => {
  if (ev.type === 'pattern') {
    pattern = ev.pattern;
    if (pattern.id === 'wimhof') {
      voiceWant = false;
      voiceAt = 0;
      voice.pause();
      try { voice.currentTime = 0; } catch (_) {}
    } else {
      stopVoice();
    }
    U.q('#name').textContent = pattern.name;
    U.q('#tag').textContent = `${pattern.icon || ''} ${pattern.tag} · ${pattern.goal || ''}`.trim();
    descEl.textContent = pattern.desc;
    lastSig = '';
    lastScale = 0.55;
    orb.style.transition = 'none';
    orb.style.transform = 'scale(0.55)';
    document.body.classList.remove('finished');
  } else if (ev.type === 'voice') {
    if (!pattern || pattern.id !== 'wimhof') return;
    if (ev.action === 'play') playVoice();
    else if (ev.action === 'seek') playVoice(Number(ev.t) || 0);
    else if (ev.action === 'restart' || ev.action === 'stop') stopVoice();
  } else if (ev.type === 'breathe-done') {
    stopVoice();
    document.body.classList.add('finished');
  }
});

window.tomato.onState(paint);
window.tomato.getState().then(paint);
