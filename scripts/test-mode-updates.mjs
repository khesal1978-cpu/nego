import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';

buildSync({ stdin: { contents: `export * from './src/components/nukeHealthKits'; export * from './src/components/volleyballMovement'; export * from './src/components/MatchPanels'; export * from './src/three/spawnShield'; export * from './src/three/crayonModels'; export * from './src/types/game';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/mode-updates-test.mjs' });
const m = await import('../.npm-cache/mode-updates-test.mjs');
for (const fps of [30, 60, 120]) {
  const player = { px: 0, pz: 4, pvx: 10, pvz: 10, pDiveTimer: 0 };
  for (let i = 0; i < fps; i++) m.moveVolleyballPlayer(player, 0, 0, 9, 1 / fps);
  assert.equal(player.px, 0); assert.equal(player.pz, 4, 'Idle player never drifts, including after a dive');
  m.moveVolleyballPlayer(player, 1, 0, 9, .1);
  assert(Math.abs(player.px - .9) < 1e-8);
  const x = player.px;
  for (let i = 0; i < fps; i++) m.moveVolleyballPlayer(player, 0, 0, 9, 1 / fps);
  assert.equal(player.px, x, 'Releasing movement stops immediately');
  player.pDiveTimer = .36; player.pvx = 8;
  for (let i = 0; i < fps; i++) m.moveVolleyballPlayer(player, 0, 0, 9, 1 / fps);
  const afterDive = player.px;
  for (let i = 0; i < fps; i++) m.moveVolleyballPlayer(player, 0, 0, 9, 1 / fps);
  assert.equal(player.px, afterDive, 'A requested dive ends without continued movement');
}
for (const spot of m.NUKE_KIT_SPOTS) assert(Math.hypot(spot.x, spot.z) < 16, 'Health kits stay on the playable floor');
const kits = m.createNukeHealthKits();
const athlete = { ...m.NUKE_KIT_SPOTS[0], y: .02, hp: 120, maxHp: 160, eliminated: false };
assert.equal(m.collectNukeHealthKit(kits[0], { ...athlete, hp: 160 }), 0, 'Full-health players leave the kit available');
assert.equal(m.collectNukeHealthKit(kits[0], { ...athlete, eliminated: true }), 0);
assert.equal(m.collectNukeHealthKit(kits[0], { ...athlete, x: 30 }), 0);
assert.equal(m.collectNukeHealthKit(kits[0], { ...athlete, y: 3 }), 0);
assert.equal(m.collectNukeHealthKit(kits[0], athlete), 40);
assert.equal(athlete.hp, 160, 'Healing caps at max HP');
assert.equal(m.collectNukeHealthKit(kits[0], { ...athlete, hp: 20 }), 0, 'The same kit cannot be collected twice');
assert.equal(m.updateNukeHealthKits(kits, 7.99, () => 0), false);
assert.equal(m.updateNukeHealthKits(kits, .02, () => 0), true, 'Second kit spawns after eight seconds');
assert(!kits[0].active);
m.updateNukeHealthKits(kits, 8, () => .999);
assert(kits.every(kit => kit.active));
assert.notEqual(kits[0].spotIndex, kits[1].spotIndex);
const spot = m.NUKE_KIT_SPOTS[kits[0].spotIndex];
assert.equal(m.collectNukeHealthKit(kits[0], { ...athlete, ...spot, hp: 20 }), 60);
assert.equal(m.RESPAWN_SHIELD_SECONDS, 2);
const shield = m.createSpawnShield();
m.updateSpawnShield(shield, 1.8);
assert(shield.visible && shield.children[0].material.uniforms.opacity.value > .9, 'Shield remains visible beyond 1.5 seconds');
m.updateSpawnShield(shield, 0); assert(!shield.visible);

const stats = { playerScore: 2, aiScore: 3, matchWinner: 'ai', bestRally: 6, lastPointReason: 'Eliminated in Round 3', raceTimeSec: 95, nukeStandings: [{ id: 'you', name: 'Player', roundWins: 2, kills: 1, hits: 3, catches: 2, hp: 0, alive: false, isPlayer: true }, { id: 'rival', name: 'Rival', roundWins: 3, kills: 2, hits: 4, catches: 0, hp: 80, alive: true, isPlayer: false }] };
for (const mode of ['floor_is_lava', 'obstacle_rush', 'duo_2v2']) for (const winner of ['player', 'ai']) {
  const html = renderToStaticMarkup(React.createElement(m.MatchResults, { stats: { ...stats, matchWinner: winner }, mode, playerName: 'Player', opponentName: 'Rival', mapName: 'Court', hasRoom: false, onRestart() {}, onModes() {}, onMenu() {} }));
  assert(html.includes('match-overlay--results') && html.includes('aria-modal="true"'));
  assert(html.includes(winner === 'player' ? 'Victory' : 'Defeat'));
  assert.equal((html.match(/<button/g) || []).length, 2);
  if (mode === 'floor_is_lava') for (const label of ['Nuke standings', 'Knockouts', 'Hits', 'Catches', 'Rounds / KOs']) assert(html.includes(label));
}

// Exercise all six preserved court themes and their real scenery geometry.
globalThis.document = { createElement: () => ({ width: 256, height: 256, getContext: () => new Proxy({ measureText: text => ({ width: String(text).length * 8 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get: (target, key) => key in target ? target[key] : () => {} }) }) };
for (const theme of m.COURT_THEMES.slice(0, 6)) {
  const world = m.createSceneryProps(theme, 1);
  assert(world.sceneryGroup.getObjectByName('Court sideline details'));
  assert(world.sceneryGroup.children.some(child => child.name === 'Batched static scenery'));
  for (const object of [...world.clouds, ...world.spinningProps, ...world.waveRings, ...world.waterfallFoams]) assert(object.parent, 'Animated scenery survives static batching');
  world.sceneryGroup.traverse(object => {
    if (!object.isMesh) return;
    for (const value of object.geometry.attributes.position.array) assert(Number.isFinite(value));
    object.geometry.dispose();
  });
}
console.log('PASS: capped healing, one-use pickups, delayed kit spawns, distinct respawn spots, two-second shield, victory/defeat results for all modes, six court themes and preserved animated scenery.');
