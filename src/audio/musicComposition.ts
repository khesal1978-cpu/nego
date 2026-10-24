// Original SIXGUN composition and synthesis. No recordings, samples or borrowed melodies.
export const MUSIC_SAMPLE_RATE = 22050;
export const MUSIC_BEAT = 60 / 88;
export const MUSIC_BARS = 8;
const chords = [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 61]];
const melody = [[74, 69, 78, 73], [74, 78, 73, 69], [71, 74, 78, 69], [73, 76, 69, 71]];
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Add one bar at a time so building the cached loop can yield between bars on phones. */
export function writeMusicBar(left: Float32Array, right: Float32Array, bar: number, sampleRate = MUSIC_SAMPLE_RATE) {
  const mix = (start: number, duration: number, frequency: number, volume: number, pan: number, pad = false) => {
    const offset = Math.round(start * sampleRate), count = Math.floor(duration * sampleRate);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      const envelope = pad ? Math.sin(Math.PI * t / duration) ** 2 : (1 - Math.exp(-t * 180)) * Math.exp(-t * 5.5) * Math.min(1, (duration - t) * 15);
      const tone = Math.sin(2 * Math.PI * frequency * t) + .18 * Math.sin(2 * Math.PI * frequency * 2 * t) * Math.exp(-t * 7);
      const value = tone * envelope * volume, index = (offset + i) % left.length;
      left[index] += value * (1 - pan * .3); right[index] += value * (1 + pan * .3);
      if (!pad) { const echo = (index + Math.round(MUSIC_BEAT * .75 * sampleRate)) % left.length; left[echo] += value * .13; right[echo] += value * .19; }
    }
  };
  const start = bar * MUSIC_BEAT * 4, chord = chords[bar % 4];
  chord.forEach((note, i) => mix(start, MUSIC_BEAT * 4, hz(note + 12), .019, (i - 1.5) / 1.5, true));
  for (const beat of [0, 2]) mix(start + MUSIC_BEAT * beat, MUSIC_BEAT * 1.2, hz(chord[0] - 12), .06, 0);
  [0.5, 1.75, 2.5, 3.25].forEach((beat, i) => {
    const note = melody[bar % 4][(i + (bar >= 4 ? 1 : 0)) % 4];
    mix(start + MUSIC_BEAT * beat, .85, hz(note), .052, i % 2 ? .65 : -.65);
  });
  // Gentle brushed pulse, with deterministic noise and a soft transient.
  for (const beat of [1, 3]) for (let i = 0; i < sampleRate * .07; i++) {
    const t = i / sampleRate, noise = Math.sin(i * 12.9898 + bar * 78.233) * 43758.5453;
    const value = ((noise - Math.floor(noise)) * 2 - 1) * .009 * Math.sin(Math.PI * t / .07) ** 2;
    const index = (Math.round((start + MUSIC_BEAT * beat) * sampleRate) + i) % left.length;
    left[index] += value; right[index] += value;
  }
}

