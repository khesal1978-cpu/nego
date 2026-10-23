type Pointer = { pointerId: number; clientX: number; clientY: number; type?: string };

/** Reserve a short first tap so a double-tap cannot throw before it dodges. */
export function createNukeTouchActions(throwBall: () => void, dodge: () => void, now = () => performance.now()) {
  let active: { id: number; x: number; y: number; time: number; dragged: boolean } | null = null;
  let firstTap: number | null = null;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(pending); pending = undefined; firstTap = null; };
  return {
    start(event: Pointer) {
      if (active) return false;
      clearTimeout(pending); pending = undefined;
      active = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now(), dragged: false };
      return true;
    },
    move(event: Pointer) {
      if (active?.id === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 14) {
        active.dragged = true; clear();
      }
    },
    end(event: Pointer) {
      if (active?.id !== event.pointerId) return;
      this.move(event);
      const time = now();
      const tap = event.type === 'pointerup' && !active.dragged && time - active.time < 280;
      active = null;
      if (!tap) { clear(); return; }
      if (firstTap !== null && time - firstTap <= 320) { clear(); dodge(); return; }
      firstTap = time;
      pending = setTimeout(() => { clear(); throwBall(); }, 240);
    },
    dodge() { clear(); active = null; dodge(); },
    reset() { clear(); active = null; },
  };
}
