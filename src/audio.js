import * as Tone from 'tone';

// C major pentatonic pitch classes. Every key snaps to the nearest one.
const SCALE = [0, 2, 4, 7, 9];

export function snapToScale(midi) {
  for (let d = 0; d < 12; d++) {
    if (SCALE.includes((midi + d) % 12)) return midi + d;   // ties go up
    if (SCALE.includes((((midi - d) % 12) + 12) % 12)) return midi - d;
  }
  return midi;
}

const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.005, decay: 0.3, sustain: 0.35, release: 0.8 },
}).toDestination();
synth.volume.value = -8;

const freq = (midi) => Tone.Frequency(snapToScale(midi), 'midi').toFrequency();

// iOS only lets audio start inside a gesture that counts as "user activation" — touchend /
// pointerup / click, not touchstart / pointerdown. So unlock on release, and keep trying on
// every release until the context is actually running.
// audioSession 'playback' makes Safari (16.4+) play even with the ring/silent switch on mute.
const running = () => Tone.getContext().state === 'running';

function unlock() {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  if (!running()) Tone.start();
}

for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
  document.addEventListener(ev, unlock, true);
}

// Note sounds for as long as the key is held. Before the first unlock there is no sound;
// never queue notes behind a pending start() — on iOS that promise can hang forever.
export function noteOn(midi) {
  if (!running()) { unlock(); return; }
  synth.triggerAttack(freq(midi));
}

export function noteOff(midi) {
  if (running()) synth.triggerRelease(freq(midi));
}
