import { randomKnight, knightPath } from './board.js';
import { START, BIKE_HOME, GOAL, LAST_L } from './script.js';

const BIKE_SVG = `<svg viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.6"
  stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="13" r="5.5"/><circle cx="25" cy="13" r="5.5"/>
  <path d="M7 13 12 5h11l2 8M12 5l5 8h8M23 5l-1-3h3M11 3h3"/></svg>`;

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const toCss = (p) => `translate(${p.x * 100}%, ${p.y * 100}%)`;

// Quadratic bend from a through c to b, sampled into points.
function bend(a, c, b, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return pts;
}

// Slide an element through `points` (board squares, may be fractional), evenly by distance.
function moveAlong(el, points, ms) {
  for (const a of el.getAnimations()) a.finish();
  const lens = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + dist(points[i - 1], points[i]));
  const total = lens[lens.length - 1] || 1;
  const frames = points.map((p, i) => ({ transform: toCss(p), offset: lens[i] / total }));
  el.style.transform = toCss(points[points.length - 1]);
  el.animate(frames, { duration: ms, easing: 'cubic-bezier(.4, 0, .2, 1)' });
}

// The stage: one knight dancer, a bicycle, rain and fireworks over the 8×8 floor.
export function createStage(boardEl) {
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    const x = i % 8;
    const y = Math.floor(i / 8);
    cell.className = (x + y) % 2 ? 'cell dark' : 'cell';
    boardEl.appendChild(cell);
  }

  const rain = document.createElement('div');
  rain.className = 'rain';
  for (let i = 0; i < 70; i++) {
    const d = document.createElement('i');
    d.style.left = `${Math.random() * 110 - 5}%`;
    d.style.animationDelay = `${-Math.random() * 2}s`;
    d.style.animationDuration = `${0.5 + Math.random() * 0.4}s`;
    rain.appendChild(d);
  }

  const bike = document.createElement('div');
  bike.className = 'bike';
  bike.innerHTML = BIKE_SVG;

  const knight = document.createElement('div');
  knight.className = 'piece white';
  knight.textContent = '♞︎';   // force text glyph, not emoji, on iOS

  const sky = document.createElement('div');   // fireworks layer
  sky.className = 'sky';

  boardEl.append(rain, bike, knight, sky);

  let pos;
  let bikePos;
  let riding;
  let show;   // repeating fireworks after the last move

  // Afterimage fades out where the dancer just was.
  const ghost = (at) => {
    const g = document.createElement('div');
    g.className = 'piece white ghost';
    g.textContent = knight.textContent;
    g.style.transform = toCss(at);
    g.addEventListener('animationend', () => g.remove());
    boardEl.insertBefore(g, knight);
  };

  const go = (points, ms) => {
    ghost(pos);
    moveAlong(knight, [pos, ...points], ms);
    if (riding) moveAlong(bike, [bikePos, ...points], ms);
    pos = points[points.length - 1];
    if (riding) bikePos = pos;
  };

  const moveBike = (to, ms = 900) => {
    moveAlong(bike, [bikePos, to], ms);
    bikePos = to;
  };

  const burst = (x, y, size) => {
    const b = document.createElement('div');
    b.className = 'burst';
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    b.style.setProperty('--r', `${size}px`);
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('i');
      s.style.setProperty('--a', `${(i * 360) / 16}deg`);
      b.appendChild(s);
    }
    b.addEventListener('animationend', () => b.remove());
    sky.appendChild(b);
  };
  const randomBurst = (big) => burst(15 + Math.random() * 70, 10 + Math.random() * 45, big ? 60 + Math.random() * 40 : 50);

  const setRain = (v, seconds) => {
    rain.style.transitionDuration = `${seconds}s`;
    rain.style.opacity = v;
  };

  function reset() {
    clearInterval(show);
    for (const a of [...knight.getAnimations(), ...bike.getAnimations()]) a.cancel();
    sky.replaceChildren();
    setRain(0, 0);
    pos = START;
    bikePos = { x: 8, y: 7 };   // waiting just off the bottom-right corner
    riding = false;
    knight.style.transform = toCss(pos);
    bike.style.transform = toCss(bikePos);
    bike.classList.remove('shown');
    knight.classList.remove('riding');
  }
  reset();

  return {
    reset,
    // Runs one numbered step of the script. On a miss (danced = false) the stage effects
    // still happen but the knight stays put. Returns where the knight ends up.
    play({ n, move, fx }, danced = true) {
      if (!danced) move = {};   // missed cue: the knight stays put
      if (move.grid) go(move.grid, 260 * dist(pos, move.grid[0]) + 150);
      else if (move.curve) go(bend(pos, move.curve.via, move.curve.to), 1100);
      else if (move.glide) go([move.glide], 900);
      else if (move.free) go(move.free.length > 1 ? move.free : bend(pos, { x: (pos.x + move.free[0].x) / 2 + 1, y: (pos.y + move.free[0].y) / 2 }, move.free[0]), 1000);
      else if (move.L) {
        const late = n > 35;   // after the ride: the bike sits on its square, and 43 must end beside it
        const to = randomKnight(pos, late ? { blocked: BIKE_HOME, goal: GOAL, left: LAST_L - n + 1 } : {});
        go(knightPath(pos, to).slice(1), 650);
      }

      if (fx?.bike === 'enter') {
        bike.classList.add('shown');
        moveBike({ x: 7, y: 7 });
      } else if (fx?.bike === 'approach') {
        moveBike({ x: (bikePos.x + pos.x) / 2, y: (bikePos.y + pos.y) / 2 }, 1400);
      } else if (fx?.bike === 'board') {
        moveBike(pos, 900);
        riding = true;
        knight.classList.add('riding');
      } else if (fx?.bike === 'leave') {
        riding = false;
        knight.classList.remove('riding');
        moveBike(fx.at, 1400);
      }
      if (fx?.rain !== undefined) setRain(fx.rain, fx.rain ? 14 : 8);
      if (fx?.firework === 'one') burst(70, 25, 55);
      else if (fx?.firework === 'many') {
        randomBurst(true);
        show = setInterval(() => randomBurst(true), 450);
      }
      return pos;
    },
  };
}
