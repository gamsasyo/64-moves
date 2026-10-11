const SIZE = 8;

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const RULES = {
  rook:   { dirs: ORTHO, slides: true },
  bishop: { dirs: DIAG, slides: true },
  queen:  { dirs: [...ORTHO, ...DIAG], slides: true },
  knight: { dirs: KNIGHT, slides: false },
};

// Two sets of five, facing each other in the middle. y = 0 is the top row.
// Pawns carry a walking direction (-1 = up, +1 = down) that flips when they turn around.
export function createBoard() {
  const set = (color, y, dir) => [
    ['pawn', '♟'], ['knight', '♞'], ['bishop', '♝'], ['rook', '♜'], ['queen', '♛'],
  ].map(([type, glyph], i) => ({
    id: `${color[0]}-${type}`, type, color, glyph, x: 2 + i, y,
    ...(type === 'pawn' && { dir }),
  }));
  return [...set('white', 5, -1), ...set('black', 2, 1)];
}

const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const occupied = (pieces, x, y) => pieces.some((p) => p.x === x && p.y === y);

// Pawn steps one square forward; if the edge or another piece is in the way,
// it turns around and steps back instead.
function pawnStep(pieces, p) {
  for (const dir of [p.dir, -p.dir]) {
    const y = p.y + dir;
    if (inside(p.x, y) && !occupied(pieces, p.x, y)) return { x: p.x, y, dir };
  }
  return null;
}

// Every square the piece can reach this turn, sliding up to `distance`.
// Never leaves the board, never lands on or passes through another piece.
function candidates(pieces, piece, distance) {
  const { dirs, slides } = RULES[piece.type];
  const out = [];
  for (const [dx, dy] of dirs) {
    const steps = slides ? distance : 1;
    let reached = null;
    for (let s = 1; s <= steps; s++) {
      const x = piece.x + dx * s;
      const y = piece.y + dy * s;
      if (!inside(x, y) || occupied(pieces, x, y)) break;
      reached = { x, y, dy: Math.sign(dy), len: s };
    }
    if (reached) out.push(reached);
  }
  return out;
}

// Rising melody → move up the board (dy = -1), falling → down.
// Prefer matching direction, then the longest move; random among ties.
function pick(options, contour) {
  if (!options.length) return null;
  const wantDy = -contour;
  const score = (o) => (contour && o.dy === wantDy ? 100 : 0) + o.len + Math.random();
  return options.reduce((best, o) => (score(o) > score(best) ? o : best));
}

// Moves exactly one piece. Returns false if it was boxed in.
export function applyPhrase(pieces, action) {
  const p = pieces.find((q) => q.id === action.piece);
  if (p.type === 'pawn') {
    const step = pawnStep(pieces, p);
    if (!step) return false;
    Object.assign(p, step);
    return true;
  }
  const target = pick(candidates(pieces, p, action.distance), action.contour);
  if (!target) return false;
  p.x = target.x;
  p.y = target.y;
  return true;
}
