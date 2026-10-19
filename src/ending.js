import { BIKE_SVG } from './render.js';

// The closing scene after a cleared game, from the choreographer's sketch, looping forever:
//   scene 1 — the pieces enter from outside: ① queen down, ② pawn up, ③ rook leftward,
//             ④ bishop diagonally in; the knight on its bike rolls in bottom right
//   scene 2 — they settle into a rising row (queen, bishop, pawn, rook), then the knight rides
//             a big arc up and away to the top left under fireworks, and the others follow it
//             out along the same curve; the empty stage starts again.
// Positions are in squares of an invisible 8×8 floor (no board drawn).

const toCss = (p) => `translate(${p.x * 100}%, ${p.y * 100}%)`;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Slide through `points`, evenly by distance, holding the end.
function along(el, points, ms, easing = 'ease-in-out') {
  const lens = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + dist(points[i - 1], points[i]));
  const total = lens[lens.length - 1] || 1;
  return el.animate(points.map((p, i) => ({ transform: toCss(p), offset: lens[i] / total })), {
    duration: ms, easing, fill: 'forwards',
  }).finished.catch(() => {});
}

const ROW = { queen: { x: 0.6, y: 6.3 }, bishop: { x: 1.9, y: 5.7 }, pawn: { x: 3.2, y: 5.1 }, rook: { x: 4.5, y: 4.5 } };

export function createEnding(stageEl) {
  const make = (cls, html) => {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    stageEl.appendChild(el);
    return el;
  };
  const piece = {
    queen: make('e-piece', '♛︎'),
    pawn: make('e-piece', '♟︎'),
    rook: make('e-piece', '♜︎'),
    bishop: make('e-piece', '♝︎'),
  };
  const bike = make('e-bike', BIKE_SVG);
  const knight = make('e-piece riding', '♞︎');
  const sky = make('sky', '');

  const burst = () => {
    const b = document.createElement('div');
    b.className = 'burst';
    b.style.left = `${15 + Math.random() * 70}%`;
    b.style.top = `${8 + Math.random() * 40}%`;
    b.style.setProperty('--r', `${50 + Math.random() * 50}px`);
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('i');
      s.style.setProperty('--a', `${(i * 360) / 16}deg`);
      b.appendChild(s);
    }
    b.addEventListener('animationend', () => b.remove());
    sky.appendChild(b);
  };

  let run = 0;   // bumped on every start/stop, so a stopped loop never carries on
  let show;

  const all = () => [...Object.values(piece), bike, knight];
  const rider = (points, ms, easing) => Promise.all([along(bike, points, ms, easing), along(knight, points, ms, easing)]);

  const START = [
    [piece.queen, { x: 3.5, y: -1.5 }], [piece.pawn, { x: 1.2, y: 9 }], [piece.rook, { x: 9, y: 3.2 }],
    [piece.bishop, { x: 8.6, y: -1.6 }], [bike, { x: 9, y: 6.3 }], [knight, { x: 9, y: 6.3 }],
  ];

  async function loop(me) {
    const live = () => run === me;
    while (live()) {
      // Everyone waits just outside the stage.
      for (const [el, at] of START) {
        for (const a of el.getAnimations()) a.cancel();
        el.style.transform = toCss(at);
        el.style.opacity = 1;
      }
      // Scene 1: entrances, one after another.
      rider([{ x: 9, y: 6.3 }, { x: 6.2, y: 6.3 }], 2600, 'ease-out');
      along(piece.queen, [{ x: 3.5, y: -1.5 }, { x: 3.5, y: 6.2 }], 2600);
      await sleep(1400);
      along(piece.pawn, [{ x: 1.2, y: 9 }, { x: 1.2, y: 5.6 }], 2000);
      await sleep(1400);
      along(piece.rook, [{ x: 9, y: 3.2 }, { x: 0.6, y: 3.2 }], 2800);
      await sleep(1400);
      await along(piece.bishop, [{ x: 8.6, y: -1.6 }, { x: 3.8, y: 3.2 }], 2600);
      if (!live()) return;
      await sleep(1200);

      // Scene 2: the row forms, the knight rides off, fireworks.
      for (const [name, at] of Object.entries(ROW)) {
        const from = new DOMMatrix(getComputedStyle(piece[name]).transform);
        const w = piece[name].offsetWidth;
        along(piece[name], [{ x: from.e / w, y: from.f / w }, at], 2200);
      }
      await sleep(2000);
      if (!live()) return;
      burst();
      show = setInterval(burst, 550);
      // The knight rides a big arc up and off to the top left; the others fall in behind it
      // one by one (rook, pawn, bishop, queen) and leave along the very same curve.
      const RIDE = [
        { x: 6.2, y: 6.3 }, { x: 6.6, y: 4.8 }, { x: 6.5, y: 3 }, { x: 5.8, y: 1.6 },
        { x: 4.4, y: 0.8 }, { x: 2.6, y: 0.7 }, { x: 1, y: 1 }, { x: -1.6, y: 1.6 },
      ];
      const leaving = [rider(RIDE, 6000)];
      for (const name of ['rook', 'pawn', 'bishop', 'queen']) {
        await sleep(1100);
        if (!live()) return;
        leaving.push(along(piece[name], [ROW[name], ...RIDE], 6500));
      }
      await Promise.all(leaving);
      await sleep(800);
      clearInterval(show);
      await sleep(1200);
    }
  }

  return {
    start() {
      loop(++run);
    },
    stop() {
      run++;
      clearInterval(show);
      sky.replaceChildren();
      for (const el of all()) for (const a of el.getAnimations()) a.cancel();
    },
  };
}
