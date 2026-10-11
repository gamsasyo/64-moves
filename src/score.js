import { snapToScale } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const H = 92;
const HALF = 4;                 // half a staff space (one diatonic step)
const BOTTOM_LINE = 72;         // E4 sits on the bottom line (treble clef)
const MOVE_Y = 13;              // chess-notation band above the staff
const MIN_MEASURE = 44;         // wide enough for a move label like "♞f5"
const NOTE_GAP = 20;
const BAR_GAP = 10;
const MIDDLE_LINE = BOTTOM_LINE - HALF * 4;
const STEM = 22;
const STEP_OF_PC = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

// How long the key was held (ms) → note value.
function durationOf(ms) {
  if (ms < 130) return 'sixteenth';   // a normal quick tap
  if (ms < 250) return 'eighth';
  if (ms < 450) return 'quarter';
  if (ms < 850) return 'half';
  return 'whole';
}

// Diatonic steps above C4 → y on the staff.
function yOf(midi) {
  const step = STEP_OF_PC[midi % 12] + 7 * (Math.floor(midi / 12) - 5);
  return BOTTOM_LINE - (step - 2) * HALF;
}

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// Algebraic square name: files a–h left → right, ranks 8 → 1 top → bottom.
const squareOf = (x, y) => 'abcdefgh'[x] + (8 - y);

// Live score strip: notes appear as they're played, a barline closes each phrase,
// and the chess move that phrase made is written above its measure.
export function createScore(container) {
  const W = container.clientWidth;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
  const staff = el('g', { class: 'staff' });
  for (let i = 0; i < 5; i++) {
    const y = BOTTOM_LINE - i * HALF * 2;
    staff.appendChild(el('line', { x1: 0, x2: W, y1: y, y2: y }));
  }
  const roll = el('g', { class: 'roll' });
  svg.append(staff, roll);
  container.appendChild(svg);

  let x = 16;
  let measureStart = 8;
  const scroll = () => {
    const shift = Math.max(0, x - W * 0.8);
    roll.style.transform = `translateX(${-shift}px)`;
    // Drop what has scrolled off the left edge.
    for (const node of [...roll.children]) {
      if (Number(node.dataset.x) < shift - 20) node.remove();
      else break;
    }
  };

  return {
    // Draws a head right away; returns finish(heldMs) to turn it into the right note value.
    note({ midi, isBlack }) {
      const y = yOf(snapToScale(midi));
      const g = el('g', { class: `note held ${isBlack ? 'black' : 'white'}` });
      g.dataset.x = x;
      if (y > BOTTOM_LINE) {   // C4 needs a ledger line below the staff
        g.appendChild(el('line', { class: 'ledger', x1: x - 7, x2: x + 7, y1: y, y2: y }));
      }
      g.appendChild(el('ellipse', {
        class: 'head', cx: x, cy: y, rx: 4.6, ry: 3.4, transform: `rotate(-20 ${x} ${y})`,
      }));
      roll.appendChild(g);
      const headX = x;
      x += NOTE_GAP;
      scroll();

      return function finish(heldMs) {
        const value = durationOf(heldMs);
        g.classList.remove('held');
        if (value === 'half' || value === 'whole') g.classList.add('hollow');
        if (value === 'whole') return;
        // Stem up on the right below the middle line, down on the left above it.
        const up = y >= MIDDLE_LINE;
        const sx = up ? headX + 4.2 : headX - 4.2;
        const tip = up ? y - STEM : y + STEM;
        g.appendChild(el('line', { class: 'stem', x1: sx, x2: sx, y1: y, y2: tip }));
        const flags = { eighth: 1, sixteenth: 2 }[value] ?? 0;
        for (let i = 0; i < flags; i++) {
          const fy = up ? tip + i * 5 : tip - i * 5;
          const d = up ? `M${sx} ${fy} q7 6 6 14` : `M${sx} ${fy} q7 -6 6 -14`;
          g.appendChild(el('path', { class: 'flag', d }));
        }
      };
    },
    // move = the piece that moved (with its new x, y), or moved: false if it was boxed in.
    bar({ glyph, color, x: px, y: py, moved }) {
      const barX = Math.max(x + BAR_GAP - NOTE_GAP / 2, measureStart + MIN_MEASURE);
      const line = el('line', {
        class: 'bar', x1: barX, x2: barX, y1: BOTTOM_LINE - HALF * 8, y2: BOTTOM_LINE,
      });
      line.dataset.x = barX;
      const label = el('text', {
        class: `move ${color}`, x: (measureStart + barX) / 2, y: MOVE_Y, 'text-anchor': 'middle',
      });
      label.textContent = glyph + '\uFE0E' + (moved ? squareOf(px, py) : '–');
      label.dataset.x = measureStart;
      roll.append(line, label);
      measureStart = barX;
      x = barX + BAR_GAP;
      scroll();
    },
  };
}
