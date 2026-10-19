import { createKeyboard } from './keyboard.js';
import { noteOn, noteOff, unlock, setInstrument, setSnap, INSTRUMENTS, loadTrack, playTrack, stopTrack, songTime, loadEnding, playEnding, stopEnding } from './audio.js';
import { createPhraseTracker, interpret } from './phrase.js';
import { createBoard, applyPhrase } from './chess.js';
import { createRenderer } from './pieces.js';
import { createScore } from './score.js';
import { createStage } from './render.js';
import { createLane } from './lane.js';
import { SCRIPT, TRACK } from './script.js';
import { createEnding } from './ending.js';

const WINDOW = 0.22;  // a tap counts if it's within this many seconds of the note (♪ = 0.34 s)
const LEAD = 1.2;     // the answer key starts glowing this long before its note

// Life gauge (0 … 100): a hit fills it, a missed note or a wrong key drains it; empty = game over.
const LIFE = { start: 60, hit: 4, miss: 12, wrong: 6 };

// iOS Safari ignores user-scalable=no: block double-tap zoom and pinch zoom by hand.
// Pointer events still fire, so the keys keep working.
document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Start screen: the tap that dismisses it is the gesture iOS needs to open audio,
// so the very first key already sounds.
const start = document.getElementById('start');
start.addEventListener('pointerup', () => {
  unlock();
  start.classList.add('gone');
  start.addEventListener('transitionend', () => start.remove(), { once: true });
}, { once: true });

// Instrument audition: tap to cycle through the sampled instruments.
const instrumentBtn = document.getElementById('instrument');
const names = Object.keys(INSTRUMENTS);
let instrumentIndex = 0;
instrumentBtn.addEventListener('pointerup', () => {
  instrumentIndex = (instrumentIndex + 1) % names.length;
  setInstrument(names[instrumentIndex]);
  instrumentBtn.textContent = `♪ ${INSTRUMENTS[names[instrumentIndex]].label}`;
});

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const desc = document.getElementById('desc');
const gameBtn = document.getElementById('game');
const result = document.getElementById('result');

// Two modes share the stage, score strip and keyboard:
// free play (default) — any phrase moves one of ten pieces;
// rhythm game — play the circled notes along the track and the knight dances the script.
let mode = null;

gameBtn.addEventListener('pointerup', () => (mode === 'rhythm' ? enterFree() : enterRhythm()));
document.getElementById('again').addEventListener('pointerup', () => {
  result.classList.add('gone');
  restart();
});
document.getElementById('leave').addEventListener('pointerup', () => {
  result.classList.add('gone');
  enterFree();
});

// ---------- free play ----------

let pieces;
let renderer;
let score;

function enterFree() {
  if (mode === 'rhythm') {
    stopTrack();
    clearTimeout(endTimer);
    stage.reset();
    keyboard.setTarget(null);
  }
  mode = 'free';
  document.body.classList.remove('rhythm');
  setSnap(true);
  desc.textContent = '건반을 치면 말이 움직입니다.';
  gameBtn.textContent = '▶ 리듬게임';
  boardEl.replaceChildren();
  scoreEl.replaceChildren();
  pieces = createBoard();
  renderer = createRenderer(boardEl, pieces);
  renderer.draw();
  score = createScore(scoreEl);
}

const phrase = createPhraseTracker({
  onUpdate(notes) {
    if (mode === 'free') renderer.glow([interpret(notes).piece]);
  },
  onPhrase(notes) {
    if (mode !== 'free') return;
    const action = interpret(notes);
    const moved = applyPhrase(pieces, action);
    renderer.glow([]);
    renderer.draw();
    score.bar({ ...pieces.find((p) => p.id === action.piece), moved });
    if (!moved) renderer.shake([action.piece]);
  },
});

const finishers = new Map();   // note → turns its score head into the right note value

// ---------- rhythm game ----------

