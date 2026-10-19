import { randomL, lPath } from './board.js';
import { START, BIKE_HOME, GOAL, LAST_L } from './script.js';

export const BIKE_SVG = `<svg viewBox="0 0 32 20" fill="none" stroke="currentColor" stroke-width="1.6"
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

const MIN_RIDE = 3.5;   // shortest a ride move may be (squares)

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const onBoard = (p) => ({ x: clamp(p.x, 0.15, 6.85), y: clamp(p.y, 0.15, 6.85) });

// Cubic curve from a to b through controls c1, c2, sampled into points.
function cubic(a, c1, c2, b, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    pts.push({ x: k[0] * a.x + k[1] * c1.x + k[2] * c2.x + k[3] * b.x, y: k[0] * a.y + k[1] * c1.y + k[2] * c2.y + k[3] * b.y });
  }
  return pts;
}

const inside = (p) => p.x >= 0.15 && p.x <= 6.85 && p.y >= 0.15 && p.y <= 6.85;

// A winding, never-quite-predictable way from a to b: a swoop to one side or an S, sometimes
// with a little loop on the way. `vel` = the direction the knight is already travelling, so one
// move flows out of the last without a corner. Retries (calmer each time) until it stays on the board.
function wander(a, b, vel) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = (t, o) => ({ x: a.x + dx * t - (dy / len) * o, y: a.y + dy * t + (dx / len) * o });
  for (let tries = 0; ; tries++) {
    const calm = Math.max(0, 1 - tries / 10);
    const o1 = rand(-0.7, 0.7) * Math.max(len, 1.5) * calm;
    const o2 = (Math.random() < 0.5 ? o1 : -o1) * rand(0.4, 1);
    const c1 = vel ? { x: a.x + vel.x * len * 0.6 * calm, y: a.y + vel.y * len * 0.6 * calm } : off(0.33, o1);
    const pts = cubic(a, c1, off(0.66, o2), b);
    if (Math.random() < 0.3 * calm) {
      // a small loop-the-loop halfway
      const i = pts.length >> 1;
      const m = pts[i];
      const tx = pts[i + 1].x - pts[i - 1].x;
      const ty = pts[i + 1].y - pts[i - 1].y;
      const tl = Math.hypot(tx, ty) || 1;
      const side = Math.random() < 0.5 ? 1 : -1;
      const R = rand(0.35, 0.7);
      const c = { x: m.x - (ty / tl) * R * side, y: m.y + (tx / tl) * R * side };
      const a0 = Math.atan2(m.y - c.y, m.x - c.x);
      const loop = [];
      for (let k = 1; k < 16; k++) {
        const ang = a0 + side * (k / 16) * 2 * Math.PI;
        loop.push({ x: c.x + R * Math.cos(ang), y: c.y + R * Math.sin(ang) });
      }
      pts.splice(i + 1, 0, ...loop, m);
    }
    if (pts.every(inside) || tries > 20) return pts.map(onBoard);
  }
}

// The spiral from the sketch, drawn afresh each time: winds clockwise inward 1.5 turns
// from where the knight is, with a wobbling radius and a centre that drifts a little.
function spiralFrom(pos) {
  const c = { x: rand(3, 4), y: rand(3, 3.8) };
  const a0 = Math.atan2(pos.y - c.y, pos.x - c.x);
  const r0 = clamp(Math.hypot(pos.x - c.x, pos.y - c.y), 2.8, 3.2);
  const wob = rand(0.15, 0.35);
  const phase = rand(0, 6.3);
  const at = (deg) => {
    const t = deg / 540;
    const r = (r0 - (r0 - 1.2) * t) * (1 + wob * Math.sin(deg / 50 + phase) * (1 - t));
    const ang = a0 + (deg * Math.PI) / 180;
    return onBoard({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });
  };
  // Cut into six legs of equal length, so the tight inner turns travel as far as the outer ones.
  const pts = [];
  for (let d = 0; d <= 540; d += 2) pts.push(at(d));
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  const total = lens[lens.length - 1];
  const legs = [];
  let from = 0;
  for (let k = 1; k <= 6; k++) {
    let to = lens.findIndex((l) => l >= (total * k) / 6);
    if (to < 0) to = pts.length - 1;
    legs.push(pts.slice(from, to + 1));
    from = to;
  }
  return legs;
}

// Slide an element through `points` (board squares, may be fractional), evenly by distance.
function moveAlong(el, points, ms, easing = 'cubic-bezier(.4, 0, .2, 1)') {
  for (const a of el.getAnimations()) a.finish();
  const lens = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + dist(points[i - 1], points[i]));
  const total = lens[lens.length - 1] || 1;
  const frames = points.map((p, i) => ({ transform: toCss(p), offset: lens[i] / total }));
  el.style.transform = toCss(points[points.length - 1]);
  el.animate(frames, { duration: ms, easing });
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

  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  trail.setAttribute('class', 'trail');
  trail.setAttribute('viewBox', '0 0 8 8');

  boardEl.append(trail, rain, bike, knight, sky);

  let pos;
  let bikePos;
  let riding;
  let show;   // repeating fireworks after the last move
  let current;   // the phrase number being danced
  let path;   // every point the knight has passed, with the phrase number, for the closing drawing
  let spiral;   // this play's spiral, drawn when it starts
  let vel;      // direction the knight left its last off-grid move in

  // Afterimage fades out where the dancer just was.
  const ghost = (at) => {
    const g = document.createElement('div');
    g.className = 'piece white ghost';
    g.textContent = knight.textContent;
    g.style.transform = toCss(at);
    g.addEventListener('animationend', () => g.remove());
    boardEl.insertBefore(g, knight);
  };

  const go = (points, ms, easing) => {
    ghost(pos);
    path.push(...points.map((p) => ({ ...p, n: current })));
    moveAlong(knight, [pos, ...points], ms, easing);
    if (riding) moveAlong(bike, [bikePos, ...points], ms, easing);
    const before = points.length > 1 ? points[points.length - 2] : pos;
    pos = points[points.length - 1];
    const d = dist(before, pos) || 1;
    vel = { x: (pos.x - before.x) / d, y: (pos.y - before.y) / d };
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

  // The whole route, coloured by section, drawing itself in.
  const SECTION = [[14, '#9cf'], [18, '#7fd'], [27, '#fd7'], [34, '#f7a'], [99, '#c9f']];
  function drawTrail() {
    const colour = (n) => SECTION.find(([last]) => n <= last)[1];
    let run = [];
    const flush = () => {
      if (run.length < 2) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', run.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(' '));
      line.setAttribute('stroke', colour(run[run.length - 1].n));
      let len = 0;
      for (let i = 1; i < run.length; i++) len += dist(run[i - 1], run[i]);
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      trail.appendChild(line);
    };
    for (const p of path) {
      if (run.length && colour(p.n) !== colour(run[run.length - 1].n)) {
        flush();
        run = [run[run.length - 1]];
      }
      run.push(p);
    }
    flush();
  }

  function reset() {
    clearInterval(show);
    spiral = null;
    vel = null;
    path = [{ ...START, n: 0 }];
    trail.replaceChildren();
    for (const a of [...knight.getAnimations(), ...bike.getAnimations()]) a.cancel();
    sky.replaceChildren();
    setRain(0, 0);
    pos = START;
    bikePos = { x: 7, y: 7 };   // bottom-right square, hidden until 15
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
    play({ n, move, fx, dur }, danced = true) {
      if (!danced) move = {};
      current = n;   // missed cue: the knight stays put
      if (move.grid) go(move.grid, 260 * dist(pos, move.grid[0]) + 150);
      else if (move.curve) go(bend(pos, move.curve.via, move.curve.to), 1100);
      else if (move.glide) go([move.glide], 900);
      else if (move.ride || move.spiral !== undefined) {
        // Off the grid the knight drifts slowly, flowing right into the next phrase.
        const ms = Math.max(900, dur * 1000);
        if (move.ride) {
          // somewhere well low / high, always drifting sideways too, and never just a nudge:
          // the first candidate at least MIN_RIDE away, else the farthest one tried
          let to = null;
          for (let tries = 0; tries < 40; tries++) {
            const c = onBoard({
              x: pos.x + (pos.x < 2 ? 1 : pos.x > 5 ? -1 : Math.sign(Math.random() - 0.5)) * rand(1, 4),
              y: move.ride === 'down' ? rand(4.8, 6.8) : rand(0.2, 2.2),
            });
            if (!to || dist(pos, c) > dist(pos, to)) to = c;
            if (dist(pos, c) >= MIN_RIDE) { to = c; break; }
          }
          go(wander(pos, to, n > 19 && vel).slice(1), ms, n === 19 ? 'ease-in' : 'linear');
        } else if (move.spiral === 'out') {
          go(wander(pos, { x: rand(6.2, 6.8), y: rand(0.2, 0.8) }, vel).slice(1), ms, 'ease-in');
        } else {
          if (move.spiral === 0 || !spiral) spiral = spiralFrom(pos);
          go(spiral[move.spiral], ms, 'linear');
        }
      }
      else if (move.L) {
        const late = n > 35;   // after the ride: the bike sits on its square, and 43 must end beside it
        const to = randomL(pos, late ? { blocked: BIKE_HOME, goal: GOAL, left: LAST_L - n + 1 } : {});
        const legs = Math.abs(to.x - pos.x) + Math.abs(to.y - pos.y);
        go(lPath(pos, to).slice(1), Math.min(220 * legs + 250, Math.max(700, dur * 900)));
      }

      if (fx?.bike === 'enter') {
        bike.classList.add('shown');
      } else if (fx?.bike === 'approach') {
        // halfway to the knight, square by square
        const to = { x: Math.round((bikePos.x + pos.x) / 2), y: Math.round((bikePos.y + pos.y) / 2) };
        if (!(to.x === pos.x && to.y === pos.y)) moveBike(to, 1800);
      } else if (fx?.bike === 'board') {
        moveBike(pos, 900);
        riding = true;
        knight.classList.add('riding');
      } else if (fx?.bike === 'leave') {
        riding = false;
        knight.classList.remove('riding');
        // rolls away slowly on a gentle curve to where it is left
        moveAlong(bike, bend(bikePos, { x: (bikePos.x + fx.at.x) / 2 + 1, y: (bikePos.y + fx.at.y) / 2 + 1.5 }, fx.at, 24), 7000, 'ease-in-out');
        bikePos = fx.at;
      }
      if (fx?.rain !== undefined) setRain(fx.rain, fx.rain ? 14 : 8);
      if (fx?.firework === 'one') burst(70, 25, 55);
      else if (fx?.firework === 'many') {
        randomBurst(true);
        show = setInterval(() => randomBurst(true), 450);
        drawTrail();
      }
      return pos;
    },
  };
}
