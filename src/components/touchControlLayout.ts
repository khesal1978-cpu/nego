export type ControlFamily = 'gun' | 'nuke' | 'volleyball';
export type TouchAction = 'move' | 'fire' | 'jump' | 'throw' | 'dodge' | 'spike' | 'dive' | 'lift' | 'super';
export type TouchButton = { x: number; y: number; size: number; opacity: number };
export type TouchLayouts = Record<ControlFamily, Partial<Record<TouchAction, TouchButton>>>;
export interface TouchGameActions {
  spikeRequested: boolean; diveRequested: boolean; superRequested: boolean;
  liftRequested?: boolean; jumpRequested?: boolean;
  firingHeld?: boolean; fireRequested?: boolean;
  throwRequested?: boolean; dodgeRequested?: boolean;
  joystickX?: number; joystickY?: number; joystickActive?: boolean;
}
const button = (x: number, y: number, size = 62, opacity = .6): TouchButton => ({ x, y, size, opacity });
export const DEFAULT_TOUCH_LAYOUTS: TouchLayouts = {
  gun: { move: button(14, 76, 112), fire: button(86, 69, 74), jump: button(94, 43, 54) },
  nuke: { move: button(14, 76, 112), throw: button(84, 65, 70), dodge: button(94, 81, 60), jump: button(94, 43, 54) },
  volleyball: { move: button(14, 76, 112), spike: button(88, 65, 72), dive: button(77, 83, 56), lift: button(95, 42, 54), super: button(78, 43, 54) },
};
const bound = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function normalizeTouchLayouts(input: unknown): TouchLayouts {
  const result = structuredClone(DEFAULT_TOUCH_LAYOUTS);
  if (!input || typeof input !== 'object') return result;
  for (const family of Object.keys(result) as ControlFamily[]) {
    const saved = (input as any)[family];
    if (!saved || typeof saved !== 'object') continue;
    for (const action of Object.keys(result[family]) as TouchAction[]) {
      const old = result[family][action]!, candidate = saved[action];
      if (!candidate || typeof candidate !== 'object') continue;
      result[family][action] = {
        x: bound(candidate.x, old.x, 5, 95), y: bound(candidate.y, old.y, 15, 90),
        size: bound(candidate.size, old.size, action === 'move' ? 84 : 44, action === 'move' ? 160 : 100),
        opacity: bound(candidate.opacity, old.opacity, .25, 1),
      };
    }
  }
  return result;
}
export function readTouchLayouts() {
  try { return normalizeTouchLayouts(JSON.parse(localStorage.getItem('bonkup-touch-layouts-v1') || 'null')); }
  catch { return normalizeTouchLayouts(null); }
}
export function saveTouchLayouts(layouts: TouchLayouts) {
  try { localStorage.setItem('bonkup-touch-layouts-v1', JSON.stringify(normalizeTouchLayouts(layouts))); } catch { /* Layouts still work in this session. */ }
}
export function touchJoystick(dx: number, dy: number, radius: number) {
  const distance = Math.hypot(dx, dy), scale = distance > radius ? radius / distance : 1;
  return { x: distance > 4 ? dx * scale / radius : 0, y: distance > 4 ? dy * scale / radius : 0 };
}