// Every note to play, in order. The knight dances its phrase's move on the first note of the
// phrase that's hit; a phrase with every note missed still gets its stage effects.
const CHART = SCRIPT.flatMap((step) => step.notes.map((n, k) => ({ ...n, step, first: k === 0, last: k === step.notes.length - 1 })));
let stage;
let lane;
let next;
let hits;
let life;
let danced;
let endTimer;
let trackLoaded = false;

function enterRhythm() {
  mode = 'rhythm';
  document.body.classList.add('rhythm');
  setSnap(false);
  desc.textContent = '빛나는 건반을 치면 나이트가 춤춥니다.';
  gameBtn.textContent = '✕ 나가기';
  if (!trackLoaded) {
    loadTrack(TRACK);
    loadEnding('audio/ending.mp3');
    trackLoaded = true;
  }
  boardEl.replaceChildren();
  stage = createStage(boardEl);
  restart();
}

function restart() {
  clearTimeout(endTimer);
  next = 0;
  hits = 0;
  life = LIFE.start;
  danced = new Set();
  stage.reset();
  lane = createLane(scoreEl, CHART);
  lane.gauge(life / 100);
  playTrack();
}

function changeLife(d) {
  life = Math.max(0, Math.min(100, life + d));
  lane.gauge(life / 100);
  if (life === 0) {
    stopTrack();
    keyboard.setTarget(null);
    showResult(`게임 오버 · ${hits} / ${CHART.length}`);
  }
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
  next++;
  changeLife(hit ? LIFE.hit : -LIFE.miss);
  if (life > 0 && next === CHART.length) {
    // Let the route finish drawing itself, then the closing scene takes over.
    endTimer = setTimeout(() => {
      stopTrack();
      showEnding();
    }, 6000);
  }
}

// Closing scene: loops with its song until "처음으로".
const endingEl = document.getElementById('ending');
const ending = createEnding(endingEl.querySelector('.stage'));

function showEnding() {
  endingEl.querySelector('.score').textContent = `${hits} / ${CHART.length}`;
  endingEl.classList.remove('gone');
  ending.start();
  playEnding();
}

document.getElementById('insta').addEventListener('pointerup', () => {
  window.open('https://www.instagram.com/pongdang_dance/', '_blank', 'noopener');
});
document.getElementById('home').addEventListener('pointerup', () => {
  endingEl.classList.add('gone');
  ending.stop();
  stopEnding();
  enterFree();
});

function showResult(text) {
  result.querySelector('.title').textContent = text;
  result.classList.remove('gone');
}

// Game clock: scroll the lane, light the coming key, and let notes that slipped past go.
function frame() {
  const t = songTime();
  if (mode === 'rhythm' && t !== null) {
    lane.scroll(t);
    // A miss can empty the gauge and stop the song mid-loop.
    while (songTime() !== null && next < CHART.length && t > CHART[next].time + WINDOW) settle(false);
    const note = CHART[next];
    if (songTime() !== null) keyboard.setTarget(note && note.time - t < LEAD ? note.midi : null);
  }
  requestAnimationFrame(frame);
}

// ---------- keys ----------

const keyboard = createKeyboard(document.getElementById('keyboard'), {
  onDown(note) {
    noteOn(note.midi);
    if (mode === 'free') {
      finishers.set(note, score.note(note));
      phrase.down(note);
      return;
    }
    const t = songTime();
    const want = CHART[next];
    if (t === null || !want || Math.abs(t - want.time) > WINDOW) return;   // off the beat: just a note
    if (note.midi % 12 === want.midi % 12) {
      keyboard.hit(note);
      // The stage flashes once a phrase, on its first note, once the knight rides free (19–).
      if (want.first && want.step.n >= 19) {
        boardEl.classList.remove('flash');
        void boardEl.offsetWidth;   // restart animation
        boardEl.classList.add('flash');
      }
      settle(true);
    }
    else {
      keyboard.wrong(note);
      changeLife(-LIFE.wrong);
    }
  },
  onUp(note, heldMs) {
    noteOff(note.midi);
    finishers.get(note)?.(heldMs);
    finishers.delete(note);
    phrase.up();
  },
});

enterFree();
requestAnimationFrame(frame);
