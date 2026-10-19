import * as Tone from 'tone';

// Sampled instruments, self-hosted in public/samples/<name>/ (all CC-BY 3.0:
// piano = Salamander Grand Piano by Alexander Holm, others = nbrosowsky/tonejs-instruments).
// Sampler pitch-shifts the nearest sample to fill the notes in between.
// `octave` shifts the whole keyboard (xylophone only sounds right an octave up).
const note = (n) => n.replace('s', '#');
const urls = (names) => Object.fromEntries(names.map((n) => [note(n), `${n}.mp3`]));

export const INSTRUMENTS = {
  piano:     { label: 'Piano',     octave: 0,  urls: urls(['A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5']) },
  harp:      { label: 'Harp',      octave: 0,  urls: urls(['G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5']) },
  guitar:    { label: 'Guitar',    octave: 0,  urls: urls(['A3', 'Cs4', 'E4', 'Fs4', 'Gs4', 'A4', 'B4', 'Cs5', 'E5']) },
  xylophone: { label: 'Xylophone', octave: 12, urls: urls(['G4', 'C5', 'G5', 'C6', 'G6']) },
};

// Keys sound right away (Tone's default 0.1 s look-ahead would lag every tap).
Tone.getContext().lookAhead = 0.01;

const reverb = new Tone.Reverb({ decay: 5, preDelay: 0.03, wet: 0.5 }).toDestination();

// Built on first use, then kept.
const samplers = {};
function sampler(name) {
  if (!samplers[name]) {
    const s = new Tone.Sampler({
      urls: INSTRUMENTS[name].urls,
      baseUrl: `${import.meta.env.BASE_URL}samples/${name}/`,
      release: 1,
      onload: () => { s.ready = true; },
    }).connect(reverb);
    samplers[name] = s;
  }
  return samplers[name];
}

let current = 'piano';
sampler(current);

export function setInstrument(name) {
  current = name;
  sampler(name);
}

const freq = (midi, name = current) =>
  Tone.Frequency(midi + INSTRUMENTS[name].octave, 'midi').toFrequency();

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
  const s = sampler(current);
  if (s.ready) s.triggerAttack(freq(midi));
}

// Release on every loaded instrument, in case the instrument changed while the key was held.
export function noteOff(midi) {
  if (!running()) return;
  for (const name in samplers) {
    const s = samplers[name];
    if (s.ready) s.triggerRelease(freq(midi, name));
  }
}

// Backing track. Its clock is the game clock: songTime() = seconds into the file.
let track;
let startedAt = null;

export function loadTrack(url) {
  track = new Tone.Player(`${import.meta.env.BASE_URL}${url}`).toDestination();
}

export async function playTrack() {
  await Tone.loaded();
  stopTrack();
  startedAt = Tone.immediate() + 0.15;
  track.start(startedAt);
}

export function stopTrack() {
  if (track?.state === 'started') track.stop();
  startedAt = null;
}

export const songTime = () => (startedAt === null ? null : Tone.immediate() - startedAt);
