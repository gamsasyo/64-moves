// The choreography, one entry per numbered phrase of the composer's piece
// (REF/game_mid+wav: 64_moves_agh_03_piano_melody.mid / _piano_full.mid).
// `notes` = the phrase's notes to play: `midi`/`length` = how each is written on the staff (any octave
// of that key counts), `time` = when it sounds in the backing track (seconds), from its MIDI tick.
// `move` = what the knight does; `fx` = what happens on stage.
//   grid  : walk through these squares on the board (ㄱ moves are split over two phrases)
//   curve : bend through `via` on the way to `to`
//   glide : slide straight to a point
//   L     : one random ㄱ move of any size, e.g. 4 then 2 (steered toward `goal` near the end)
//   ride  : off the grid on the bike, a random winding path to somewhere low ('down') or high ('up')
//   spiral: one leg of the spiral from the sketch (0–5), then 'out' — drawn afresh each play
// `dur` = seconds until the next phrase, so the slow off-grid moves can flow right into it.

export const BIKE_HOME = { x: 0, y: 7 };              // where the bike is left after 35

export const START = { x: 3, y: 7 };

// Backing track: 64_moves_agh_03_game.wav. The MIDI runs at 88.88 BPM in it, tick 0 lands 0.63 s in.
// Ticks match Logic's bar numbers: bar = tick / 288 + 1.
export const TRACK = 'audio/game.mp3';
const BPM = 88.88;
const OFFSET = 0.63;
// Each phrase's notes, as circled on the score: [MIDI tick, pitch, written length in ticks (48 = ♪)].
// Most come from the melody MIDI. Where the circle is on a note the melody MIDI doesn't have
// (38's F5, 39–44 in the left hand), it comes from the full piano MIDI.
const NOTES = [
  /*  1 */ [[1157, 68, 192]],
  /*  2 */ [[1443, 72, 288]],
  /*  3 */ [[1825, 68, 48], [1874, 67, 48], [1920, 68, 48], [1967, 70, 48]],
  /*  4 */ [[2016, 72, 288]],
  /*  5 */ [[2400, 68, 48], [2449, 67, 48], [2497, 68, 48], [2542, 70, 48]],
  /*  6 */ [[2589, 72, 48], [2638, 70, 288]],
  /*  7 */ [[2976, 68, 48], [3026, 67, 48], [3073, 68, 48], [3119, 70, 48]],
  /*  8 */ [[3167, 68, 288]],
  /*  9 */ [[3458, 72, 288]],
  /* 10 */ [[3840, 68, 48], [3890, 67, 48], [3935, 68, 48], [3983, 70, 48]],
  /* 11 */ [[4031, 72, 288]],
  /* 12 */ [[4417, 68, 48], [4466, 67, 48], [4512, 68, 48], [4558, 70, 48], [4604, 72, 48]],
  /* 13 */ [[4652, 70, 288]],
  /* 14 */ [[4992, 68, 48], [5042, 67, 48], [5089, 68, 48], [5135, 70, 48]],
  /* 15 */ [[5231, 75, 48], [5277, 75, 48], [5379, 73, 48]],
  /* 16 */ [[5519, 77, 48], [5567, 77, 48], [5664, 75, 48]],
  /* 17 */ [[5807, 63, 48], [5857, 63, 48], [5953, 61, 48]],
  /* 18 */ [[6097, 65, 48], [6147, 65, 48], [6245, 63, 48]],
  /* 19 */ [[6336, 68, 288]],
  /* 20 */ [[6623, 72, 288]],
  /* 21 */ [[7007, 68, 48], [7056, 67, 48], [7103, 68, 48], [7151, 70, 48]],
  /* 22 */ [[7199, 72, 288]],
  /* 23 */ [[7582, 68, 48], [7631, 67, 48], [7679, 68, 48], [7727, 70, 48]],
  /* 24 */ [[7775, 72, 96]],
  /* 25 */ [[7919, 70, 144]],
  /* 26 */ [[8159, 68, 48], [8207, 67, 48], [8254, 68, 48], [8302, 70, 48]],
  /* 27 */ [[8352, 68, 192]],
  /* 28 */ [[8639, 72, 288]],
  /* 29 */ [[9024, 68, 48], [9072, 67, 48], [9119, 68, 48], [9167, 70, 48]],
  /* 30 */ [[9215, 72, 288]],
  /* 31 */ [[9599, 68, 48], [9648, 67, 48], [9695, 68, 48], [9743, 70, 48]],
  /* 32 */ [[9789, 72, 144]],
  /* 33 */ [[9935, 70, 192]],
  /* 34 */ [[10175, 68, 48], [10223, 67, 48], [10271, 68, 48], [10318, 70, 48]],
  /* 35 */ [[10561, 70, 48], [10610, 72, 48], [10649, 75, 96]],
  /* 36 */ [[10944, 67, 144]],
  /* 37 */ [[11136, 68, 48], [11181, 70, 48], [11232, 73, 144]],
  /* 38 */ [[11520, 77, 144]],
  /* 39 */ [[11854, 61, 48], [11899, 61, 48]],
  /* 40 */ [[11999, 61, 48], [12046, 61, 48], [12142, 56, 48], [12189, 56, 48]],
  /* 41 */ [[12334, 56, 48], [12431, 56, 48], [12478, 56, 48]],
  /* 42 */ [[12574, 56, 48], [12624, 56, 48], [12718, 58, 48], [12767, 58, 48]],
  /* 43 */ [[12862, 58, 48], [12909, 58, 48]],
  /* 44 */ [[12974, 60, 288]],
];
// Up to bar 20 the track runs 0.35 s ahead of that grid; it eases back onto it over bars 20½–22.
const EASE = [5616, 6048];
const drift = (tick) => -0.35 * Math.min(1, Math.max(0, (EASE[1] - tick) / (EASE[1] - EASE[0])));
const timeOf = (tick) => OFFSET + (tick * 60) / (BPM * 96) + drift(tick);

