// Stream the supplied recording instead of decoding the whole song into RAM.
export function createMenuMusic(ctx: AudioContext) {
  const track = new Audio('/music/ship-wrek-pain.mp3');
  track.preload = 'none';
  track.loop = true;
  const source = ctx.createMediaElementSource(track);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  source.connect(gain);
  gain.connect(ctx.destination);
  let wanted = false, disposed = false, starting = false;

  return {
    set(active: boolean, level: number) {
      const volume = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
      wanted = active && volume > 0 && !disposed;
      // Default 30% slider gives 7.5% gain; the song stays behind menu effects.
      gain.gain.setTargetAtTime(wanted ? Math.min(.2, volume * .25) : 0, ctx.currentTime, .2);
      if (!wanted) { track.pause(); return; }
      if (!track.paused || starting) return;
      starting = true;
      track.play().then(() => {
        starting = false;
        if (!wanted) track.pause();
      }).catch(() => { starting = false; });
    },
    dispose() {
      disposed = true; wanted = false;
      track.pause(); track.removeAttribute('src'); track.load();
      source.disconnect(); gain.disconnect();
    },
  };
}
