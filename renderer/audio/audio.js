'use strict';

let state = null;

function apply() {
  if (!state) return;
  Sound.setVolume(state.settings.volume);
}

window.tomato.onEvent((ev) => {
  if (!ev) return;
  if (ev.type === 'cue') {
    if (state && !state.settings.sound) return;
    Sound.cue(ev.cue, state ? state.settings.volume : 0.6);
  } else if (ev.type === 'ambient') {
    Sound.ambient(ev.kind, ev.volume, ev.beat);
  } else if (ev.type === 'phase') {
    if (state && !state.settings.guideAudio) return;
    Sound.guide(ev.kind, ev.dur);
  } else if (ev.type === 'pattern') {
    if (state && !state.settings.guideAudio) return;
    const first = ev.pattern && ev.pattern.steps && ev.pattern.steps[0];
    if (first) Sound.guide(first.k, first.s);
  }
});

window.tomato.onState((st) => {
  const before = state;
  state = st;
  apply();
  if (!before || before.settings.ambient !== st.settings.ambient || before.settings.ambientVolume !== st.settings.ambientVolume) {
    Sound.ambient(st.settings.ambient, st.settings.ambientVolume, st.settings.binauralBeat);
  }
});

window.tomato.getState().then((st) => {
  state = st;
  apply();
  Sound.ambient(st.settings.ambient, st.settings.ambientVolume, st.settings.binauralBeat);
});

/* Trình duyệt có thể treo AudioContext khi cửa sổ ẩn — đánh thức định kỳ. */
setInterval(() => Sound.resume(), 4000);
