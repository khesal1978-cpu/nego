type GroundVector = { x: number; z: number };

/** Convert screen drag using the live camera basis, including rotated court views. */
export function volleyballSwipeDirection(dx: number, dy: number, right: GroundVector, up: GroundVector) {
  if (!Number.isFinite(dx + dy) || Math.hypot(dx, dy) < 22) return null;
  const r = Math.hypot(right.x, right.z) || 1, u = Math.hypot(up.x, up.z) || 1;
  const x = dx * right.x / r - dy * up.x / u;
  const z = dx * right.z / r - dy * up.z / u;
  const length = Math.hypot(x, z);
  return length > .001 ? { x: x / length, z: z / length } : null;
}

/** Clip along the ray, instead of independently clamping axes and bending the shot. */
export function volleyballSwipeTarget(x: number, z: number, direction: GroundVector) {
  let distance = 9;
  if (Math.abs(direction.x) > .001) distance = Math.min(distance, ((direction.x > 0 ? 3.25 : -3.25) - x) / direction.x);
  if (Math.abs(direction.z) > .001) distance = Math.min(distance, ((direction.z > 0 ? 5.95 : -5.95) - z) / direction.z);
  distance = Math.max(.05, distance);
  return { x: x + direction.x * distance, z: z + direction.z * distance };
}
