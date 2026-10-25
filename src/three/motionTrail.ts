/** Trail samples have a fixed duration on 30/60/120 Hz screens. Reuse every point. */
export function createMotionTrail(count: number, spacing = 1 / 60) {
  const points = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0 }));
  const previous = { x: 0, y: 0, z: 0 };
  let elapsed = 0, initialized = false;
  const reset = (x: number, y: number, z: number) => {
    for (const point of points) { point.x = x; point.y = y; point.z = z; }
    previous.x = x; previous.y = y; previous.z = z; elapsed = 0; initialized = true;
  };
  return {
    points, reset,
    update(x: number, y: number, z: number, dt: number, active: boolean) {
      if (!active || !initialized || Math.hypot(x - previous.x, y - previous.y, z - previous.z) > 8) { reset(x, y, z); return; }
      if (!Number.isFinite(dt) || dt <= 0) return;
      for (let offset = spacing - elapsed; offset <= dt + 1e-9; offset += spacing) {
        for (let i = points.length - 1; i > 0; i--) {
          const before = points[i - 1], point = points[i]; point.x = before.x; point.y = before.y; point.z = before.z;
        }
        const fraction = Math.min(1, offset / dt), head = points[0];
        head.x = previous.x + (x - previous.x) * fraction;
        head.y = previous.y + (y - previous.y) * fraction;
        head.z = previous.z + (z - previous.z) * fraction;
      }
      elapsed = (elapsed + dt) % spacing;
      if (spacing - elapsed < 1e-9) elapsed = 0;
      previous.x = x; previous.y = y; previous.z = z;
    },
  };
}
