import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSync } from 'esbuild';
import * as THREE from 'three';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { installTestCharacterAssets } from './imported-character-test-assets.mjs';

fs.mkdirSync('.npm-cache', { recursive: true });
buildSync({ stdin: { contents: `export * from './src/three/crayonModels'; export * from './src/three/importedCharacters'; export * from './src/three/scenePerformance'; export * from './src/three/characterRagdoll'; export * from './src/three/menuEmotes'; export * from './src/types/game'; export * from './src/playerPreferences'; export * from './src/network/customCharacters'; export * from './src/components/CharacterPortrait'; export * from './src/components/CharacterStudio';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/imported-characters-test.mjs' });
const m = await import('../.npm-cache/imported-characters-test.mjs');
let requests = 0;
globalThis.fetch = async () => ({ ok: false, status: 503 });
await assert.rejects(m.preloadImportedCharacters(), /Could not load/);
globalThis.fetch = async url => {
  requests++;
  const buffer = fs.readFileSync(`public${url}`);
  return { ok: true, json: async () => JSON.parse(buffer), arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), blob: async () => new Blob([buffer]) };
};
globalThis.createImageBitmap = async () => ({ width: 1024, height: 1024 });
await Promise.all([m.preloadImportedCharacters(), m.preloadImportedCharacters()]);
assert.equal(requests, 7, 'Two geometry/metadata pairs and three textures load only once');
await m.preloadImportedCharacters(); assert.equal(requests, 7);
installTestCharacterAssets(m);
globalThis.document = { createElement: () => ({ width: 256, height: 256, getContext: () => new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => t[k] || (() => {}) }) }) };

for (const id of ['motu', 'patlu']) {
  const config = m.CRAYON_CHARACTERS.find(c => c.id === id);
  assert(config?.modelAsset === id);
  assert.equal(m.normalizePlayerPreferences({ selectedCharId: id }).selectedCharId, id, 'Saved character selection survives reload');
  const networkConfig = m.customCharacter({ charId: id, outfitId: 'cat_hoodie', faceId: 'shock_rally' }, m.CRAYON_CHARACTERS[0]);
  assert.equal(networkConfig.modelAsset, id, 'Room profile resolves to the imported model');
  const metadata = JSON.parse(fs.readFileSync(`public/characters/${id}.json`));
  assert.equal(metadata.attribution.license, 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)');
  const preview = m.createCrayonCharacter(config), match = m.createCrayonCharacter(networkConfig, 4, -1, true, 'match');
  const bounds = new THREE.Box3().setFromObject(preview.bodyGroup, true);
  assert(Math.abs(bounds.max.y - bounds.min.y - 1.9) < 1e-5);
  assert(Math.abs(bounds.min.y) < 1e-5, 'Feet start on the floor');
  const left = preview.leftArm.getWorldPosition(new THREE.Vector3()), right = preview.rightArm.getWorldPosition(new THREE.Vector3());
  assert(left.x < right.x, 'Arm ordering follows game controls');
  for (const name of ['headGroup', 'leftArm', 'rightArm', 'leftFoot', 'rightFoot']) assert(preview[name].children.length > 0, `${id} ${name} has actual source geometry`);
  const count = rig => { let n = 0; rig.bodyGroup.traverse(o => { if (o.isMesh) n += o.geometry.index.count / 3; }); return n; };
  assert(count(match) < count(preview) * .85, 'Match geometry is lighter than full preview');
  const sourcePosition = preview.headGroup.children[0].geometry.attributes.position.array.slice();
  const scene = new THREE.Scene(); scene.add(match.root);
  const ragdolls = m.createCharacterRagdolls(scene, () => 0); ragdolls.spawn(match, 4, 2);
  for (let frame = 0; frame < 120; frame++) {
    m.animateMainMenuIdle(preview, frame / 60, 1 / 60, false, 0);
    match.rightArm.rotation.x = -2.2; match.leftFoot.rotation.x = Math.sin(frame / 10) * .4;
    match.root.position.y = 1; m.updateCharacterGroundShadow(match.root, match.shadowMesh);
    match.root.updateMatrixWorld(true); ragdolls.update(1 / 60);
    match.root.traverse(o => assert(o.matrixWorld.elements.every(Number.isFinite)));
  }
  ragdolls.dispose(); m.disposeSceneGeometry(scene);
  assert.deepEqual(preview.headGroup.children[0].geometry.attributes.position.array, sourcePosition, 'Other rigs keep their original geometry after scene disposal');
  const image = renderToStaticMarkup(React.createElement(m.CharacterPortrait, { char: config }));
  assert(image.includes(`${id}-portrait.png`));
  const studio = renderToStaticMarkup(React.createElement(m.CharacterStudio, { character: config, selectedCharacter: id, outfit: config.defaultOutfit, face: config.defaultFace, head: config.headShape, portrait: c => React.createElement(m.CharacterPortrait, { char: c }), outfitPreview: () => null }));
  assert(studio.includes('Original clothing') && studio.includes('Original expression'));
  assert.equal((studio.match(/role="tab"/g) || []).length, 1, 'Fixed appearance exposes only the character picker');
  console.log(`PASS: ${id} source geometry, 1.9-height/floor placement, independent animation/disposal, room/saved selection, portraits and fixed-appearance UI (${Math.round((1 - count(match) / count(preview)) * 100)}% fewer match triangles).`);
}
console.log('PASS: asset failure/retry, concurrent preload deduplication and decoded texture caching.');
