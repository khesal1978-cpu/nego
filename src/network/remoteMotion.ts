type Motion = { x: number; y: number; z: number };
export function smoothRemotePosition(visual: Motion, target: Motion, dt: number) {
  const distance = Math.hypot(target.x - visual.x, target.y - visual.y, target.z - visual.z);
  const blend = distance > 3 ? 1 : 1 - Math.exp(-22 * Math.max(0, dt));
  visual.x += (target.x - visual.x) * blend;
  visual.y += (target.y - visual.y) * blend;
  visual.z += (target.z - visual.z) * blend;
}
/** Direct owner input is newer than a relayed host echo of that same human. */
export const useHostMotion = (lastOwnerTick: number | undefined, now: number, reset = false) => reset || lastOwnerTick === undefined || now - lastOwnerTick > 250;
