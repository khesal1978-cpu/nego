import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import * as THREE from 'three';

fs.mkdirSync('.npm-cache', { recursive: true });
buildSync({ stdin: { contents: `export * from './src/components/nukeArena'; export * from './src/three/roundArenaGeometry'; export * from './src/three/fortArchitecture'; export { createFortRoofGeometry } from './src/three/gunFightEnvironment'; export * from './src/three/visualSettings';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/round-arena-test.mjs' });
const mod = await import('../.npm-cache/round-arena-test.mjs');
const near = (actual, expected, epsilon = 1e-6) => assert(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);

// Every wall normal must reflect outward velocity while retaining tangent speed.
for (let i = 0; i < 128; i++) {
  const angle = i * Math.PI * 2 / 128, nx = Math.cos(angle), nz = Math.sin(angle);
  const ball = { x: nx * 19, z: nz * 19, vx: nx * 20 - nz * 3, vz: nz * 20 + nx * 3 };
  assert(mod.bounceAtNukeBoundary(ball));
  near(Math.hypot(ball.x, ball.z), mod.NUKE_PLAY_RADIUS - .6);
  near(ball.vx * nx + ball.vz * nz, -20 * .78);
  near(-ball.vx * nz + ball.vz * nx, 3);
  const player = { x: nx * 40, z: nz * 40 };
  assert(mod.clampToNukeArena(player, .9));
  near(Math.hypot(player.x, player.z), mod.NUKE_PLAY_RADIUS - .9);
}
const inward = { x: 19, z: 0, vx: -5, vz: 4 };
mod.bounceAtNukeBoundary(inward); near(inward.vx, -5); near(inward.vz, 4);
const centre = { x: 0, z: 0 }; assert(!mod.clampToNukeArena(centre));
for (const count of [2, 3, 4, 5]) {
  const spawns = Array.from({ length: count }, (_, i) => mod.nukeSpawnPosition(i, count));
  for (let i = 0; i < count; i++) {
    near(Math.hypot(spawns[i].x, spawns[i].z), 9.2);
    near(Math.hypot(spawns[i].x - spawns[(i + 1) % count].x, spawns[i].z - spawns[(i + 1) % count].z), 18.4 * Math.sin(Math.PI / count));
  }
}
const floor = mod.createRoundNukeFloorGeometry();
const floorP = floor.attributes.position;
for (let i = 1; i < floorP.count; i++) near(Math.hypot(floorP.getX(i), floorP.getZ(i)), mod.NUKE_FLOOR_RADIUS, 2e-5);
floor.dispose();

function checkClosedRoof(geometry) {
  // Weld the UV seam by position and check every geometric edge is shared twice.
  const triangles = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const p = triangles.attributes.position, n = triangles.attributes.normal, edges = new Map();
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 100000)).join(',');
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    assert(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12, 'No degenerate roof triangles');
    for (let j = 0; j < 3; j++) {
      const edge = [key(i + j), key(i + (j + 1) % 3)].sort().join('|'); edges.set(edge, (edges.get(edge) || 0) + 1);
      assert(Number.isFinite(n.getY(i + j)));
    }
  }
  for (const count of edges.values()) assert.equal(count, 2, 'Roof must have a closed underside and no open seams');
  triangles.dispose(); geometry.dispose();
}
checkClosedRoof(mod.createFortRoofGeometry(2.5, 3));
checkClosedRoof(mod.createHipRoofGeometry(9, 6, 2.7));
const material = new THREE.MeshBasicMaterial();
const tower = mod.createFortTower(2.5, 7, 3, { wall: material, trim: material, dark: material, roof: material, accent: material });
const roof = tower.getObjectByName('Closed smooth tower roof');
assert(roof && roof.castShadow && !roof.receiveShadow);
assert(!roof.children.length, 'No inflated outline shell on the roof');
roof.geometry.computeBoundingBox();
near(roof.geometry.boundingBox.min.y + roof.position.y, roof.userData.roofBase);
tower.traverse(object => { if (object.isMesh) object.geometry.dispose(); }); material.dispose();
assert.equal(mod.SHARED_VISUAL_LOOK.bloom, .86);
assert.equal(mod.SHARED_VISUAL_LOOK.contrast, 1.29);
assert(mod.DEFAULT_VISUAL_SETTINGS.bloom < mod.SHARED_VISUAL_LOOK.bloom);
assert.equal(mod.DEFAULT_VISUAL_SETTINGS.sharpness, 0);
console.log('PASS: circular collision normals, ricochets, evenly spaced spawns, floor radius, watertight roofs and preserved shared preset.');
