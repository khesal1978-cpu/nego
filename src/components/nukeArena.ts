/** The same radius drives the round floor, walls, movement and ball bounces. */
export const NUKE_FLOOR_RADIUS = 17.6;
export const NUKE_PLAY_RADIUS = 17.5;

export function clampToNukeArena<T extends { x: number; z: number }>(point: T, margin = 0): boolean {
  const radius = Math.max(0, NUKE_PLAY_RADIUS - margin);
  const distance = Math.hypot(point.x, point.z);
  if (distance <= radius) return false;
  point.x *= radius / distance;
  point.z *= radius / distance;
  return true;
}

export function bounceAtNukeBoundary(ball: { x: number; z: number; vx: number; vz: number }, margin = .6, restitution = .78): boolean {
  if (!clampToNukeArena(ball, margin)) return false;
  const distance = Math.hypot(ball.x, ball.z);
  if (distance === 0) return false;
  const nx = ball.x / distance, nz = ball.z / distance;
  const outwardSpeed = ball.vx * nx + ball.vz * nz;
  // Only reverse outward motion. Tangential motion slides along the round wall.
  if (outwardSpeed > 0) {
    ball.vx -= (1 + restitution) * outwardSpeed * nx;
    ball.vz -= (1 + restitution) * outwardSpeed * nz;
  }
  return true;
}

export function nukeSpawnPosition(index: number, count: number) {
  const theta = Math.PI / 2 + (index % count) * Math.PI * 2 / count;
  const x = Math.cos(theta) * 9.2, z = Math.sin(theta) * 9.2;
  return { x, z, yaw: Math.atan2(-x, -z) };
}
