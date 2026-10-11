// One octave C4..C5: 8 white keys + 5 black keys.
const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
// Black key midi, and the white-key index it sits after.
const BLACK = [
  [61, 0], [63, 1], [66, 3], [68, 4], [70, 5],
];

// onDown({ midi, isBlack }) when a key is pressed, onUp(note, heldMs) when it's let go.
export function createKeyboard(el, { onDown, onUp }) {
  const press = (keyEl, note) => (e) => {
    e.preventDefault();
    keyEl.classList.add('down');
    keyEl.downAt = performance.now();
    onDown(note);
  };
  const release = (keyEl, note) => () => {
    if (!keyEl.classList.contains('down')) return;   // up + leave can both fire
    keyEl.classList.remove('down');
    onUp(note, performance.now() - keyEl.downAt);
  };

  const addKey = (keyEl, note) => {
    keyEl.addEventListener('pointerdown', press(keyEl, note));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      keyEl.addEventListener(ev, release(keyEl, note));
    }
    el.appendChild(keyEl);
  };

  WHITE.forEach((midi) => {
    const k = document.createElement('div');
    k.className = 'key white';
    addKey(k, { midi, isBlack: false });
  });

  BLACK.forEach(([midi, after]) => {
    const k = document.createElement('div');
    k.className = 'key black';
    k.style.left = `${((after + 1) / WHITE.length) * 100}%`;
    addKey(k, { midi, isBlack: true });
  });
}
