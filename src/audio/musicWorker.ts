import { MUSIC_BARS, MUSIC_BEAT, MUSIC_SAMPLE_RATE, writeMusicBar } from './musicComposition';

self.onmessage = () => {
  const length = Math.ceil(MUSIC_BEAT * 4 * MUSIC_BARS * MUSIC_SAMPLE_RATE);
  const left = new Float32Array(length), right = new Float32Array(length);
  for (let bar = 0; bar < MUSIC_BARS; bar++) writeMusicBar(left, right, bar);
  self.postMessage({ left, right }, { transfer: [left.buffer, right.buffer] });
};
