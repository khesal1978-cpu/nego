import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import * as THREE from 'three';

buildSync({ stdin: { contents: `export * from './src/three/overheadHealth'; export * from './src/three/arenaPalette';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/head-health-test.mjs' });
const mod = await import('../.npm-cache/head-health-test.mjs');
assert(!mod.hitHealthVisible(200, 999), 'Hidden before the first hit');
assert(mod.hitHealthVisible(150, 0));
assert(mod.hitHealthVisible(150, 2.19));
assert(!mod.hitHealthVisible(150, 2.2), 'Hidden after the hit interval');
assert(!mod.hitHealthVisible(0, .5), 'Hidden on death');
assert(!mod.hitHealthVisible(150, .5, false), 'Hidden while eliminated or respawning');
const camera = new THREE.PerspectiveCamera(45, 1.7, .5, 200);
camera.position.set(5, 9, 12); camera.lookAt(0, 2, 0);
const parent = new THREE.Group(); parent.scale.setScalar(1.38);
const { background, fill } = mod.createOverheadHealthBar(parent);
assert(!background.visible && !fill.visible);
assert(background.position.y > 2, 'Above hats and head geometry');
for (const yaw of [0, .7, Math.PI / 2, Math.PI, -1.8]) {
  parent.rotation.y = yaw;
  for (const hp of [20, 65, 100]) {
    mod.updateOverheadHealth(background, fill, camera, hp, 100, true);
    const quaternion = background.getWorldQuaternion(new THREE.Quaternion());
    assert(Math.abs(quaternion.dot(camera.getWorldQuaternion(new THREE.Quaternion()))) > .99999, 'Billboard must cancel parent yaw');
    const left = fill.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-1.1 * hp / 100 * 1.38 / 2, 0, 0).applyQuaternion(quaternion));
    const expected = background.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(-1.1 * 1.38 / 2, 0, .008 * 1.38).applyQuaternion(quaternion));
    assert(left.distanceTo(expected) < 1e-6, 'Damage drains from the right without moving the left edge');
  }
}
assert(background.material.depthTest && fill.material.depthTest, 'Solid walls occlude overhead bars');
assert(!background.material.depthWrite && !fill.material.depthWrite, 'The bar must not modify scene depth');
mod.updateOverheadHealth(background, fill, camera, 50, 100, false);
assert(!background.visible && !fill.visible);
for (const mesh of [background, fill]) { mesh.geometry.dispose(); mesh.material.dispose(); }
const blue = mod.arenaPalette(false), green = mod.arenaPalette(true);
const blueHsl = new THREE.Color(blue.floor).getHSL({ h: 0, s: 0, l: 0 });
const greenHsl = new THREE.Color(green.floor).getHSL({ h: 0, s: 0, l: 0 });
assert(blueHsl.h > .5 && blueHsl.h < .65, 'First map has blue/cyan ground');
assert(greenHsl.h > .25 && greenHsl.h < .48, 'Second map has green ground');
assert.notEqual(blue.stone, green.stone);
assert.notEqual(blue.trim, green.trim);
console.log('PASS: hit-only health visibility, head clearance, rotation-independent billboards, fixed left edge, depth occlusion and separate blue/green map palettes.');
