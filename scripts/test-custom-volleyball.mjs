import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import * as THREE from 'three';
buildSync({ stdin: { contents: `export * from './src/network/volleyballSync'; export * from './src/three/volleyballCamera'; export * from './src/three/volleyballLighting';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/custom-volleyball-test.mjs' });
const m = await import('../.npm-cache/custom-volleyball-test.mjs');
for (const latency of [20, 65, 120, 180]) {
  let now = 1000; const outgoingA = [], outgoingB = [];
  const timingA = m.createVolleyTiming('A', (kind, payload) => outgoingA.push({ kind, payload }), () => now);
  const timingB = m.createVolleyTiming('B', (kind, payload) => outgoingB.push({ kind, payload }), () => now);
  timingA.update(); now += latency;
  timingB.receive('A', outgoingA[0].kind, outgoingA[0].payload); now += latency;
  timingA.receive('B', outgoingB[0].kind, outgoingB[0].payload);
  assert(Math.abs(timingA.delay('B') - latency / 1000) < 1e-9, 'Delay estimate uses echoed monotonic time');
  now += 400; timingA.receive('B', outgoingB[0].kind, outgoingB[0].payload);
  assert(Math.abs(timingA.delay('B') - latency / 1000) < 1e-9, 'Duplicate pong cannot inflate latency');
  const guest = m.createVolleyHitSync(), host = m.createVolleyHitSync();
  const id = guest.issue('A', 1000);
  assert(!guest.canApply({}, 1000 + latency), 'A pre-hit host snapshot cannot cancel an immediate local shot');
  assert(host.receive('A', id, 1000 + latency));
  assert(guest.canApply(host.capture(), 1000 + latency * 2), 'Acknowledged shot accepts host authority');
  const newer = guest.issue('A', 1400);
  assert(!guest.canApply(host.capture(), 1450), 'Reordered acknowledgement cannot undo a newer shot');
  assert(host.receive('A', newer, 1450)); assert(!host.receive('A', id, 1470));
  assert(guest.canApply({}, 2300), 'Missing acknowledgements eventually reconcile');
  assert(guest.canApply({}, 1450, true), 'Authoritative points immediately end prediction');
  const state = { bx: .2, by: 3, bz: 4, bvx: 2, bvy: 2, bvz: -4 };
  const prediction = m.predictVolleyBall(state, timingA.delay('B'), -14, .42), t = latency / 1000;
  assert(Math.abs(prediction.bz - (state.bz + state.bvz * t)) < 1e-8);
  assert(Math.abs(prediction.by - (state.by + state.bvy * t - 7 * t * t)) < 1e-8);
}
const netShot = m.predictVolleyBall({ bx: 0, by: 1.8, bz: .7, bvx: 0, bvy: 0, bvz: -20 }, .18, 0, .42);
assert(netShot.bz > 0 && netShot.bvz > 0, 'Network projection cannot tunnel through the net');
const stopped = m.predictVolleyPlayer({ x: 0, y: 0, z: 3 }, { x: 0, z: 0 }, .1);
assert.equal(stopped.x, 0);
const limited = m.predictVolleyPlayer({ x: 0, y: 0, z: 3 }, { x: 8, z: 0 }, 20);
assert(limited.x < 1, 'Lost packets cannot let players run across the court');
for (const aspect of [1.3, 1.6, 2.2, 2.8]) for (const x of [-3.5, 0, 3.5]) for (const z of [.85, 3.5, 6.6]) {
  const frame = m.volleyballFollowCamera(x, z, -x, 0);
  const camera = new THREE.PerspectiveCamera(45, aspect, .1, 120);
  camera.position.copy(frame.position); camera.lookAt(new THREE.Vector3().copy(frame.look)); camera.updateMatrixWorld(true);
  for (const y of [0, 2.3]) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    assert(Math.abs(point.x) < .9 && Math.abs(point.y) < .94, `Controlled player fits at ${aspect}, ${x}, ${z}, ${y}`);
  }
}
const left = m.volleyballFollowCamera(-3, 2, 0, 0), right = m.volleyballFollowCamera(3, 2, 0, 0);
assert(right.position.x - left.position.x > 4 && right.look.x - left.look.x > 3, 'Camera position and aim both track the controlled player');
for (const theme of ['glacier_fort', 'sky_island', 'toy_park', 'pirate_cove']) assert.equal(m.volleyballLighting(theme).exposure, .94);
console.log('PASS: custom shot prediction/acknowledgement, reordered packets, 20–180ms one-way latency compensation, net safety, bounded remote motion, player-follow framing and original lighting.');
