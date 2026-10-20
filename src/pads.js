// Rhythm-game input: four big pads instead of the keyboard (low notes left, high notes right).
// onDown(lane) when a pad is pressed, onUp(lane) when it's let go.
// Returns setTarget(lane) to light the answer pad (null clears), hit(lane) / wrong(lane) to flash.
export const LANES = 4;

export function createPads(el, { onDown, onUp }) {
  const pads = [];
  for (let i = 0; i < LANES; i++) {
    const pad = document.createElement('div');
    pad.className = `pad lane-${i}`;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.classList.add('down');
      onDown(i);
    });
    const release = () => {
      if (!pad.classList.contains('down')) return;   // up + leave can both fire
      pad.classList.remove('down');
      onUp(i);
    };
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) pad.addEventListener(ev, release);
    el.appendChild(pad);
    pads.push(pad);
  }

  const flash = (pad, cls) => {
    pad.classList.remove(cls);
    void pad.offsetWidth;   // restart animation
    pad.classList.add(cls);
    pad.addEventListener('animationend', () => pad.classList.remove(cls), { once: true });
  };

  return {
    setTarget(lane) {
      pads.forEach((p, i) => p.classList.toggle('target', i === lane));
    },
    hit: (lane) => flash(pads[lane], 'hit'),
    wrong: (lane) => flash(pads[lane], 'wrong'),
  };
}
