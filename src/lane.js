const NS = 'http://www.w3.org/2000/svg';
const H = 92;
const HALF = 4;                 // half a staff space (one diatonic step)
const BOTTOM_LINE = 72;         // E4 sits on the bottom line (treble clef)
const MOVE_Y = 13;              // chess-notation band above the staff
const HIT_X = 62;               // the line notes have to be played on (clear of the key signature)
const SPEED = 110;              // px per second

// F minor: four flats (B♭ E♭ A♭ D♭), so black keys are spelled as flats on the letter above.
// Diatonic step (C = 0) for each pitch class, and the accidental it needs against that key.
const STEP_OF_PC = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const ACCIDENTAL = { 2: '♮', 4: '♮', 6: '♭', 9: '♮', 11: '♮' };
const KEY_FLATS = [6, 9, 5, 8];   // B♭4 E♭5 A♭4 D♭5, as steps above C4

const stepOf = (midi) => STEP_OF_PC[midi % 12] + 7 * (Math.floor(midi / 12) - 5);
const yOfStep = (step) => BOTTOM_LINE - (step - 2) * HALF;   // E4 (step 2) on the bottom line

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// Algebraic square name: files a–h left → right, ranks 8 → 1 top → bottom.
const squareOf = (x, y) => 'abcdefgh'[x] + (8 - y);

// Rhythm lane on a staff: each note slides in from the right and reaches the hit line at its
// time. A hit lights it (and writes the knight's move above, if it set one off); a miss greys it.
export function createLane(container, chart) {
  const W = container.clientWidth;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  const staffLines = (g, x2) => {
    for (let i = 0; i < 5; i++) {
      const y = BOTTOM_LINE - i * HALF * 2;
      g.appendChild(el('line', { x1: 0, x2, y1: y, y2: y }));
    }
  };
  const staff = el('g', { class: 'staff' });
  staffLines(staff, W);
  staff.appendChild(el('rect', { class: 'hitzone', x: HIT_X - 7, y: BOTTOM_LINE - HALF * 10, width: 14, height: HALF * 12 }));
  staff.appendChild(el('line', { class: 'hitline', x1: HIT_X, x2: HIT_X, y1: BOTTOM_LINE - HALF * 10, y2: BOTTOM_LINE + HALF * 2 }));
  const roll = el('g', { class: 'roll' });
  // Key signature sits on top, on its own patch of staff, so played notes slide under it.
  const key = el('g', { class: 'staff key' });
  key.appendChild(el('rect', { x: 0, y: 0, width: 40, height: H }));
  staffLines(key, 40);
  KEY_FLATS.forEach((step, i) => {
    const f = el('text', { class: 'flat', x: 8 + i * 7, y: yOfStep(step) + 3 });
    f.textContent = '♭';
    key.appendChild(f);
  });
  // Life gauge along the top edge.
  const gauge = el('g', { class: 'gauge' });
  const fill = el('rect', { class: 'fill', x: 0, y: 0, width: W, height: 3 });
  gauge.append(el('rect', { x: 0, y: 0, width: W, height: 3 }), fill);
  svg.append(staff, roll, key, gauge);
  container.replaceChildren(svg);

  const notes = chart.map(({ midi, length, time }) => {
    const x = HIT_X + time * SPEED;
    const step = stepOf(midi);
    const y = yOfStep(step);
    const g = el('g', { class: 'note' });
    // Ledger lines below the staff (C4 and down) and above it (A5 and up).
    for (let s = 0; s >= step; s -= 2) g.appendChild(el('line', { class: 'ledger', x1: x - 7, x2: x + 7, y1: yOfStep(s), y2: yOfStep(s) }));
    for (let s = 12; s <= step; s += 2) g.appendChild(el('line', { class: 'ledger', x1: x - 7, x2: x + 7, y1: yOfStep(s), y2: yOfStep(s) }));
    const acc = ACCIDENTAL[midi % 12];
    if (acc) {
      const a = el('text', { class: 'accidental', x: x - 10, y: y + 3.5, 'text-anchor': 'middle' });
      a.textContent = acc;
      g.appendChild(a);
    }
    const hollow = length >= 192;
    g.appendChild(el('ellipse', {
      class: hollow ? 'head hollow' : 'head', cx: x, cy: y, rx: 4.6, ry: 3.4, transform: `rotate(-20 ${x} ${y})`,
    }));
    if (length === 72 || length === 144 || length === 288) {
      g.appendChild(el('circle', { class: 'dot', cx: x + 8, cy: step % 2 ? y : y - HALF, r: 1.2 }));
    }
    // Stem up on the right below the middle line, down on the left above it; ♪ gets a flag.
    const up = step < 6;
    const sx = up ? x + 4.2 : x - 4.2;
    const tip = up ? y - 22 : y + 22;
    g.appendChild(el('line', { class: 'stem', x1: sx, x2: sx, y1: y, y2: tip }));
    if (length < 96) {
      g.appendChild(el('path', { class: 'flag', d: up ? `M${sx} ${tip} q7 6 6 14` : `M${sx} ${tip} q7 -6 6 -14` }));
    }
    roll.appendChild(g);
    return { g, x };
  });

  return {
    // Slide everything so that song time t sits on the hit line.
    scroll(t) {
      roll.style.transform = `translateX(${-t * SPEED}px)`;
    },
    // v = 0 … 1
    gauge(v) {
      fill.setAttribute('width', W * v);
      gauge.classList.toggle('low', v < 0.25);
    },
    // pos = where the knight landed (with x, y) if this note made it dance.
    mark(i, hit, pos) {
      const { g, x } = notes[i];
      g.classList.add(hit ? 'hit' : 'miss');
      if (!pos) return;
      const onSquare = Number.isInteger(pos.x) && Number.isInteger(pos.y);
      const label = el('text', { class: 'move', x, y: MOVE_Y, 'text-anchor': 'middle' });
      label.textContent = '♞︎' + (onSquare ? squareOf(pos.x, pos.y) : '~');
      roll.appendChild(label);
    },
  };
}
