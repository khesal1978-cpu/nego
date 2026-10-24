// Includes the thin contrast borders of the visible tapes.
export const VOLLEYBALL_NET_TOP = 2.234;
const NET_BOTTOM = .991;
const NET_HALF_WIDTH = 3.825;
const NET_HALF_DEPTH = .04;
export type NetSurface = { displacement: (x: number, y: number) => number; velocity: (x: number, y: number) => number; impact: (x: number, y: number, velocity: number) => void };

export function volleyballBallRadius(big: boolean) { return .44 * (big ? 1.5 : 1); }

export function volleyballCourtZ(z: number, side: 1 | -1) {
  return side * Math.max(.85, Math.min(6.6, z * side));
}

export type VolleyballBallMotion = { bx: number; by: number; bz: number; bvx: number; bvy: number; bvz: number };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Exact linear sphere sweep against the finite net box, including rounded
 * edges. Between box-boundary crossings, distance squared is a quadratic. */
function sweepNet(start: number[], delta: number[], offset: number, radius: number) {
  const low = [-NET_HALF_WIDTH, NET_BOTTOM, offset - NET_HALF_DEPTH];
  const high = [NET_HALF_WIDTH, VOLLEYBALL_NET_TOP, offset + NET_HALF_DEPTH];
  if (start.some((value, axis) => Math.max(value, value + delta[axis]) < low[axis] - radius || Math.min(value, value + delta[axis]) > high[axis] + radius)) return null;
  const cuts = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(delta[axis]) < 1e-12) continue;
    for (const edge of [low[axis], high[axis]]) {
      const time = (edge - start[axis]) / delta[axis];
      if (time > 0 && time < 1) cuts.push(time);
    }
  }
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i], to = cuts[i + 1], middle = (from + to) / 2;
    let a = 0, b = 0, c = -radius * radius;
    for (let axis = 0; axis < 3; axis++) {
      const value = start[axis] + delta[axis] * middle;
      const edge = value < low[axis] ? low[axis] : value > high[axis] ? high[axis] : null;
      if (edge === null) continue;
      const distance = start[axis] - edge;
      a += delta[axis] ** 2; b += 2 * distance * delta[axis]; c += distance ** 2;
    }
    let time = from;
    if ((a * from + b) * from + c > 1e-10) {
      const discriminant = b * b - 4 * a * c;
      if (a < 1e-12 || discriminant < 0) continue;
      time = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (time < from - 1e-9 || time > to + 1e-9) continue;
      time = clamp(time, from, to);
    }
    const position = start.map((value, axis) => value + delta[axis] * time);
    const closest = position.map((value, axis) => clamp(value, low[axis], high[axis]));
    const normal = position.map((value, axis) => value - closest[axis]);
    const distance = Math.hypot(...normal);
    if (distance > 1e-8) {
      for (let axis = 0; axis < 3; axis++) normal[axis] /= distance;
    } else {
      // Resolve centres placed inside the mesh by a snapshot using its nearest
      // face. Separating an outgoing overlap must not trigger another bounce.
      let axis = 0, sign = 1, nearest = Infinity;
      for (let k = 0; k < 3; k++) for (const direction of [-1, 1]) {
        const gap = direction < 0 ? position[k] - low[k] : high[k] - position[k];
        if (gap < nearest) { nearest = gap; axis = k; sign = direction; }
      }
      normal.fill(0); normal[axis] = sign; closest[axis] = sign < 0 ? low[axis] : high[axis];
    }
    return { time, closest, normal };
  }
  return null;
}

/** Short gravity substeps plus continuous sweeps prevent tunnelling on slow
 * frames. Outgoing overlaps are separated without repeated hit effects. */
export function stepVolleyballBall(ball: VolleyballBallMotion, gravity: number, dt: number, radius = volleyballBallRadius(false), net?: NetSurface, onImpact?: (x: number, y: number, velocity: number) => void) {
  if (!(dt > 0)) return false;
  // Most of a rally is away from the net. Advance that flight analytically
  // without geometry queries, spring sampling or per-substep allocations.
  const endX = ball.bx + ball.bvx * dt, endZ = ball.bz + ball.bvz * dt;
  const reachZ = NET_HALF_DEPTH + radius + .42;
  if (Math.min(ball.bz, endZ) > reachZ || Math.max(ball.bz, endZ) < -reachZ || Math.min(ball.bx, endX) > NET_HALF_WIDTH + radius || Math.max(ball.bx, endX) < -NET_HALF_WIDTH - radius) {
    ball.bx = endX; ball.bz = endZ; ball.by += ball.bvy * dt + .5 * gravity * dt * dt; ball.bvy += gravity * dt;
    return false;
  }
  let collided = false;
  const steps = Math.ceil(dt * 120), step = dt / steps;
  for (let i = 0; i < steps; i++) {
    const start = [ball.bx, ball.by, ball.bz];
    const delta = [ball.bvx * step, ball.bvy * step + .5 * gravity * step * step, ball.bvz * step];
    const offset = net?.displacement(clamp(ball.bx, -NET_HALF_WIDTH, NET_HALF_WIDTH), clamp(ball.by, NET_BOTTOM, VOLLEYBALL_NET_TOP)) ?? 0;
    const contact = sweepNet(start, delta, offset, radius);
    if (!contact) {
      ball.bx += delta[0]; ball.by += delta[1]; ball.bz += delta[2]; ball.bvy += gravity * step;
      continue;
    }
    const { time, closest, normal } = contact;
    const remaining = step * (1 - time);
    ball.bvy += gravity * step * time;
    const surfaceVelocity = net?.velocity(closest[0], closest[1]) ?? 0;
    const incoming = ball.bvx * normal[0] + ball.bvy * normal[1] + (ball.bvz - surfaceVelocity) * normal[2];
    if (incoming < -1e-6) {
      const impactVelocity = Math.abs(ball.bvz) > .01 ? ball.bvz : (start[2] >= offset ? -.2 : .2) * Math.abs(incoming);
      net?.impact(closest[0], closest[1], impactVelocity);
      onImpact?.(closest[0], closest[1], impactVelocity);
      ball.bvx *= .75; ball.bvy *= .65; ball.bvz *= .75;
      const dampedNormal = ball.bvx * normal[0] + ball.bvy * normal[1] + ball.bvz * normal[2];
      const correction = Math.max(.3, -incoming * .35) + surfaceVelocity * normal[2] * .3 - dampedNormal;
      ball.bvx += normal[0] * correction; ball.bvy += normal[1] * correction; ball.bvz += normal[2] * correction;
      // A perfectly vertical landing must spill off the narrow tape instead
      // of bouncing in place indefinitely with no horizontal velocity.
      if (normal[1] > .5 && Math.abs(ball.bvz) < 1) ball.bvz = start[2] >= offset ? 1 : -1;
      collided = true;
    }
    ball.bx = closest[0] + normal[0] * (radius + .002) + ball.bvx * remaining;
    ball.by = closest[1] + normal[1] * (radius + .002) + ball.bvy * remaining + .5 * gravity * remaining ** 2;
    ball.bz = closest[2] + normal[2] * (radius + .002) + ball.bvz * remaining;
    ball.bvy += gravity * remaining;
  }
  return collided;
}
