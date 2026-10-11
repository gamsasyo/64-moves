import { createKeyboard } from './keyboard.js';
import { noteOn, noteOff, unlock } from './audio.js';
import { createPhraseTracker, interpret } from './phrase.js';
import { createBoard, applyPhrase } from './board.js';
import { createRenderer } from './render.js';
import { createScore } from './score.js';

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

const pieces = createBoard();
const renderer = createRenderer(document.getElementById('board'), pieces);
renderer.draw();
const score = createScore(document.getElementById('score'));

const phrase = createPhraseTracker({
  onUpdate(notes) {
    renderer.glow([interpret(notes).piece]);
  },
  onPhrase(notes) {
    const action = interpret(notes);
    const moved = applyPhrase(pieces, action);
    renderer.glow([]);
    renderer.draw();
    score.bar({ ...pieces.find((p) => p.id === action.piece), moved });
    if (!moved) renderer.shake([action.piece]);
  },
});

const finishers = new Map();   // note → turns its score head into the right note value

createKeyboard(document.getElementById('keyboard'), {
  onDown(note) {
    noteOn(note.midi);
    finishers.set(note, score.note(note));
    phrase.down(note);
  },
  onUp(note, heldMs) {
    noteOff(note.midi);
    finishers.get(note)?.(heldMs);
    finishers.delete(note);
    phrase.up();
  },
});
