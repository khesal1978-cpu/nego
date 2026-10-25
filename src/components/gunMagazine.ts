import { GUN_WEAPONS, type GunWeapon } from './gunFightCombat';

export interface GunMagazine { weaponType: GunWeapon; ammo: number; reloadRemaining: number }
export function refillGunMagazine(state: GunMagazine) {
  state.ammo = GUN_WEAPONS[state.weaponType].magazine;
  state.reloadRemaining = 0;
}
export function startGunReload(state: GunMagazine) {
  if (state.reloadRemaining > 0 || state.ammo >= GUN_WEAPONS[state.weaponType].magazine) return false;
  state.reloadRemaining = GUN_WEAPONS[state.weaponType].reloadSec;
  return true;
}
// A shotgun blast spends one shell, regardless of how many pellets it creates.
export function spendGunRound(state: GunMagazine) {
  if (state.reloadRemaining > 0) return false;
  if (state.ammo <= 0) { startGunReload(state); return false; }
  state.ammo -= 1;
  if (state.ammo === 0) startGunReload(state);
  return true;
}
export function stepGunReload(state: GunMagazine, dt: number) {
  if (state.reloadRemaining <= 0 || !Number.isFinite(dt) || dt <= 0) return false;
  state.reloadRemaining = Math.max(0, state.reloadRemaining - dt);
  if (state.reloadRemaining > 1e-8) return false;
  refillGunMagazine(state);
  return true;
}
export function applyGunMagazine(state: GunMagazine, snapshot: Record<string, unknown>) {
  const spec = GUN_WEAPONS[state.weaponType];
  if (typeof snapshot.ammo === 'number' && Number.isFinite(snapshot.ammo)) state.ammo = Math.max(0, Math.min(spec.magazine, Math.floor(snapshot.ammo)));
  if (typeof snapshot.reloadRemaining === 'number' && Number.isFinite(snapshot.reloadRemaining)) state.reloadRemaining = Math.max(0, Math.min(spec.reloadSec, snapshot.reloadRemaining));
}

// Keep a local shot/reload from being undone by a host snapshot sent before that input.
export function createGunActionSync() {
  const seen = new Map<number, { id: number; until: number }>();
  return {
    issue(slot: number, now: number) {
      const id = (seen.get(slot)?.id || 0) + 1;
      seen.set(slot, { id, until: now + 800 }); return id;
    },
    receive(slot: number, id: unknown, now: number) {
      if (!Number.isSafeInteger(id) || Number(id) <= 0) return true;
      if ((seen.get(slot)?.id || 0) >= Number(id)) return false;
      seen.set(slot, { id: Number(id), until: now + 800 }); return true;
    },
    capture() { return Object.fromEntries([...seen].map(([slot, input]) => [slot, input.id])); },
    canApply(slot: number, acknowledged: unknown, now: number, reset = false) {
      const input = seen.get(slot);
      const id = acknowledged && typeof acknowledged === 'object' ? Number((acknowledged as Record<string, unknown>)[slot]) : 0;
      if (!reset && input && now < input.until && (!Number.isSafeInteger(id) || id < input.id)) return false;
      if (input) { input.until = 0; if (Number.isSafeInteger(id)) input.id = Math.max(input.id, id); }
      return true;
    },
  };
}
