import { MUSIC_BARS, MUSIC_BEAT, MUSIC_SAMPLE_RATE, writeMusicBar } from './musicComposition';
export { MUSIC_BARS, MUSIC_BEAT, MUSIC_SAMPLE_RATE, writeMusicBar } from './musicComposition';

export function createOriginalMusic(ctx: AudioContext) {
  let buffer: AudioBuffer | null = null, building = false, disposed = false;
  let worker: Worker | null = null;
  let source: AudioBufferSourceNode | null = null, gain: GainNode | null = null;
  let wanted = false, volume = .3;
  const stop = () => {
    if (source) { source.stop(); source.disconnect(); source = null; }
    gain?.disconnect(); gain = null;
  };
  const sync = () => {
    if (disposed || !wanted || volume <= 0) { stop(); return; }
    if (!buffer) {
      if (building) return;
      building = true;
      const next = ctx.createBuffer(2, Math.ceil(MUSIC_BEAT * 4 * MUSIC_BARS * MUSIC_SAMPLE_RATE), MUSIC_SAMPLE_RATE);
      const complete = () => { buffer = next; building = false; sync(); };
      let bar = 0;
      const build = () => {
        if (disposed) return;
        writeMusicBar(next.getChannelData(0), next.getChannelData(1), bar++);
        if (bar < MUSIC_BARS) setTimeout(build, 0);
        else complete();
      };
      // Synthesis is expensive even when spread across bars on a slow CPU.
      // Transfer the finished PCM once; gameplay never runs the synth loop.
      if (typeof Worker !== 'undefined') {
        try {
          worker = new Worker(new URL('./musicWorker.ts', import.meta.url), { type: 'module' });
          worker.onmessage = ({ data }: MessageEvent<{ left: Float32Array; right: Float32Array }>) => {
            worker?.terminate(); worker = null;
            if (disposed) return;
            next.getChannelData(0).set(data.left); next.getChannelData(1).set(data.right);
            complete();
          };
          worker.onerror = () => { worker?.terminate(); worker = null; if (!disposed) setTimeout(build, 0); };
          worker.postMessage('build');
          return;
        } catch { worker?.terminate(); worker = null; }
      }
      setTimeout(build, 0);
      return;
    }
    if (!source) {
      source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      gain = ctx.createGain(); gain.gain.setValueAtTime(0, ctx.currentTime);
      source.connect(gain); gain.connect(ctx.destination); source.start();
    }
    // Even 100% remains background music, below gameplay effects and voice.
    gain!.gain.setTargetAtTime(volume * .42, ctx.currentTime, .35);
  };
  return {
    set(active: boolean, level: number) { wanted = active; volume = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0; sync(); },
    dispose() { disposed = true; worker?.terminate(); worker = null; stop(); buffer = null; },
  };
}
