export function createRenderer(boardEl, pieces) {
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    const x = i % 8;
    const y = Math.floor(i / 8);
    cell.className = (x + y) % 2 ? 'cell dark' : 'cell';
    boardEl.appendChild(cell);
  }

  const makePiece = (p, extra = '') => {
    const el = document.createElement('div');
    el.className = `piece ${p.color} ${extra}`;
    el.textContent = p.glyph + '\uFE0E';   // force text glyph, not emoji, on iOS
    boardEl.appendChild(el);
    return el;
  };
  const place = (el, x, y) => { el.style.transform = `translate(${x * 100}%, ${y * 100}%)`; };

  const els = {};
  const last = {};
  for (const p of pieces) els[p.id] = makePiece(p);

  return {
    draw() {
      for (const p of pieces) {
        const prev = last[p.id];
        if (prev && (prev.x !== p.x || prev.y !== p.y)) {
          // Afterimage fades out where the dancer just was.
          const ghost = makePiece(p, 'ghost');
          place(ghost, prev.x, prev.y);
          ghost.addEventListener('animationend', () => ghost.remove());
        }
        place(els[p.id], p.x, p.y);
        last[p.id] = { x: p.x, y: p.y };
      }
    },
    glow(ids) {
      for (const p of pieces) els[p.id].classList.toggle('glow', ids.includes(p.id));
    },
    shake(ids) {
      for (const id of ids) {
        const el = els[id];
        el.classList.remove('stuck');
        void el.offsetWidth;   // restart animation
        el.classList.add('stuck');
      }
    },
  };
}
