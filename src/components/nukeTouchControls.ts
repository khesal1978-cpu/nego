type Pointer = { pointerId: number; clientX: number; clientY: number; type?: string };

/** Completed taps throw immediately. Dodge has its own visible button. */
export function createNukeTouchActions(throwBall: () => void, dodge: () => void, now = () => performance.now()) {
  let active: { id: number; x: number; y: number; time: number; dragged: boolean } | null = null;
  return {
    start(event: Pointer) {
      if (active) return false;
      active = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now(), dragged: false };
      return true;
    },
    move(event: Pointer) {
      if (active?.id === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 22) {
        active.dragged = true;
      }
    },
    end(event: Pointer) {
      if (active?.id !== event.pointerId) return;
      this.move(event);
      const time = now();
      const tap = event.type === 'pointerup' && !active.dragged && time - active.time < 500;
      active = null;
      if (tap) throwBall();
    },
    dodge() { dodge(); },
    reset() { active = null; },
  };
}
