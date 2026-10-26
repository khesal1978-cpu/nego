import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import * as THREE from 'three';
import { installTestCharacterAssets } from './imported-character-test-assets.mjs';
buildSync({ stdin: { contents: `export * from './src/three/crayonModels'; export * from './src/types/game'; export * from './src/three/framePacing'; export * from './src/three/postProcessing';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/low-end-test.mjs' });
const m = await import('../.npm-cache/low-end-test.mjs');
installTestCharacterAssets(m);
globalThis.document = { createElement: () => ({ width: 256, height: 256, getContext: () => new Proxy({
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
}, { get: (target, key) => key in target ? target[key] : () => {} }) }) };
function measure(root) {
  let triangles = 0, bytes = 0, expandedBytes = 0, outlines = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry, vertices = geometry.index?.count ?? geometry.attributes.position.count;
    triangles += vertices / 3;
    for (const a of Object.values(geometry.attributes)) { bytes += a.array.byteLength; expandedBytes += vertices * a.itemSize * a.array.BYTES_PER_ELEMENT; }
    bytes += geometry.index?.array.byteLength ?? 0;
    if (object.material.side === THREE.BackSide) outlines++;
  });
  return { triangles, bytes, expandedBytes, outlines };
}
let previewTriangles = 0, matchTriangles = 0, bytes = 0, expandedBytes = 0;
for (const config of m.CRAYON_CHARACTERS) {
  const preview = m.createCrayonCharacter(config), match = m.createCrayonCharacter(config, 4, 1, true, 'match');
  const a = measure(preview.root), b = measure(match.root);
  assert(b.triangles < a.triangles * .85, `${config.id} has less match geometry`);
  assert(b.outlines > 0, 'Ink outlines remain visible');
  const sizeA = new THREE.Box3().setFromObject(preview.bodyGroup, true).getSize(new THREE.Vector3());
  const sizeB = new THREE.Box3().setFromObject(match.bodyGroup, true).getSize(new THREE.Vector3());
  assert(sizeA.distanceTo(sizeB) / sizeA.length() < .025, 'Character proportions remain within 2.5%');
  match.leftArm.rotation.x = .7; match.root.updateMatrixWorld(true);
  match.root.traverse(object => assert(object.matrixWorld.elements.every(Number.isFinite)));
  previewTriangles += a.triangles; matchTriangles += b.triangles; bytes += b.bytes; expandedBytes += b.expandedBytes;
}
assert(bytes < expandedBytes * .55, 'Indexed batching cuts vertex storage substantially');
console.log(`PASS: all ${m.CRAYON_CHARACTERS.length} characters preserve proportions/outlines; ${Math.round((1 - matchTriangles / previewTriangles) * 100)}% fewer match triangles; ${Math.round((1 - bytes / expandedBytes) * 100)}% less geometry storage than expanded vertices.`);

for (const hz of [30, 60, 90, 120, 144]) {
  const pace = m.createFramePacer(); let accepted = 0, last = null, elapsed = 0;
  for (let frame = 0; frame < hz * 10; frame++) {
    const now = frame * 1000 / hz;
    if (!pace(now, 60)) continue;
    accepted++; if (last !== null) elapsed += (now - last) / 1000; last = now;
  }
  assert(Math.abs(accepted - Math.min(hz, 60) * 10) <= 1, `${hz}Hz has correct frame pacing`);
  assert(elapsed > 9.95, 'Simulation time includes skipped display refreshes');
  assert(pace(20000, 60), 'Resume after a hidden-tab gap does not stall');
}
console.log('PASS: 30/60/90/120/144Hz touch pacing, full elapsed simulation time and resume.');

globalThis.window = { devicePixelRatio: 2 };
globalThis.matchMedia = () => ({ matches: true });
const draws = []; let ratio = 2, target = null;
const renderer = {
  extensions: { has: () => true }, capabilities: { maxSamples: 4 },
  shadowMap: {}, info: { autoReset: true, reset() {}, render: { calls: 0, triangles: 0 } },
  domElement: { width: 1600, height: 800 },
  getPixelRatio: () => ratio, setPixelRatio: value => { ratio = value; },
  getSize: v => v.set(800, 400), setSize() {}, getDrawingBufferSize: v => v.set(800 * ratio, 400 * ratio),
  getRenderTarget: () => target, setRenderTarget: value => { target = value; },
  clear() {}, render(scene) { draws.push({ scene, target }); },
};
const pipeline = m.createStylizedPostPipeline(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), 800, 400, { colorGrade: true, detail: true });
pipeline.render();
assert.equal(draws.length, 3, 'Mobile uses scene + combined output/grade + FXAA only');
assert(draws.filter(draw => draw.target).every(draw => draw.target.samples === 0), 'No multisampled offscreen buffers on mobile');
const finalMaterial = draws[1].scene.material;
assert.equal((finalMaterial.fragmentShader.match(/void main\(/g) || []).length, 1);
assert(finalMaterial.fragmentShader.includes('return displayColor;'));
assert.equal(finalMaterial.uniforms.sharpness.value, 0, 'No extra five-tap sharpening on mobile');
assert.equal(finalMaterial.uniforms.toneMappingExposure.value, 1.06);
assert.equal(ratio, 2, 'Optimization preserves sharp default resolution');
for (let frame = 0; frame < 10; frame++) {
  renderer.shadowMap.needsUpdate = false;
  pipeline.render();
  assert(renderer.shadowMap.needsUpdate, 'Each rendered pose refreshes shadows without a 15 FPS stale silhouette');
}
pipeline.dispose();
console.log('PASS: fused render graph, tone/exposure, single edge smoothing and sharp default framebuffer (renderer stub; not GPU timing).');

// Run the actual music worker in a separate JS thread, adapting only its browser
// message interface. No audio device or browser/GPU automation is involved.
buildSync({ entryPoints: ['src/audio/musicWorker.ts'], bundle: true, platform: 'node', format: 'esm', outfile: '.npm-cache/music-worker-test.mjs', banner: { js: `import { parentPort } from 'node:worker_threads'; globalThis.self = { postMessage: (value, options) => parentPort.postMessage(value, options.transfer) }; parentPort.on('message', data => self.onmessage({ data }));` } });
const worker = new Worker(new URL('../.npm-cache/music-worker-test.mjs', import.meta.url));
try {
  const received = once(worker, 'message'); worker.postMessage('build');
  const [pcm] = await received;
  assert(pcm.left instanceof Float32Array && pcm.right instanceof Float32Array);
  assert(pcm.left.length > 400000 && pcm.left.length === pcm.right.length);
  let energy = 0; for (const value of pcm.left) { assert(Number.isFinite(value)); energy += value * value; }
  assert(energy > 1 && energy / pcm.left.length < .01, 'Worker returns the quiet original composition');
} finally { await worker.terminate(); }
console.log('PASS: actual worker synthesis transfers valid stereo PCM off the main thread.');
