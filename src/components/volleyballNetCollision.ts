export const VOLLEYBALL_NET_TOP = 2.225;
const NET_HALF_WIDTH = 3.825;
const NET_HALF_DEPTH = .04;
export type NetSurface = { displacement: (x: number, y: number) => number; velocity: (x: number, y: number) => number; impact: (x: number, y: number, velocity: number) => void };

export function volleyballCourtZ(z: number, side: 1 | -1) {
  return side * Math.max(.85, Math.min(6.6, z * side));
}

export type VolleyballBallMotion = { bx: number; by: number; bz: number; bvx: number; bvy: number; bvz: number };

/** Sweep the net face with the ball radius so fast shots cannot tunnel through it. */
export function stepVolleyballBall(ball: VolleyballBallMotion, gravity: number, dt: number, radius = .42, net?: NetSurface) {
  const x = ball.bx, y = ball.by, z = ball.bz, vy = ball.bvy, vz = ball.bvz;
  ball.bx += ball.bvx * dt;
  ball.by += vy * dt + .5 * gravity * dt * dt;
  ball.bz += vz * dt;
  ball.bvy += gravity * dt;
  if (!vz || dt <= 0) return false;
  const side = z > 0 ? 1 : z < 0 ? -1 : vz < 0 ? 1 : -1;
  if (vz * side >= 0) return false;
  const face = (net?.displacement(x, y) ?? 0) + side * (NET_HALF_DEPTH + radius);
  const hitTime = Math.max(0, (face - z) / vz);
  if (hitTime > dt || (ball.bz - face) * side > 0) return false;
  const hitX = x + ball.bvx * hitTime;
  const hitY = y + vy * hitTime + .5 * gravity * hitTime * hitTime;
  if (Math.abs(hitX) > NET_HALF_WIDTH + radius || hitY > VOLLEYBALL_NET_TOP + radius || hitY < 1 - radius) return false;
  const remaining = dt - hitTime;
  ball.bvx *= .75;
  const surfaceVelocity = net?.velocity(hitX, hitY) ?? 0;
  ball.bvz = side * Math.max(.3, (-vz * side) * .35 + surfaceVelocity * side * .3);
  net?.impact(hitX, hitY, vz);
  const hitVy = (vy + gravity * hitTime) * .65;
  ball.bx = hitX + ball.bvx * remaining;
  ball.bz = face + side * .002 + ball.bvz * remaining;
  ball.by = hitY + hitVy * remaining + .5 * gravity * remaining * remaining;
  ball.bvy = hitVy + gravity * remaining;
  return true;
}
