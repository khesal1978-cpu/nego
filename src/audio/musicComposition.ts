// Original SIXGUN menu theme: warm keys, a slow bass groove and soft percussion.
export const MUSIC_SAMPLE_RATE = 32000;
export const MUSIC_BEAT = 60 / 82;
export const MUSIC_BARS = 8;
const chords = [[45, 52, 55, 59], [41, 48, 52, 55], [48, 55, 59, 62], [43, 50, 55, 59]];
const melody = [[64, 62, 59, 55], [60, 64, 62, 60], [67, 64, 62, 59], [62, 59, 57, 55]];
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Add one bar at a time so building the cached loop can yield between bars on phones. */
export function writeMusicBar(left: Float32Array, right: Float32Array, bar: number, sampleRate = MUSIC_SAMPLE_RATE) {
  const mix = (start: number, duration: number, frequency: number, volume: number, pan: number, pad = false) => {
    const offset = Math.round(start * sampleRate), count = Math.floor(duration * sampleRate);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      const envelope = pad ? Math.sin(Math.PI * t / duration) ** 2 : (1 - Math.exp(-t * 55)) * Math.exp(-t * 4) * Math.min(1, (duration - t) * 18);
      const tone = Math.sin(2 * Math.PI * frequency * t) + .09 * Math.sin(2 * Math.PI * frequency * 2 * t) * Math.exp(-t * 6);
      const value = tone * envelope * volume, index = (offset + i) % left.length;
      left[index] += value * (1 - pan * .3); right[index] += value * (1 + pan * .3);
      if (!pad) { const echo = (index + Math.round(MUSIC_BEAT * .75 * sampleRate)) % left.length; left[echo] += value * .12; right[echo] += value * .16; }
    }
  };
  const start = bar * MUSIC_BEAT * 4, chord = chords[bar % 4];
  chord.forEach((note, i) => mix(start, MUSIC_BEAT * 4, hz(note + 12), .02, (i - 1.5) / 1.5, true));
  for (const beat of [0, 1.5, 3]) mix(start + MUSIC_BEAT * beat, .75, hz(chord[0] - 12), .065, 0);
  [0.5, 1.75, 2.5, 3.5].forEach((beat, i) => {
    mix(start + MUSIC_BEAT * beat, 1.1, hz(melody[bar % 4][i] + (bar >= 4 && i === 0 ? 7 : 0)), .045, i % 2 ? .55 : -.55);
  });
  // Rounded low drum pulse, with no bright noise/hiss or hard transient.
  for (const beat of [0, 2]) mix(start + MUSIC_BEAT * beat, .13, 58, .04, 0);
}

