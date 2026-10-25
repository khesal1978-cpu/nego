export type GunWeapon = 'assault' | 'shotgun' | 'fire';

export const GUN_WEAPONS = {
  assault: { magazine: 30, reloadSec: 1.35, range: 24, label: 'Assault blaster' },
  shotgun: { magazine: 5, reloadSec: 1.7, range: 15, label: 'Pump shotgun' },
  fire: { magazine: 48, reloadSec: 1.85, range: 11, label: 'Fire blaster' },
} satisfies Record<GunWeapon, { magazine: number; reloadSec: number; range: number; label: string }>;

export interface Point3 { x: number; y: number; z: number }

// Return the first point along a segment that enters a collider (0..1).
export function segmentBoxHit(from: Point3, to: Point3, box: Point3 & { w: number; h: number; d: number }, padding = 0): number | null {
  let enter = 0;
  let exit = 1;
  for (const [axis, size] of [['x', 'w'], ['y', 'h'], ['z', 'd']] as const) {
    const half = box[size] / 2 + padding;
    const delta = to[axis] - from[axis];
    const offset = from[axis] - box[axis];
    if (Math.abs(delta) < 1e-8) {
      if (Math.abs(offset) > half) return null;
      continue;
    }
    const a = (-half - offset) / delta;
    const b = (half - offset) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return null;
  }
  return enter;
}

export function segmentCylinderHit(from: Point3, to: Point3, x: number, z: number, radius: number, bottom: number, top: number): number | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const ox = from.x - x;
  const oz = from.z - z;
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  let enter = 0;
  let exit = 1;
  if (a < 1e-8) {
    if (c > 0) return null;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    enter = Math.max(enter, (-b - root) / (2 * a));
    exit = Math.min(exit, (-b + root) / (2 * a));
  }
  const dy = to.y - from.y;
  if (Math.abs(dy) < 1e-8) {
    if (from.y < bottom || from.y > top) return null;
  } else {
    const low = (bottom - from.y) / dy;
    const high = (top - from.y) / dy;
    enter = Math.max(enter, Math.min(low, high));
    exit = Math.min(exit, Math.max(low, high));
  }
  return enter <= exit ? enter : null;
}

export function damageAtDistance(weapon: GunWeapon, distance: number): number {
  if (weapon === 'shotgun') return Math.max(0.35, 1 - Math.max(0, distance - 5) * 0.07);
  if (weapon === 'assault') return Math.max(0.7, 1 - Math.max(0, distance - 14) * 0.025);
  return 1;
}
