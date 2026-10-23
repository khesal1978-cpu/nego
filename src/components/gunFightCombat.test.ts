import assert from 'node:assert/strict';
import test from 'node:test';
import { damageAtDistance, GUN_WEAPONS, segmentBoxHit, segmentCylinderHit } from './gunFightCombat';

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
