export const NUKE_KIT_HEAL = 60;
export const NUKE_KIT_RESPAWN_SECONDS = 16;
export const NUKE_KIT_SPOTS = [
  { x: -7, z: 4 }, { x: 7, z: -4 }, { x: -7, z: -4 },
  { x: 7, z: 4 }, { x: 0, z: 10 }, { x: 0, z: -10 },
];
export type NukeHealthKit = { spotIndex: number; active: boolean; cooldown: number };
export function createNukeHealthKits(): NukeHealthKit[] {
  return [{ spotIndex: 0, active: true, cooldown: 0 }, { spotIndex: 1, active: false, cooldown: 8 }];
}
export function updateNukeHealthKits(kits: NukeHealthKit[], dt: number, random = Math.random) {
  let spawned = false;
  for (const kit of kits) {
    if (kit.active) continue;
    kit.cooldown = Math.max(0, kit.cooldown - dt);
    if (kit.cooldown > 0) continue;
    const free = NUKE_KIT_SPOTS.map((_, index) => index).filter(index => index !== kit.spotIndex && !kits.some(other => other !== kit && other.spotIndex === index));
    kit.spotIndex = free[Math.min(free.length - 1, Math.floor(random() * free.length))];
    kit.active = true;
    spawned = true;
  }
  return spawned;
}
export function collectNukeHealthKit(kit: NukeHealthKit, athlete: { x: number; y: number; z: number; hp: number; maxHp: number; eliminated: boolean }) {
  const spot = NUKE_KIT_SPOTS[kit.spotIndex];
  if (!kit.active || athlete.eliminated || athlete.hp <= 0 || athlete.hp >= athlete.maxHp || Math.hypot(athlete.x - spot.x, athlete.z - spot.z) > 1.5 || Math.abs(athlete.y - .02) > 1.4) return 0;
  const healed = Math.min(NUKE_KIT_HEAL, athlete.maxHp - athlete.hp);
  athlete.hp += healed;
  kit.active = false;
  kit.cooldown = NUKE_KIT_RESPAWN_SECONDS;
  return healed;
}
