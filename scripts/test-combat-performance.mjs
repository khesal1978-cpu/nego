import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import * as THREE from 'three';

buildSync({ stdin: { contents: `export * from './src/three/combatVisualPool'; export * from './src/three/motionTrail';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/combat-performance-test.mjs' });
const m = await import('../.npm-cache/combat-performance-test.mjs');
const pool = m.createCombatVisualPool(), scene = new THREE.Scene();
const first = pool.take('shotgun', '#facc15'), second = pool.take('shotgun', '#ffffff');
assert.notEqual(first, second, 'Live pellets never reuse the same transform');
assert.equal(first.children[0].geometry, second.children[0].geometry, 'Live pellets share immutable geometry');
assert.equal(first.children.length, 1, 'A pellet core and trail use one draw mesh');
assert(first.children[0].geometry.attributes.position.array.every(Number.isFinite), 'Merged pellet geometry is valid');
assert.notEqual(first.children[0].material, second.children[0].material, 'Tint/opacity changes cannot leak between shots');
let geometryDisposed = 0;
first.children[0].geometry.addEventListener('dispose', () => geometryDisposed++);
scene.add(first, second); assert(pool.release(first)); assert(!pool.release(first), 'Duplicate releases do not lease one mesh twice');
assert.equal(geometryDisposed, 0, 'Returning a pellet must not dispose another live pellet');
pool.release(second);
for (const shape of ['assault', 'shotgun', 'fire', 'ring', 'streak', 'shell', 'nuke-ring', 'nuke-big-ring']) {
  const visual = pool.take(shape, '#ff0000');
  visual.position.set(3,4,5); visual.rotation.set(1,2,3); visual.scale.setScalar(3);
  visual.traverse(child => { if (child.isMesh) child.material.opacity = .01; });
  pool.release(visual);
  const reused = pool.take(shape, '#00ff00');
  assert.equal(reused, visual); assert.equal(reused.position.length(), 0); assert.equal(reused.scale.x, 1);
  assert.equal(reused.rotation.x, 0); assert(reused.visible);
  reused.traverse(child => { if (child.isMesh) assert(child.material.opacity > .5, 'Reuse restores faded opacity'); });
  pool.release(reused);
}
const before = pool.stats;
for (let i = 0; i < 5000; i++) {
  const shape = ['assault','shotgun','fire','ring','streak','shell','nuke-ring','nuke-big-ring'][i%8];
  const visual = pool.take(shape, '#ffeaa3'); scene.add(visual); pool.release(visual);
}
assert.deepEqual(pool.stats, before, 'Five thousand subsequent effects allocate no new mesh/material/geometry resources');
const many = Array.from({ length: 120 }, () => pool.take('ring', '#fff'));
for (const visual of many) pool.release(visual);
const retained = pool.stats.retained;
assert(retained < 120, 'Spare impact cache has a bounded size');
const active = pool.take('assault', '#fff'); scene.add(active); pool.dispose();
assert.equal(scene.children.length, 0); assert.equal(geometryDisposed, 1); assert.equal(pool.stats.retained, 0);
console.log('PASS: live resource ownership, transform/tint/opacity reset, 5,000 effects with zero new GPU resources after reuse, bounded spare cache and complete cleanup.');

const gate = m.createImpactGate(); let accepted = 0;
for (let pellet = 0; pellet < 7; pellet++) accepted += Number(gate(pellet*.08, 1, 0, 1000));
assert.equal(accepted, 1, 'Nearby pellet impacts produce one burst');
assert(gate(4,1,0,1000), 'Separate impacts still show feedback');
assert(gate(0,1,0,1071), 'New impacts remain visible after the short grouping window');
let inFrame = 0; const wide = m.createImpactGate();
for (let i=0;i<100;i++) inFrame += Number(wide(i*2,0,0,1000));
assert.equal(inFrame, 24, 'Impact load cannot create an unbounded same-frame burst');

for (const count of [7, 10]) {
let reference;
for (const fps of [20,30,60,90,120,144]) {
  const trail = m.createMotionTrail(count); trail.reset(0,0,0);
  const pointRefs = [...trail.points];
  for (let frame=1;frame<=fps;frame++) trail.update(30*frame/fps,2,0,1/fps,true);
  const xs=trail.points.map(p=>p.x);
  reference ??= xs;
  xs.forEach((x,i)=>assert(Math.abs(x-reference[i])<1e-7, 'Trail duration does not grow on a slow display'));
  trail.points.forEach((p,i)=>assert.equal(p,pointRefs[i], 'Updates keep the existing point buffers'));
  trail.update(-20,1,0,1/fps,true); assert(trail.points.every(p=>p.x===-20), 'Teleports do not smear across the court');
  trail.update(3,1,0,1/fps,false); assert(trail.points.every(p=>p.x===3), 'A new serve clears old trails');
}
}
console.log('PASS: grouped seven-pellet feedback, bounded impact bursts and trail continuity/reset at 20–144 FPS (CPU/resource checks, not device GPU timing).');
