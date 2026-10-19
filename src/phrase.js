const GAP_MS = 400;      // silence that ends a phrase
const MAX_NOTES = 8;     // cap so non-stop playing still moves pieces
const MAX_MS = 1500;

// Which role a key plays. Black keys: one per role. White keys: 8 keys over 5 roles,
// each sitting under the black key of the same role.
const ROLE = {
  61: 'pawn', 63: 'knight', 66: 'bishop', 68: 'rook', 70: 'queen',
  60: 'pawn', 62: 'pawn', 64: 'knight', 65: 'bishop', 67: 'bishop',
  69: 'rook', 71: 'queen', 72: 'queen',
};

// Turns a list of notes into a single piece's move. The first key decides who moves:
// white key → white piece, black key → black piece.
// → { piece, distance, contour }
export function interpret(notes) {
  const first = notes[0];
  const last = notes[notes.length - 1];
  return {
    piece: `${first.isBlack ? 'b' : 'w'}-${ROLE[first.midi]}`,
    distance: notes.length,
    contour: Math.sign(last.midi - first.midi),   // +1 rising, -1 falling, 0 flat
  };
}

// onUpdate(notes) fires on every note (for the "about to move" glow).
// onPhrase(notes) fires once the phrase ends.
// Silence is counted from the last key *release*, so a held note never gets cut into two phrases.
export function createPhraseTracker({ onUpdate, onPhrase }) {
  let notes = [];
  let held = 0;
  let gapTimer = null;
  let maxTimer = null;

  const end = () => {
    clearTimeout(gapTimer);
    clearTimeout(maxTimer);
    if (notes.length) onPhrase(notes);
    notes = [];
  };

  return {
    down(note) {
      held++;
      clearTimeout(gapTimer);
      if (!notes.length) maxTimer = setTimeout(end, MAX_MS);
      notes.push(note);
      onUpdate(notes);
      if (notes.length >= MAX_NOTES) end();
    },
    up() {
      held = Math.max(0, held - 1);
      if (!held && notes.length) gapTimer = setTimeout(end, GAP_MS);
    },
  };
}
