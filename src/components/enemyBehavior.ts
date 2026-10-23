type Projectile = { x: number; z: number; vx: number; vz: number };
type Box = { x: number; y: number; z: number; w: number; h: number; d: number; walkable: boolean };
type Cylinder = { x: number; y: number; z: number; radius: number; height: number };

/** Only react to a projectile whose future path actually intersects the athlete. */
export function approachingThreat(x: number, z: number, p: Projectile, radius = 1, horizon = .45) {
  const speedSq = p.vx * p.vx + p.vz * p.vz;
  if (speedSq < 1) return null;
  const dx = x - p.x, dz = z - p.z;
  const time = (dx * p.vx + dz * p.vz) / speedSq;
  if (time < .04 || time > horizon) return null;
  const missX = dx - p.vx * time, missZ = dz - p.vz * time;
  if (missX * missX + missZ * missZ > radius * radius) return null;
  const speed = Math.sqrt(speedSq);
  return { time, x: -p.vz / speed, z: p.vx / speed };
}

export const reactionChance = (rate: number, dt: number) => 1 - Math.exp(-rate * Math.max(0, dt));

const turns = [0, .5, -.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI];
/** Probe the athlete's footprint and prefer a clear tangent around nearby scenery. */
export function steerAroundCover(x: number, z: number, y: number, moveX: number, moveZ: number, boxes: readonly Box[], cylinders: readonly Cylinder[], side: number) {
  const length = Math.hypot(moveX, moveZ);
  if (length < .001) return { x: 0, z: 0 };
  const dx = moveX / length, dz = moveZ / length;
  const clear = (px: number, pz: number) => {
    if (Math.abs(px) > 19 || pz < -10.3 || pz > 14.6) return false;
    for (const b of boxes) {
      const top = b.y + b.h / 2;
      if (y + 1.5 <= b.y - b.h / 2 || y >= top - .08 || (b.walkable && top - y <= .56)) continue;
      const gapX = Math.max(0, Math.abs(px - b.x) - b.w / 2);
      const gapZ = Math.max(0, Math.abs(pz - b.z) - b.d / 2);
      if (gapX * gapX + gapZ * gapZ < .8 * .8) return false;
    }
    for (const c of cylinders) {
      if (y + 1.5 <= c.y || y >= c.y + c.height - .08) continue;
      if (Math.hypot(px - c.x, pz - c.z) < c.radius + .8) return false;
    }
    return true;
  };
  let best = -Infinity, bestX = 0, bestZ = 0;
  for (const turn of turns) {
    const co = Math.cos(turn), si = Math.sin(turn);
    const nx = dx * co - dz * si, nz = dx * si + dz * co;
    if (!clear(x + nx * .65, z + nz * .65) || !clear(x + nx * 1.3, z + nz * 1.3)) continue;
    const farClear = clear(x + nx * 2.2, z + nz * 2.2);
    const score = Math.cos(turn) + (farClear ? .65 : 0) + Math.sin(turn) * side * .1;
    if (score > best) { best = score; bestX = nx; bestZ = nz; }
    if (turn === 0 && farClear) break;
  }
  return { x: bestX * Math.min(1, length), z: bestZ * Math.min(1, length) };
}
