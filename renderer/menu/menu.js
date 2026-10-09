'use strict';

const AMBIENTS = [
  ['off', 'Tắt'],
  ['brown', 'Tiếng nâu'],
  ['rain', 'Mưa'],
  ['ocean', 'Sóng biển'],
  ['cafe', 'Quán cà phê'],
  ['fire', 'Lửa'],
  ['bowl', 'Chuông 432Hz'],
  ['binaural', 'Binaural'],
];

let st = null;
let selected = 25;

const views = ['main', 'breathe', 'ambient'];

function show(view) {
  for (const v of views) U.q(`#v-${v}`).classList.toggle('on', v === view);
}

U.qa('[data-back]').forEach((b) => b.addEventListener('click', () => show('main')));

/* ---------- trang chính ---------- */

function presetLabel(min) {
  return `${min}′`;
}

function renderPresets() {
  const box = U.q('#presets');
  box.innerHTML = '';
  for (const min of st.settings.focusPresets) {
    const b = document.createElement('button');
    b.className = `chip${min === selected ? ' sel' : ''}`;
    b.textContent = presetLabel(min);
    b.addEventListener('click', () => {
      selected = min;
      renderPresets();
      updateStart();
    });
    box.appendChild(b);
  }
}

function updateStart() {
  const intent = U.q('#intent').value.trim();
  U.q('#start').textContent = `Bắt đầu tập trung ${selected}′`;
  U.q('#sub').textContent = intent ? intent.slice(0, 46) : 'sẵn sàng cho một phiên sâu';
}

U.q('#start').addEventListener('click', () => {
  window.tomato.action('focus:start', { minutes: selected, intent: U.q('#intent').value.trim() });
  window.tomato.action('menu:close');
});

U.q('#intent').addEventListener('input', updateStart);
U.q('#intent').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') U.q('#start').click();
});

U.q('#to-breathe').addEventListener('click', () => show('breathe'));
U.q('#short-break').addEventListener('click', () => {
  window.tomato.action('break:start');
  window.tomato.action('menu:close');
});
U.q('#open-settings').addEventListener('click', () => window.tomato.action('settings:open'));
U.q('#hide-orb').addEventListener('click', () => {
  window.tomato.action('orbs:set', { hide: true });
  window.tomato.action('menu:close');
});
U.q('#close').addEventListener('click', () => window.tomato.action('menu:close'));

U.qa('.tg').forEach((b) => {
  b.addEventListener('click', () => {
    const k = b.dataset.tg;
    if (k === 'guide') window.tomato.action('settings:set', { patch: { guideAudio: !st.settings.guideAudio } });
    else if (k === 'ambient') show('ambient');
  });
});

/* ---------- hít thở ---------- */

function renderPatterns() {
  const box = U.q('#patterns');
  box.innerHTML = '';
  for (const p of st.patterns) {
    const el = document.createElement('button');
    el.className = 'pat';
    el.innerHTML = `
      <span class="ico">${U.esc(p.icon || '○')}</span>
      <span style="flex:1">
        <span class="nm">${U.esc(p.name)}<span class="tg2">${U.esc(p.tag)}</span></span>
        <span class="ds">${U.esc(p.goal)} — ${U.esc(p.desc)}</span>
      </span>
      <span class="dur">${Math.round(p.seconds / 60)}′</span>`;
    el.addEventListener('click', () => {
      window.tomato.action('breathe:start', { patternId: p.id });
      window.tomato.action('menu:close');
    });
    box.appendChild(el);
  }
}

/* ---------- âm thanh ---------- */

function renderAmbients() {
  const box = U.q('#ambients');
  box.innerHTML = '';
  for (const [id, label] of AMBIENTS) {
    const b = document.createElement('button');
    b.className = `chip${st.settings.ambient === id ? ' sel' : ''}`;
    b.textContent = label;
    b.addEventListener('click', () => {
      window.tomato.action('ambient:set', { kind: id });
      renderAmbients();
    });
    box.appendChild(b);
  }
  U.q('#amb-vol').value = String(st.settings.ambientVolume);
  U.q('#beat').value = String(st.settings.binauralBeat);
  U.q('#beat-val').textContent = `${st.settings.binauralBeat} Hz`;
  U.q('#beat-wrap').style.display = st.settings.ambient === 'binaural' ? 'block' : 'none';
}

U.q('#amb-vol').addEventListener('input', (e) => {
  window.tomato.action('ambient:set', { kind: st.settings.ambient, volume: Number(e.target.value) });
});
U.q('#beat').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  U.q('#beat-val').textContent = `${v} Hz`;
  window.tomato.action('settings:set', { patch: { binauralBeat: v } });
});

/* ---------- vẽ ---------- */

const sig = { presets: '', ambient: '', today: '' };

function paint(next) {
  st = next;
  const s = st.settings;
  document.body.classList.toggle('running', st.mode !== 'idle');

  U.q('#today-count').textContent = `${st.today.focus}/${st.goal} phiên hôm nay`;
  U.q('#streak').textContent = `🔥 ${st.streak.current} ngày`;
  U.q('#today-fill').style.width = `${Math.round(st.goalProgress * 100)}%`;

  const mins = Math.round(st.today.seconds / 60);
  const parts = [];
  if (mins) parts.push(`${mins} phút tập trung`);
  if (st.today.breathingSeconds) parts.push(`${Math.round(st.today.breathingSeconds / 60)} phút hít thở`);
  if (st.today.aborts) parts.push(`${st.today.aborts} lần dừng sớm`);
  U.q('#today-sub').textContent = parts.length ? parts.join(' · ') : 'chưa có gì hôm nay — bắt đầu nhẹ nhàng thôi';

  const psig = s.focusPresets.join(',');
  if (psig !== sig.presets) {
    sig.presets = psig;
    if (!s.focusPresets.includes(selected)) selected = s.focusMin;
    renderPresets();
  }
  updateStart();

  const amb = AMBIENTS.find((a) => a[0] === s.ambient);
  U.q('#amb-label').textContent = s.ambient === 'off' ? 'đang tắt' : (amb ? amb[1] : s.ambient);
  U.qa('.tg')[0].classList.toggle('on', s.ambient !== 'off');
  U.qa('.tg')[1].classList.toggle('on', !!s.guideAudio);

  const asig = `${s.ambient}|${s.ambientVolume}|${s.binauralBeat}`;
  if (asig !== sig.ambient) {
    sig.ambient = asig;
    renderAmbients();
  }
  if (!sig.today) {
    sig.today = '1';
    renderPatterns();
  }
}

U.drag(U.q('#head'), null);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.tomato.action('menu:close');
});

window.tomato.onNav((v) => show(v === 'main' ? 'main' : v));
window.tomato.onState(paint);
window.tomato.getState().then(paint);
