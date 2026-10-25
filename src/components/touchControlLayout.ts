export type ControlFamily = 'gun' | 'nuke' | 'volleyball';
export type TouchAction = 'move' | 'fire' | 'reload' | 'jump' | 'throw' | 'dodge' | 'spike' | 'dive' | 'lift' | 'super';
export type TouchButton = { x: number; y: number; size: number; opacity: number };
export type TouchLayouts = Record<ControlFamily, Partial<Record<TouchAction, TouchButton>>>;
export interface TouchGameActions {
  spikeRequested: boolean; diveRequested: boolean; superRequested: boolean;
  liftRequested?: boolean; jumpRequested?: boolean;
  firingHeld?: boolean; fireRequested?: boolean; reloadRequested?: boolean;
  throwRequested?: boolean; dodgeRequested?: boolean;
  joystickX?: number; joystickY?: number; joystickActive?: boolean;
}
const button = (x: number, y: number, size = 62, opacity = .7): TouchButton => ({ x, y, size, opacity });
const LEGACY_TOUCH_LAYOUTS: TouchLayouts = {
  gun: { move: button(14, 76, 112, .6), fire: button(86, 69, 74, .6), jump: button(94, 43, 54, .6) },
  nuke: { move: button(14, 76, 112, .6), throw: button(84, 65, 70, .6), dodge: button(94, 81, 60, .6), jump: button(94, 43, 54, .6) },
  volleyball: { move: button(14, 76, 112, .6), spike: button(88, 65, 72, .6), dive: button(77, 83, 56, .6), lift: button(95, 42, 54, .6), super: button(78, 43, 54, .6) },
};
export const DEFAULT_TOUCH_LAYOUTS: TouchLayouts = {
  gun: { move: button(14, 76, 110, .6), fire: button(88, 56, 78, .8), jump: button(92, 83, 58), reload: button(77, 82, 54) },
  nuke: { move: button(14, 76, 110, .6), throw: button(88, 56, 78, .8), dodge: button(77, 82, 56), jump: button(92, 83, 58) },
  volleyball: { move: button(14, 76, 110, .6), spike: button(88, 56, 78, .8), dive: button(77, 82, 56), lift: button(77, 38, 52), super: button(92, 29, 52) },
};
const bound = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
/** Match the gameplay CSS limits so editing never offers sizes the screen clamps away. */
export function touchControlSizeLimits(action: TouchAction, height: number) {
  const move = action === 'move';
  let max = move ? 160 : 100;
  if (height <= 360) max = move ? 100 : 72;
  if (height <= 300) max = move ? 88 : 60;
  if (!move && height <= 260) max = 52;
  if (!move && height <= 220) max = 48;
  return { min: move ? 84 : 44, max };
}
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
  try {
    const current = localStorage.getItem('bonkup-touch-layouts-v2');
    if (current) return normalizeTouchLayouts(JSON.parse(current));
    const saved = JSON.parse(localStorage.getItem('bonkup-touch-layouts-v1') || 'null');
    const migrated = normalizeTouchLayouts(saved);
    // Old builds saved defaults too. Refresh untouched families, keeping custom layouts intact.
    for (const family of Object.keys(migrated) as ControlFamily[]) {
      const legacy = LEGACY_TOUCH_LAYOUTS[family];
      if (saved?.[family] && Object.entries(legacy).every(([action, layout]) =>
        (Object.keys(layout) as (keyof TouchButton)[]).every(key => saved[family][action]?.[key] === layout[key]))) {
        migrated[family] = structuredClone(DEFAULT_TOUCH_LAYOUTS[family]);
      }
    }
    return migrated;
  }
  catch { return normalizeTouchLayouts(null); }
}
export function saveTouchLayouts(layouts: TouchLayouts) {
  try { localStorage.setItem('bonkup-touch-layouts-v2', JSON.stringify(normalizeTouchLayouts(layouts))); } catch { /* Layouts still work in this session. */ }
}
export function touchJoystick(dx: number, dy: number, radius: number) {
  const distance = Math.hypot(dx, dy), scale = distance > radius ? radius / distance : 1;
  return { x: distance > 4 ? dx * scale / radius : 0, y: distance > 4 ? dy * scale / radius : 0 };
}
