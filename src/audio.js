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

// Salamander Grand Piano samples (Alexander Holm, CC-BY 3.0), self-hosted in public/samples.
// Sampler pitch-shifts the nearest sample to fill the notes in between.
const reverb = new Tone.Reverb({ decay: 3.5, preDelay: 0.02, wet: 0.3 }).toDestination();

let loaded = false;
const piano = new Tone.Sampler({
  urls: {
    A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
    A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3',
  },
  baseUrl: `${import.meta.env.BASE_URL}samples/`,
  release: 1,
  onload: () => { loaded = true; },
}).connect(reverb);

const freq = (midi) => Tone.Frequency(snapToScale(midi), 'midi').toFrequency();

// iOS only lets audio start inside a gesture that counts as "user activation" — touchend /
// pointerup / click, not touchstart / pointerdown. So unlock on release, and keep trying on
// every release until the context is actually running.
// audioSession 'playback' makes Safari (16.4+) play even with the ring/silent switch on mute.
const running = () => Tone.getContext().state === 'running';

export function unlock() {
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
  if (loaded) piano.triggerAttack(freq(midi));
}

export function noteOff(midi) {
  if (running() && loaded) piano.triggerRelease(freq(midi));
}
