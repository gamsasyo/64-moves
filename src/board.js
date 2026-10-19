const SIZE = 8;
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

const inside = ({ x, y }) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const same = (a, b) => a.x === b.x && a.y === b.y;
const hops = (p) => KNIGHT.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter(inside);

// Squares that can land on a goal in exactly k knight moves (knights alternate square colour,
// so "at most k" isn't enough).
function reachIn(k, goals, blocked) {
  let set = goals;
  for (let i = 0; i < k; i++) {
    set = [...new Map(set.flatMap(hops).filter((q) => !(blocked && same(q, blocked)))
      .map((q) => [`${q.x},${q.y}`, q])).values()];
  }
  return set;
}

// One random knight move from `from`, never onto `blocked`.
// With a goal, only moves that can still reach it within `left` more moves count.
export function randomKnight(from, { blocked, goal, left } = {}) {
  let options = hops(from).filter((q) => !(blocked && same(q, blocked)));
  if (goal) {
    const ready = reachIn(left - 1, goal, blocked);
    const ok = options.filter((q) => ready.some((r) => same(q, r)));
    if (ok.length) options = ok;
  }
  return options[Math.floor(Math.random() * options.length)];
}

// The ㄱ path for a knight move: the long leg first, then the turn.
export function knightPath(from, to) {
  const corner = Math.abs(to.x - from.x) === 2 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  return [from, corner, to];
}
