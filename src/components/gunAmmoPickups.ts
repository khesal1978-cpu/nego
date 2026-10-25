import { collectAssaultAmmo, type GunMagazine } from './gunMagazine';

export const GUN_AMMO_SPOTS = [
  { x: -5.4, y: .02, z: 5.6 }, { x: 5.4, y: .02, z: -2.2 },
  { x: -13.2, y: .02, z: 1.5 }, { x: 13.2, y: .02, z: 1.5 },
  { x: -3, y: .02, z: 12 }, { x: 3, y: .02, z: -9 },
];
export interface GunAmmoPickupState {
  x: number; y: number; z: number; spotIndex: number; active: boolean; respawnTimer: number;
}
const chooseSpot = (pickups: GunAmmoPickupState[], previous: number, random: () => number) => {
  const free = GUN_AMMO_SPOTS.map((_, i) => i).filter(i => i !== previous && !pickups.some(p => p.spotIndex === i));
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))] ?? 0;
};
export function createGunAmmoPickups(random = Math.random) {
  const pickups: GunAmmoPickupState[] = [];
  for (let i = 0; i < 3; i++) {
    const spotIndex = chooseSpot(pickups, -1, random), active = i < 2;
    pickups.push({ ...GUN_AMMO_SPOTS[spotIndex], spotIndex, active, respawnTimer: active ? 0 : 5 });
  }
  return pickups;
}
/** Only the match authority advances the shared pickup pool. */
export function stepGunAmmoPickups(pickups: GunAmmoPickupState[], dt: number, random = Math.random) {
  if (!Number.isFinite(dt) || dt <= 0) return false;
  let changed = false;
  for (const pickup of pickups) {
    if (pickup.active) continue;
    pickup.respawnTimer = Math.max(0, pickup.respawnTimer - dt);
    if (pickup.respawnTimer === 0) {
      pickup.spotIndex = chooseSpot(pickups, pickup.spotIndex, random);
      Object.assign(pickup, GUN_AMMO_SPOTS[pickup.spotIndex]);
      pickup.active = true; changed = true;
    }
  }
  return changed;
}
export function collectGunAmmoPickup(pickup: GunAmmoPickupState, fighter: GunMagazine & { x: number; y: number; z: number; hp: number; respawnTimer: number }, random = Math.random) {
  if (!pickup.active || fighter.hp <= 0 || fighter.respawnTimer > 0 || Math.hypot(fighter.x - pickup.x, fighter.z - pickup.z) >= 1.5 || Math.abs(fighter.y - pickup.y) >= 1.4) return 0;
  const added = collectAssaultAmmo(fighter);
  if (added > 0) { pickup.active = false; pickup.respawnTimer = 10 + random() * 4; }
  return added;
}