export const SCRIPT = [
  /*  1 */ [{ grid: [{ x: 3, y: 5 }] }],
  /*  2 */ [{ grid: [{ x: 4, y: 5 }] }],
  /*  3 */ [{ grid: [{ x: 6, y: 5 }] }],
  /*  4 */ [{ grid: [{ x: 6, y: 4 }] }],
  /*  5 */ [{ grid: [{ x: 6, y: 1 }] }],
  /*  6 */ [{ curve: { via: { x: 4, y: -0.2 }, to: { x: 2, y: 2 } } }],
  /*  7 */ [{ grid: [{ x: 2, y: 4 }] }],
  /*  8 */ [{ grid: [{ x: 1, y: 4 }] }],
  /*  9 */ [{ grid: [{ x: 1, y: 1 }] }],
  /* 10 */ [{ grid: [{ x: 3, y: 1 }] }],
  /* 11 */ [{ grid: [{ x: 3, y: 0 }] }],
  /* 12 */ [{ grid: [{ x: 5, y: 0 }] }],
  /* 13 */ [{ grid: [{ x: 5, y: 1 }] }],
  /* 14 */ [{ glide: { x: 3, y: 3 } }],
  /* 15 */ [{ L: true }, { bike: 'enter' }],
  /* 16 */ [{ L: true }, { bike: 'approach' }],
  /* 17 */ [{ L: true }, { bike: 'approach' }],
  /* 18 */ [{ L: true }, { bike: 'board' }],
  ...[...'dudududud'].map((d) => [{ ride: d === 'd' ? 'down' : 'up' }]),   // 19–27
  ...[0, 1, 2, 3, 4, 5, 'out'].map((leg) => [{ spiral: leg }, leg === 0 ? { rain: 1 } : null]),   // 28–34
  /* 35 */ [{ glide: { x: 6, y: 1 } }, { bike: 'leave', at: BIKE_HOME }],
  /* 36 */ [{ L: true }, { firework: 'one' }],
  /* 37 */ [{ L: true }],
  /* 38 */ [{ L: true }, { rain: 0.4 }],
  /* 39 */ [{ L: true }, { rain: 0 }],
  /* 40 */ [{ L: true }],
  /* 41 */ [{ L: true }],
  /* 42 */ [{ L: true }],
  /* 43 */ [{ L: true }],
  /* 44 */ [{ stop: true }, { firework: 'many' }],
].map(([move, fx], i) => {
  const notes = NOTES[i].map(([tick, midi, length]) => ({ midi, length, time: timeOf(tick) }));
  const dur = NOTES[i + 1] ? timeOf(NOTES[i + 1][0][0]) - notes[0].time : 4;
  return { n: i + 1, notes, move, fx: fx ?? null, dur };
});

// 36–43 wander at random but must end beside the bike.
export const GOAL = [{ x: 1, y: 7 }, { x: 0, y: 6 }, { x: 1, y: 6 }];
export const LAST_L = 43;
