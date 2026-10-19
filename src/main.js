import { createKeyboard } from './keyboard.js';
import { noteOn, noteOff, unlock, setInstrument, INSTRUMENTS, loadTrack, playTrack, stopTrack, songTime } from './audio.js';
import { createStage } from './render.js';
import { createLane } from './lane.js';
import { SCRIPT, TRACK } from './script.js';

const WINDOW = 0.15;  // a tap counts if it's within this many seconds of the note (♪ = 0.34 s)
const LEAD = 1.2;     // the answer key starts glowing this long before its note

// iOS Safari ignores user-scalable=no: block double-tap zoom and pinch zoom by hand.
// Pointer events still fire, so the keys keep working.
document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Start screen: the tap that dismisses it is the gesture iOS needs to open audio,
// and it starts the song. It comes back as the end screen after move 44.
const start = document.getElementById('start');
start.addEventListener('pointerup', () => {
  unlock();
  restart();
  start.classList.add('gone');
});

// Instrument audition: tap to cycle through the sampled instruments.
const instrumentBtn = document.getElementById('instrument');
const names = Object.keys(INSTRUMENTS);
let instrumentIndex = 0;
instrumentBtn.addEventListener('pointerup', () => {
  instrumentIndex = (instrumentIndex + 1) % names.length;
  setInstrument(names[instrumentIndex]);
  instrumentBtn.textContent = `♪ ${INSTRUMENTS[names[instrumentIndex]].label}`;
});

loadTrack(TRACK);
const stage = createStage(document.getElementById('board'));
const progress = document.getElementById('progress');

// Every note to play, in order. The knight dances its phrase's move on the first note of the
// phrase that's hit; a phrase with every note missed still gets its stage effects.
const CHART = SCRIPT.flatMap((step) => step.notes.map((n, k) => ({ ...n, step, last: k === step.notes.length - 1 })));
let lane;
let next;
let hits;
let danced;

function restart() {
  next = 0;
  hits = 0;
  danced = new Set();
  stage.reset();
  lane = createLane(document.getElementById('score'), CHART);
  progress.textContent = `0 / ${CHART.length}`;
  playTrack();
}

// Settles the next note, hit or missed, and moves on.
function settle(hit) {
  const { step, last } = CHART[next];
  let pos = null;
  if (hit) {
    hits++;
    if (!danced.has(step)) {
      danced.add(step);
      pos = stage.play(step, true);
    }
  } else if (last && !danced.has(step)) {
    stage.play(step, false);
  }
  lane.mark(next, hit, pos);
  progress.textContent = `${hits} / ${CHART.length}`;
  next++;
  if (next === CHART.length) end();
}

function end() {
  setTimeout(() => {
    stopTrack();
    start.querySelector('.title').textContent = `끝 · ${hits} / ${CHART.length}`;
    start.querySelector('.hint').textContent = '탭해서 다시';
    start.classList.add('end');
    start.classList.remove('gone');
  }, 6000);
}

// Game clock: scroll the lane, light the coming key, and let notes that slipped past go.
function frame() {
  const t = songTime();
  if (t !== null) {
    lane.scroll(t);
    while (next < CHART.length && t > CHART[next].time + WINDOW) settle(false);
    const note = CHART[next];
    keyboard.setTarget(note && note.time - t < LEAD ? note.midi : null);
  }
  requestAnimationFrame(frame);
}

const keyboard = createKeyboard(document.getElementById('keyboard'), {
  onDown(note) {
    noteOn(note.midi);
    const t = songTime();
    const want = CHART[next];
    if (t === null || !want || Math.abs(t - want.time) > WINDOW) return;   // off the beat: just a note
    if (note.midi % 12 === want.midi % 12) settle(true);
    else keyboard.wrong(note);
  },
  onUp(note) {
    noteOff(note.midi);
  },
});

requestAnimationFrame(frame);
