import assert from 'node:assert/strict';
import test from 'node:test';
import { damageAtDistance, GUN_WEAPONS, segmentBoxHit, segmentCylinderHit } from './gunFightCombat';
import { applyGunMagazine, collectAssaultAmmo, createGunActionSync, equipGunWeapon, resetGunAmmo, spendGunRound, startGunReload, stepGunReload, type GunMagazine } from './gunMagazine';
import { collectGunAmmoPickup, createGunAmmoPickups, stepGunAmmoPickups } from './gunAmmoPickups';

for (const weaponType of ['assault', 'shotgun', 'fire'] as const) {
  test(`${weaponType}: empty magazines block fire and automatically refill at the weapon's reload time`, () => {
    const state = { weaponType, ammo: 0, reloadRemaining: 0, reserveAmmo: 90, assaultAmmo: 30 }, spec = GUN_WEAPONS[weaponType];
    resetGunAmmo(state);
    for (let round = 0; round < spec.magazine; round++) assert(spendGunRound(state));
    assert.equal(state.ammo, 0); assert.equal(state.reloadRemaining, spec.reloadSec);
    assert(!spendGunRound(state)); assert(!startGunReload(state), 'Repeated reload cannot restart the timer');
    for (const fps of [20, 30, 60, 120]) {
      state.reloadRemaining = spec.reloadSec; state.ammo = 0; state.reserveAmmo = 90;
      let elapsed = 0;
      while (elapsed + 1 / fps < spec.reloadSec - 1e-8) { assert(!stepGunReload(state, 1 / fps)); elapsed += 1 / fps; assert.equal(state.ammo, 0); }
      assert(stepGunReload(state, spec.reloadSec - elapsed + 1e-7));
      assert.equal(state.ammo, spec.magazine); assert(spendGunRound(state), 'Held fire can resume after the refill');
    }
  });
  test(`${weaponType}: manual reload and fresh pickup/respawn refill the magazine`, () => {
    const state: GunMagazine = { weaponType, ammo: GUN_WEAPONS[weaponType].magazine, reloadRemaining: 0, reserveAmmo: 90, assaultAmmo: 30 };
    assert(!startGunReload(state), 'A full magazine does not reload');
    assert(spendGunRound(state)); assert(startGunReload(state));
    const timer = state.reloadRemaining;
    assert(!startGunReload(state)); assert.equal(state.reloadRemaining, timer);
    assert(!spendGunRound(state)); assert(!stepGunReload(state, 0), 'Paused frames keep their remaining time');
    resetGunAmmo(state); assert.equal(state.reloadRemaining, 0); assert.equal(state.ammo, GUN_WEAPONS[weaponType].magazine);
    equipGunWeapon(state, 'shotgun'); assert.equal(state.ammo, GUN_WEAPONS.shotgun.magazine);
    applyGunMagazine(state, { ammo: 1000, reloadRemaining: Infinity }); assert.equal(state.ammo, 5); assert.equal(state.reloadRemaining, 0);
  });
}

test('Assault has exactly 120 rounds per life and empty reserve cannot create rounds', () => {
  const state: GunMagazine = { weaponType: 'assault', ammo: 0, reserveAmmo: 0, assaultAmmo: 0, reloadRemaining: 0 };
  resetGunAmmo(state); assert.equal(state.ammo, 30); assert.equal(state.reserveAmmo, 90);
  for (let magazine = 0; magazine < 4; magazine++) {
    for (let i = 0; i < 30; i++) assert(spendGunRound(state));
    if (magazine < 3) { assert(stepGunReload(state, 2)); assert.equal(state.reserveAmmo, 60 - magazine * 30); }
  }
  assert.equal(state.ammo, 0); assert.equal(state.reserveAmmo, 0); assert.equal(state.reloadRemaining, 0);
  assert(!spendGunRound(state)); assert(!startGunReload(state)); assert(!stepGunReload(state, 10));
  assert.equal(collectAssaultAmmo(state), 30); assert(state.reloadRemaining > 0);
  assert(stepGunReload(state, 2)); assert.equal(state.ammo, 30); assert.equal(state.reserveAmmo, 0);
});

test('manual reload conserves rounds, supports partial magazines and pickups cap at 120 total', () => {
  const state: GunMagazine = { weaponType: 'assault', ammo: 10, assaultAmmo: 10, reserveAmmo: 7, reloadRemaining: 0 };
  assert(startGunReload(state)); assert(stepGunReload(state, 2));
  assert.equal(state.ammo, 17); assert.equal(state.reserveAmmo, 0);
  for (let i = 0; i < 4; i++) collectAssaultAmmo(state);
  assert.equal(state.ammo + state.reserveAmmo, 120); assert.equal(collectAssaultAmmo(state), 0);
  applyGunMagazine(state, { ammo: 30, reserveAmmo: 1000, assaultAmmo: 30 });
  assert.equal(state.reserveAmmo, 90);
});

test('timed Shotgun/Fire retain unlimited reserve and preserve Assault ammo across swaps', () => {
  const state: GunMagazine = { weaponType: 'assault', ammo: 9, assaultAmmo: 9, reserveAmmo: 21, reloadRemaining: 0 };
  for (const weapon of ['shotgun', 'fire'] as const) {
    equipGunWeapon(state, weapon);
    for (let mag = 0; mag < 5; mag++) {
      for (let round = 0; round < GUN_WEAPONS[weapon].magazine; round++) assert(spendGunRound(state));
      assert(stepGunReload(state, 2));
    }
    assert.equal(state.reserveAmmo, 21);
    equipGunWeapon(state, 'assault'); assert.equal(state.ammo, 9); assert.equal(state.reserveAmmo, 21);
  }
  equipGunWeapon(state, 'fire'); collectAssaultAmmo(state);
  equipGunWeapon(state, 'assault'); assert.equal(state.ammo, 9); assert.equal(state.reserveAmmo, 51);
  resetGunAmmo(state); assert.equal(state.ammo, 30); assert.equal(state.reserveAmmo, 90);
});

