/** Slow recovery prevents resolution pumping; brief stalls do not change quality. */
export function createFrameBudget() {
  let scale = 1, slow = 0, fast = 0, warmup = 3;
  let targetFps = 60;
  return {
    get scale() { return scale; },
    get targetFps() { return targetFps; },
    sample(fps: number) {
      if (!Number.isFinite(fps) || fps <= 0) return false;
      // Follow demonstrated refresh rates; never force a 60 Hz phone to chase 120.
      targetFps = Math.max(targetFps, fps >= 105 ? 120 : fps >= 78 ? 90 : 60);
      if (warmup > 0) { warmup--; return false; }
      // A 120 Hz screen must not sacrifice clarity just to chase its refresh rate.
      slow = fps < 50 ? slow + 1 : 0;
      fast = fps > 57 ? fast + 1 : 0;
      const next = slow >= 4 ? Math.max(.85, scale - .05) : fast >= 8 ? Math.min(1, scale + .025) : scale;
      if (next === scale) return false;
      scale = next; slow = fast = 0; return true;
    },
  };
}
