import { volleyballCourtZ } from './volleyballNetCollision';
export type VolleyballMovement = { px: number; pz: number; pvx: number; pvz: number; pDiveTimer: number };

/** Horizontal movement only follows input or an explicitly requested dive. */
export function moveVolleyballPlayer(player: VolleyballMovement, inputX: number, inputZ: number, speed: number, dt: number) {
  if (player.pDiveTimer > 0) {
    player.pDiveTimer = Math.max(0, player.pDiveTimer - dt);
    player.px += player.pvx * dt;
    player.pz += player.pvz * dt;
    const drag = Math.pow(.91, dt * 60);
    player.pvx *= drag;
    player.pvz *= drag;
  } else {
    const length = Math.hypot(inputX, inputZ);
    if (length > .01) {
      const factor = Math.min(1, length) / length;
      player.px += inputX * factor * speed * dt;
      player.pz += inputZ * factor * speed * dt;
    }
    player.pvx = 0;
    player.pvz = 0;
  }
  player.px = Math.max(-3.5, Math.min(3.5, player.px));
  player.pz = volleyballCourtZ(player.pz, 1);
  if (player.pz === .85 && player.pvz < 0) player.pvz = 0;
}