test('custom magazines protect pending inputs, deduplicate actions, and recover after death or delayed packets', () => {
  const guest = createGunActionSync(), host = createGunActionSync();
  const first = guest.issue(1, 1000);
  assert(!guest.canApply(1, host.capture(), 1100), 'A pre-shot snapshot cannot return a spent bullet');
  assert(host.receive(1, first, 1100)); assert(!host.receive(1, first, 1200));
  assert(guest.canApply(1, host.capture(), 1200));
  const second = guest.issue(1, 1300);
  assert(!guest.canApply(1, host.capture(), 1400), 'Reload stays pending until host acknowledgement');
  assert(host.receive(1, second, 1450)); assert(guest.canApply(1, host.capture(), 1500));
  guest.issue(1, 1600); assert(guest.canApply(1, {}, 1601, true), 'Death/respawn and weapon switches reconcile immediately');
  guest.issue(1, 2000); assert(guest.canApply(1, {}, 2850), 'A dropped input cannot block reconciliation forever');
});

test('ammo crates require a living nearby fighter, can be used once, and respawn at distinct new pads', () => {
  const pickups = createGunAmmoPickups(() => .5), pickup = pickups[0];
  assert.equal(new Set(pickups.map(p => p.spotIndex)).size, 3);
  assert.equal(pickups.filter(p => p.active).length, 2);
  const fighter = { ...pickup, weaponType: 'assault' as const, ammo: 30, assaultAmmo: 30, reserveAmmo: 90, reloadRemaining: 0, hp: 100, respawnTimer: 0 };
  assert.equal(collectGunAmmoPickup(pickup, fighter), 0, 'Full supply leaves a crate available');
  fighter.reserveAmmo = 0;
  assert.equal(collectGunAmmoPickup(pickup, { ...fighter, hp: 0 }), 0);
  assert.equal(collectGunAmmoPickup(pickup, { ...fighter, respawnTimer: 2 }), 0);
  assert.equal(collectGunAmmoPickup(pickup, { ...fighter, x: pickup.x + 2 }), 0);
  assert.equal(collectGunAmmoPickup(pickup, { ...fighter, y: pickup.y + 2 }), 0);
  assert.equal(collectGunAmmoPickup(pickup, fighter, () => .5), 30);
  assert.equal(collectGunAmmoPickup(pickup, fighter), 0, 'No repeated collection while hidden');
  const previous = pickup.spotIndex;
  assert(!stepGunAmmoPickups(pickups, 0));
  stepGunAmmoPickups(pickups, 11.99, () => .5); assert(!pickup.active);
  assert(stepGunAmmoPickups(pickups, .02, () => .5)); assert(pickup.active);
  assert.notEqual(pickup.spotIndex, previous);
  assert.equal(new Set(pickups.map(p => p.spotIndex)).size, 3);
});

test('fast projectiles hit thin cover before a fighter behind it', () => {
  const from = { x: 0, y: 1, z: 0 };
  const to = { x: 10, y: 1, z: 0 };
  const wall = segmentBoxHit(from, to, { x: 3, y: 1, z: 0, w: 0.1, h: 2, d: 4 });
  const fighter = segmentCylinderHit(from, to, 5, 0, 0.8, 0.1, 1.85);
  assert.ok(wall !== null && fighter !== null && wall < fighter);
  assert.ok(Math.abs(wall - 0.295) < 1e-8);
});

test('short sight lines still respect walls and ignore clear paths above cover', () => {
  const box = { x: 1, y: 1, z: 0, w: 0.2, h: 2, d: 3 };
  assert.notEqual(segmentBoxHit({ x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }, box), null);
  assert.equal(segmentBoxHit({ x: 0, y: 3, z: 0 }, { x: 2, y: 3, z: 0 }, box), null);
  assert.equal(segmentBoxHit({ x: 0, y: 1, z: 4 }, { x: 2, y: 1, z: 4 }, box), null);
});

test('cylinders respect elevation, including vertical shots and targets behind a projectile', () => {
  assert.equal(segmentCylinderHit({ x: 0, y: 4, z: 0 }, { x: 10, y: 4, z: 0 }, 5, 0, 1, 0, 2), null);
  assert.equal(segmentCylinderHit({ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, -5, 0, 1, 0, 2), null);
  assert.equal(segmentCylinderHit({ x: 0, y: 1, z: 0 }, { x: 0, y: 3, z: 0 }, 0, 0, 1, 2, 4), 0.5);
  assert.equal(segmentCylinderHit({ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, 0, 0, 1, 0, 2), 0);
});

test('shotguns reward close range while long-range damage remains bounded', () => {
  assert.equal(damageAtDistance('shotgun', 3), 1);
  assert.ok(damageAtDistance('shotgun', 14) < damageAtDistance('assault', 14));
  for (const weapon of ['assault', 'shotgun', 'fire'] as const) {
    assert.ok(GUN_WEAPONS[weapon].magazine > 0 && GUN_WEAPONS[weapon].reloadSec > 0);
    for (const range of [0, 5, 15, 30, 100]) {
      const scale = damageAtDistance(weapon, range);
      assert.ok(scale > 0 && scale <= 1);
    }
  }
});
