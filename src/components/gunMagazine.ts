import { GUN_WEAPONS, type GunWeapon } from './gunFightCombat';

export const ASSAULT_AMMO_CAP = 120;
export const ASSAULT_PICKUP_ROUNDS = 30;
export interface GunMagazine {
  weaponType: GunWeapon; ammo: number; reloadRemaining: number;
  reserveAmmo: number; assaultAmmo: number;
}
/** A fresh life starts with 30 loaded and 90 spare assault rounds. */
export function resetGunAmmo(state: GunMagazine) {
  state.assaultAmmo = GUN_WEAPONS.assault.magazine;
  state.reserveAmmo = ASSAULT_AMMO_CAP - state.assaultAmmo;
  state.ammo = GUN_WEAPONS[state.weaponType].magazine;
  state.reloadRemaining = 0;
}
/** Timed power weapons never replenish the saved assault supply. */
export function equipGunWeapon(state: GunMagazine, weapon: GunWeapon) {
  if (state.weaponType === 'assault') state.assaultAmmo = state.ammo;
  state.weaponType = weapon;
  state.ammo = weapon === 'assault' ? state.assaultAmmo : GUN_WEAPONS[weapon].magazine;
  state.reloadRemaining = 0;
  if (state.ammo === 0) startGunReload(state);
}
export function collectAssaultAmmo(state: GunMagazine) {
  const added = Math.max(0, Math.min(ASSAULT_PICKUP_ROUNDS, ASSAULT_AMMO_CAP - state.assaultAmmo - state.reserveAmmo));
  state.reserveAmmo += added;
  if (added > 0 && state.weaponType === 'assault' && state.ammo === 0) startGunReload(state);
  return added;
}
export function startGunReload(state: GunMagazine) {
  if (state.reloadRemaining > 0 || state.ammo >= GUN_WEAPONS[state.weaponType].magazine || (state.weaponType === 'assault' && state.reserveAmmo <= 0)) return false;
  state.reloadRemaining = GUN_WEAPONS[state.weaponType].reloadSec;
  return true;
}
// A shotgun blast spends one shell, regardless of how many pellets it creates.
export function spendGunRound(state: GunMagazine) {
  if (state.reloadRemaining > 0) return false;
  if (state.ammo <= 0) { startGunReload(state); return false; }
  state.ammo -= 1;
  if (state.weaponType === 'assault') state.assaultAmmo = state.ammo;
  if (state.ammo === 0) startGunReload(state);
  return true;
}
export function stepGunReload(state: GunMagazine, dt: number) {
  if (state.reloadRemaining <= 0 || !Number.isFinite(dt) || dt <= 0) return false;
  state.reloadRemaining = Math.max(0, state.reloadRemaining - dt);
  if (state.reloadRemaining > 1e-8) return false;
  const missing = GUN_WEAPONS[state.weaponType].magazine - state.ammo;
  const loaded = state.weaponType === 'assault' ? Math.min(missing, state.reserveAmmo) : missing;
  state.ammo += loaded;
  state.reloadRemaining = 0;
  if (state.weaponType === 'assault') { state.reserveAmmo -= loaded; state.assaultAmmo = state.ammo; }
  return true;
}
export function applyGunMagazine(state: GunMagazine, snapshot: Record<string, unknown>) {
  const spec = GUN_WEAPONS[state.weaponType];
  if (typeof snapshot.ammo === 'number' && Number.isFinite(snapshot.ammo)) state.ammo = Math.max(0, Math.min(spec.magazine, Math.floor(snapshot.ammo)));
  if (typeof snapshot.assaultAmmo === 'number' && Number.isFinite(snapshot.assaultAmmo)) state.assaultAmmo = Math.max(0, Math.min(GUN_WEAPONS.assault.magazine, Math.floor(snapshot.assaultAmmo)));
  if (state.weaponType === 'assault') state.assaultAmmo = state.ammo;
  if (typeof snapshot.reserveAmmo === 'number' && Number.isFinite(snapshot.reserveAmmo)) state.reserveAmmo = Math.max(0, Math.min(ASSAULT_AMMO_CAP - state.assaultAmmo, Math.floor(snapshot.reserveAmmo)));
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
