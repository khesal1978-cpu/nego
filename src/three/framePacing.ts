/** Cap touch gameplay at 60 Hz without slowing simulation or losing input.
 * Retaining the fractional deadline avoids uneven 60 Hz pacing on 90/120 Hz. */
export function createFramePacer() {
  let next = 0, lastRate = 0;
  return (now: number, fps: number) => {
    if (fps <= 0) { next = now; lastRate = fps; return true; }
    const interval = 1000 / fps;
    if (lastRate !== fps || now - next > interval * 2) next = now;
    lastRate = fps;
    if (now + .5 < next) return false;
    next += interval;
    return true;
  };
}
