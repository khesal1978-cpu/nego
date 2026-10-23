import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
buildSync({ stdin: { contents: `export * from './src/components/MatchPanels'; export * from './src/components/GunFightHud'; export * from './src/three/gunFightEnvironment'; export * from './src/three/arenaProps';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: '.npm-cache/visual-regression.cjs', packages: 'external', loader: { '.css': 'empty' } });
const components = require('../.npm-cache/visual-regression.cjs');
const noOp = () => {};
const standings = [
  { id: 'me', name: 'Player', kills: 3, deaths: 6, isPlayer: true },
  { id: 'rival', name: 'Bjorn', kills: 27, deaths: 17, isPlayer: false },
  { id: 'rival2', name: 'Maya', kills: 17, deaths: 18, isPlayer: false },
];
for (const winner of ['player', 'ai']) {
  const list = winner === 'player' ? standings.map(item => item.isPlayer ? { ...item, kills: 30 } : item) : standings;
  const html = renderToStaticMarkup(React.createElement(components.MatchResults, { stats: { playerScore: winner === 'player' ? 30 : 3, aiScore: 27, matchWinner: winner, raceTimeSec: 180, arenaStandings: list }, mode: 'obstacle_rush', playerName: 'Player', opponentName: 'Bjorn', mapName: 'Grand Fort', hasRoom: true, onRestart: noOp, onModes: noOp, onMenu: noOp }));
  assert(html.includes(winner === 'player' ? 'Victory' : 'Defeat'));
  assert(html.includes(winner === 'player' ? 'Rank #1' : 'Rank #3'));
  assert.equal((html.match(/<button/g) || []).length, 2, 'Results only offer replay and main menu');
  assert(!html.includes('Modes &amp; maps') && !html.includes('Room lobby'));
  assert.equal((html.match(/<li /g) || []).length, 3, 'Every participant has an accurate result card');
}
assert.equal(components.GunFightHud, undefined, 'No bottom health or jump controls');
const timer = renderToStaticMarkup(React.createElement(components.GunFightScore, { hud: { timeRemainingSec: 154, playerKills: 3 } }));
assert(timer.includes('02:34'));
assert(!timer.includes('<button'));
for (const [radius, height] of [[1.4, 1.9], [2.5, 3.8]]) {
  const roof = components.createFortRoofGeometry(radius, height);
  roof.computeBoundingBox();
  assert(Math.abs(roof.boundingBox.min.y + height / 2) < 1e-6);
  assert(Math.abs(roof.boundingBox.max.y - height / 2) < 1e-6);
  for (const value of roof.attributes.normal.array) assert(Number.isFinite(value));
  roof.dispose();
}
const hills = components.createFortHills(new THREE.MeshBasicMaterial());
const positions = hills.geometry.attributes.position;
for (let index = 0; index < positions.count; index++) {
  const x = positions.getX(index), z = positions.getZ(index);
  if (Math.abs(x) < 22 && z > -18 && z < 20) assert(positions.getY(index) < 0, 'Outer hills must not intrude into the playing floor');
}
for (const type of ['assault', 'shotgun', 'fire']) {
  const model = components.createArenaWeapon(type); model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  assert(box.min.z > -.4 && box.max.z < .8);
}
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const gun = read('src/components/ObstacleRushCanvas.tsx');
const gunFloor = gun.slice(gun.indexOf('    const courtBaseSlab ='), gun.indexOf('    // 4 Courtyard Trees'));
assert(gunFloor.includes('new THREE.BoxGeometry(53.6, 0.38, 37.6)'));
assert(gunFloor.includes('new THREE.PlaneGeometry(51.6, 35.6)'));
assert(gunFloor.includes('courtBaseSlab.position.set(0, -0.25, 2.0)'));
assert(gunFloor.includes('courtPlane.position.set(0, 0.018, 2.0)'), 'Floor remains above the foundation without Z-fighting');
assert(gunFloor.includes('createCourtFloorTexture(') && gunFloor.includes('palette.floorLine'), 'Preserve the existing painted court and line art');
const nuke = read('src/components/FloorIsLavaCanvas.tsx');
assert(nuke.includes('const courtDeckTex = createCourtFloorTexture('), 'Round Nuke still uses the existing painted ground source');
assert(nuke.includes('createRoundNukeFloorGeometry()'), 'Nuke has the requested circular ground');
assert(nuke.includes('ref={crosshairRef}'), 'Nuke has the requested precise reticle');
console.log('PASS: accurate results and two actions, no bottom gun controls, roof normals, model clearance, unchanged Gun floor and round Nuke using the existing floor art.');
