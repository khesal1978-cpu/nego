/** Small angle correction only: the reticle remains under the player's control. */
export function assistedNukeDirection(x: number, z: number, targetX: number, targetZ: number) {
  const angle = Math.atan2(x, z);
  const targetAngle = Math.atan2(targetX, targetZ);
  const difference = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
  const correction = Math.max(-.065, Math.min(.065, difference * .35));
  return { x: Math.sin(angle + correction), z: Math.cos(angle + correction) };
}

export const movementBlend = (dt: number, moving: boolean, grounded: boolean) =>
  1 - Math.exp(-Math.max(0, dt) * (grounded ? moving ? 18 : 24 : 7));

type Point3 = { x: number; y: number; z: number };

/** Choose the depth under the reticle, rather than a fixed point past every target. */
export function nukeAimPoint(camera: Point3, direction: Point3, player: Point3, target?: Point3) {
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const ray = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
  const depthOf = (point: Point3) => (point.x - camera.x) * ray.x + (point.y - camera.y) * ray.y + (point.z - camera.z) * ray.z;
  const minimumDepth = Math.max(.5, depthOf(player) + 1.2);
  const floorDepth = ray.y < -.001 ? (.12 - camera.y) / ray.y : 45;
  const depth = Math.max(minimumDepth, Math.min(45, target ? depthOf(target) : floorDepth));
  return { x: camera.x + ray.x * depth, y: camera.y + ray.y * depth, z: camera.z + ray.z * depth };
}

/** Account for the hand offset and gravity so the ball reaches the selected point. */
export function nukeThrowVelocity(origin: Point3, target: Point3, speed: number, gravity = 9.2) {
  const dx = target.x - origin.x, dz = target.z - origin.z;
  const distance = Math.max(.01, Math.hypot(dx, dz));
  const time = distance / Math.max(1, speed);
  return { x: dx / time, y: (target.y - origin.y) / time + .5 * gravity * time, z: dz / time };
}

export function advanceNukeThrow(ball: Point3 & { vx: number; vy: number; vz: number }, dt: number) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt - .5 * 9.2 * dt * dt;
  ball.z += ball.vz * dt;
  ball.vy -= 9.2 * dt;
}

export function nukeLookDelta(dx: number, dy: number, height: number, touch: boolean) {
  const sensitivity = touch ? .0038 * Math.max(.65, Math.min(1.3, 500 / Math.max(240, height))) : .0028;
  return { yaw: -dx * sensitivity, pitch: dy * sensitivity * .85 };
}

export function nukeRoundSurvivors(players: number, round: number) {
  return Math.max(1, players - round);
}

export const nukeHitAllowed = (dodgeTimer: number, invulnerableTimer: number) => dodgeTimer <= 0 && invulnerableTimer <= 0;
export const NUKE_HIT_RADIUS = .94;

export function nukeDodgeDirection(x: number, z: number, facingYaw: number) {
  const length = Math.hypot(x, z);
  return Number.isFinite(length) && length > .05 ? { x: x / length, z: z / length } : { x: Math.sin(facingYaw), z: Math.cos(facingYaw) };
}

export function beginNukeDodge(athlete: { dodgeCooldown: number; dodgeActiveTimer: number; catchWindowTimer: number; grounded: boolean; knockVx: number; knockVz: number }, direction: { x: number; z: number }) {
  if (athlete.dodgeCooldown > 0) return false;
  athlete.dodgeCooldown = .68; athlete.dodgeActiveTimer = .34; athlete.catchWindowTimer = .32;
  const impulse = athlete.grounded ? 10.5 : 6;
  athlete.knockVx = direction.x * impulse; athlete.knockVz = direction.z * impulse;
  return true;
}

/** Gentle reticle attraction within a small cone; never snaps across the arena. */
export function nukeAimAssistStep(x: number, y: number, aspect: number, fov: number, dt: number) {
  if (Math.hypot(x * aspect, y) > .2) return { yaw: 0, pitch: 0 };
  const tangent = Math.tan(fov * Math.PI / 360);
  const blend = 1 - Math.exp(-3 * Math.max(0, dt));
  const limit = .35 * Math.max(0, dt);
  const bounded = (angle: number) => Math.max(-limit, Math.min(limit, angle * blend));
  return { yaw: bounded(-Math.atan(x * aspect * tangent)), pitch: bounded(-Math.atan(y * tangent)) };
}
