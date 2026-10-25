import { VOLLEYBALL_NET_TOP } from './volleyballNetCollision';

/** Retain the chosen landing zone, but give an AI return enough flight time to
 * clear the tape with the entire ball, including its approach to the mesh. */
export function volleyballAiFlight(y: number, z: number, targetZ: number, requested: number, gravity: number, radius: number) {
  const time = Math.max(.54, requested);
  if (z * targetZ >= 0 || Math.abs(z) < radius + .06) return time;
  const distance = targetZ - z;
  let squared = time * time;
  for (const plane of [-radius - .06, 0, radius + .06]) {
    const fraction = (plane - z) / distance;
    if (fraction <= 0 || fraction >= 1) continue;
    const straightHeight = y * (1 - fraction) + radius * fraction;
    const required = VOLLEYBALL_NET_TOP + radius + .16;
    squared = Math.max(squared, 2 * (required - straightHeight) / (Math.abs(gravity) * fraction * (1 - fraction)));
  }
  return Math.sqrt(squared);
}
