export function volleyballFollowCamera(px: number, pz: number, bx: number, portrait: number) {
  // Follow the controlled player. A little ball lead keeps the next shot in view.
  const x = Math.max(-3.5, Math.min(3.5, px)), z = Math.max(.85, Math.min(6.6, pz));
  return {
    position: { x: x * .85, y: 5.65 + portrait * 1.9, z: 8.2 + z * .72 + portrait * 3.9 },
    look: { x: x * .72 + Math.max(-3, Math.min(3, bx - x)) * .08, y: 1.15, z: z * .5 - 1 },
  };
}
