type Pointer = { pointerId: number; pointerType: string; button?: number; clientX: number; clientY: number; type?: string };

/** Touch taps never request a shot; only completed short double-taps jump. */
export function createGunTouchActions(jump: () => void, now = () => performance.now()) {
  let active: { id: number; x: number; y: number; time: number; dragged: boolean } | null = null;
  let lastTap: number | null = null;
  return {
    start(event: Pointer) {
      if (active) return false;
      active = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now(), dragged: false };
      if (event.pointerType === 'mouse' && event.button === 2) jump();
      return true;
    },
    move(event: Pointer) {
      if (active?.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 14) active.dragged = true;
    },
    end(event: Pointer) {
      if (active?.id !== event.pointerId) return;
      this.move(event);
      const time = now();
      const tap = event.type === 'pointerup' && event.pointerType !== 'mouse' && !active.dragged && time - active.time < 280;
      if (tap) {
        if (lastTap !== null && time - lastTap < 320) { jump(); lastTap = null; }
        else lastTap = time;
      } else lastTap = null;
      active = null;
    },
    reset() { active = null; lastTap = null; },
  };
}
