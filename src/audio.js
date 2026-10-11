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

// iOS only allows audio after a user gesture; first tap unlocks it.
let ready = null;

// Note sounds for as long as the key is held.
export function noteOn(midi) {
  ready ??= Tone.start();
  ready.then(() => synth.triggerAttack(freq(midi)));
}

export function noteOff(midi) {
  ready?.then(() => synth.triggerRelease(freq(midi)));
}
