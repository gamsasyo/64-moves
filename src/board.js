const SIZE = 8;

// Loose ㄱ moves: not just the knight's 2+1, but any long leg (2–5) and a shorter turn (1–3),
// e.g. 4 then 2. Every direction.
const LEAPS = [];
for (let long = 2; long <= 5; long++) {
  for (let short = 1; short < long && short <= 3; short++) {
    for (const [a, b] of [[long, short], [short, long]]) {
      for (const sx of [1, -1]) for (const sy of [1, -1]) LEAPS.push([a * sx, b * sy]);
    }
  }
}

const inside = ({ x, y }) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const same = (a, b) => a.x === b.x && a.y === b.y;
const hops = (p) => LEAPS.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter(inside);

// Squares that can land on a goal in exactly k moves.
function reachIn(k, goals, blocked) {
  let set = goals;
  for (let i = 0; i < k; i++) {
    set = [...new Map(set.flatMap(hops).filter((q) => !(blocked && same(q, blocked)))
      .map((q) => [`${q.x},${q.y}`, q])).values()];
  }
  return set;
}

// One random ㄱ move from `from`, never onto `blocked`.
// With a goal, only moves that can still reach it in exactly `left` more moves count.
export function randomL(from, { blocked, goal, left } = {}) {
  let options = hops(from).filter((q) => !(blocked && same(q, blocked)));
  if (goal) {
    const ready = reachIn(left - 1, goal, blocked);
    const ok = options.filter((q) => ready.some((r) => same(q, r)));
    if (ok.length) options = ok;
  }
  return options[Math.floor(Math.random() * options.length)];
}

// The ㄱ path for a move: one leg, then the turn — long leg first or short leg first, at random.
export function lPath(from, to) {
  const corner = Math.random() < 0.5 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  return [from, corner, to];
}
