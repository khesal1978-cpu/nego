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
  const buffer = fs.readFileSync(`public${url.split('?')[0]}`);
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
  const skin = rig => { let mesh; rig.bodyGroup.traverse(o => { if (o.isSkinnedMesh && o.material.side !== THREE.BackSide) mesh ??= o; }); return mesh; };
  const previewSkin = skin(preview), matchSkin = skin(match);
  assert.equal(previewSkin.skeleton.bones.length, id === 'motu' ? 52 : 78, 'Original FBX skeleton remains intact');
  assert.equal(metadata.surfaces.length, id === 'motu' ? 1 : 2, 'Body is a continuous source surface');
  let blends = 0;
  for (let i = 0; i < previewSkin.geometry.attributes.skinWeight.count; i++) {
    const weights = previewSkin.geometry.attributes.skinWeight;
    assert(Math.abs([0,1,2,3].reduce((sum,c)=>sum+weights.getComponent(i,c),0)-1) < 1e-5);
    if (weights.getY(i) > .01) blends++;
  }
  assert(blends > 100, 'Skin retains blended influences around articulating joints');
  // Measure the actual deformed hands against the clothing silhouette. The
  // previous 90-degree resting pose buried them in the belly/kurta.
  const handBones = new Set(), torsoBones = new Set();
  previewSkin.skeleton.bones.forEach((bone, index) => {
    if (/Hand$|wrist_bn$/.test(bone.name)) bone.traverse(child => handBones.add(previewSkin.skeleton.bones.indexOf(child)));
    if (/Spine|Hips|^hip_bn$|^spine_bn$|^chest_bn$/.test(bone.name)) torsoBones.add(index);
  });
  const attributes = previewSkin.geometry.attributes;
  const influencedBy = (vertex, bones) => [0,1,2,3].reduce((sum, component) => sum +
    (bones.has(attributes.skinIndex.getComponent(vertex, component)) ? attributes.skinWeight.getComponent(vertex, component) : 0), 0) > .5;
  for (const pose of [{ leftX: 0, rightX: 0, leftZ: 0, rightZ: 0 }, m.mainMenuIdlePose(0), m.menuEmotePose(0)]) {
    preview.leftArm.rotation.set(pose.leftX, 0, pose.leftZ);
    preview.rightArm.rotation.set(pose.rightX, 0, pose.rightZ);
    preview.root.updateMatrixWorld(true);
    const hands = [[], []], torso = [];
    for (let vertex = 0; vertex < attributes.position.count; vertex++) {
      const point = previewSkin.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(previewSkin.matrixWorld);
      if (influencedBy(vertex, handBones)) hands[point.x < 0 ? 0 : 1].push(point);
      if (influencedBy(vertex, torsoBones)) torso.push(point);
    }
    for (const hand of hands) {
      assert(hand.length > 100, 'Measure each complete weighted hand');
      const handBounds = new THREE.Box3().setFromPoints(hand);
      const clothingEdge = Math.max(...torso.filter(point => point.y >= handBounds.min.y - .08 && point.y <= handBounds.max.y + .08).map(point => Math.abs(point.x)));
      assert(Number.isFinite(clothingEdge));
      assert(Math.min(...hand.map(point => Math.abs(point.x))) > clothingEdge + .01, `${id}: standing hands clear the clothing, including the inward menu tilt`);
    }
  }
  preview.leftArm.rotation.set(0, 0, 0); preview.rightArm.rotation.set(0, 0, 0); preview.root.updateMatrixWorld(true);
  const deformedBefore = Array.from({length: previewSkin.geometry.attributes.position.count},(_,i)=>previewSkin.getVertexPosition(i,new THREE.Vector3()).toArray());
  preview.rightArm.rotation.x = -.8; preview.root.updateMatrixWorld(true);
  const moved = deformedBefore.filter((p,i)=>new THREE.Vector3().fromArray(p).distanceTo(previewSkin.getVertexPosition(i,new THREE.Vector3())) > .001).length;
  assert(moved > 100, 'Control moves the actual weighted skin, including joint transitions');
  preview.rightArm.rotation.x = 0; preview.root.updateMatrixWorld(true);
  const count = rig => { let n = 0; rig.bodyGroup.traverse(o => { if (o.isMesh) n += o.geometry.index.count / 3; }); return n; };
  assert(count(match) < count(preview) * .85, 'Match geometry is lighter than full preview');
  const sourcePosition = previewSkin.geometry.attributes.position.array.slice();
  const scene = new THREE.Scene(); scene.add(match.root);
  const ragdolls = m.createCharacterRagdolls(scene, () => 0); ragdolls.spawn(match, 4, 2);
  const doll = scene.children.at(-1), dollSkin = skin({bodyGroup:doll});
  assert.notEqual(dollSkin.skeleton, matchSkin.skeleton, 'Death pose owns an independent skeleton');
  assert.notEqual(dollSkin.skeleton.bones[0], matchSkin.skeleton.bones[0]);
  for (let frame = 0; frame < 120; frame++) {
    m.animateMainMenuIdle(preview, frame / 60, 1 / 60, false, 0);
    match.rightArm.rotation.x = -2.2; match.leftFoot.rotation.x = Math.sin(frame / 10) * .4;
    match.root.position.y = 1; m.updateCharacterGroundShadow(match.root, match.shadowMesh);
    match.root.updateMatrixWorld(true); ragdolls.update(1 / 60);
    match.root.traverse(o => assert(o.matrixWorld.elements.every(Number.isFinite)));
  }
  ragdolls.dispose(); m.disposeSceneGeometry(scene);
  assert.deepEqual(previewSkin.geometry.attributes.position.array, sourcePosition, 'Other rigs keep their original geometry after scene disposal');
  const image = renderToStaticMarkup(React.createElement(m.CharacterPortrait, { char: config }));
  assert(image.includes(`${id}-portrait.png`));
  const studio = renderToStaticMarkup(React.createElement(m.CharacterStudio, { character: config, selectedCharacter: id, outfit: config.defaultOutfit, face: config.defaultFace, head: config.headShape, portrait: c => React.createElement(m.CharacterPortrait, { char: c }), outfitPreview: () => null }));
  assert(studio.includes('Original clothing') && studio.includes('Original expression'));
  assert.equal((studio.match(/role="tab"/g) || []).length, 1, 'Fixed appearance exposes only the character picker');
  console.log(`PASS: ${id} continuous skin, standing hand clearance, 1.9-height/floor placement, independent animation/disposal, room/saved selection, portraits and fixed-appearance UI (${Math.round((1 - count(match) / count(preview)) * 100)}% fewer match triangles).`);
}
console.log('PASS: asset failure/retry, concurrent preload deduplication and decoded texture caching.');
