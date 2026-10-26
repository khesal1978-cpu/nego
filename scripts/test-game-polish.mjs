import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSync } from 'esbuild';
import * as THREE from 'three';
import React from 'react';
import { installTestCharacterAssets } from './imported-character-test-assets.mjs';
import { renderToStaticMarkup } from 'react-dom/server';

fs.mkdirSync('.npm-cache', { recursive: true });
buildSync({ stdin: { contents: `export * from './src/three/combatFeedback'; export * from './src/three/characterRagdoll'; export * from './src/three/scenePerformance'; export * from './src/three/frameBudget'; export * from './src/three/menuEmotes'; export * from './src/three/characterPreviewFraming'; export * from './src/three/spawnShield'; export * from './src/three/crayonModels'; export * from './src/three/fortDetail'; export * from './src/components/nukeControls'; export * from './src/components/MatchPanels'; export * from './src/types/game';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/game-polish-tests.mjs' });
const m = await import('../.npm-cache/game-polish-tests.mjs');
installTestCharacterAssets(m);

for (const angle of [-2, -.4, 0, .4, 2]) {
  const aim = m.assistedNukeDirection(0, -1, Math.sin(Math.PI + angle), Math.cos(Math.PI + angle));
  assert(Math.abs(Math.hypot(aim.x, aim.z) - 1) < 1e-8);
  assert(Math.abs(Math.atan2(aim.x, -aim.z)) <= .090001, 'Aim assistance cannot snap to a distant target');
}
for (const fps of [30, 60, 120]) {
  let speed = 0;
  for (let frame = 0; frame < fps; frame++) speed += (8 - speed) * m.movementBlend(1 / fps, true, true);
  assert(Math.abs(speed - 8) < .00001, 'Movement response is independent of refresh rate');
}
const budget = m.createFrameBudget();
for (let i = 0; i < 3; i++) budget.sample(30);
assert.equal(budget.scale, 1, 'Shader warmup must not reduce quality');
for (let i = 0; i < 4; i++) budget.sample(30);
assert(budget.scale < 1);
const reduced = budget.scale;
for (let i = 0; i < 7; i++) budget.sample(60);
assert.equal(budget.scale, reduced, 'Quality must not oscillate every second');
budget.sample(60); assert(budget.scale > reduced);
for (let i = 0; i < 100; i++) budget.sample(20);
assert.equal(budget.scale, .85, 'Sustained low FPS preserves the higher clarity floor');

const scene = new THREE.Scene();
const blood = m.createBloodFeedback(scene);
const pool = scene.getObjectByName('Pooled blood hit feedback');
const geometry = pool.geometry;
for (let i = 0; i < 100; i++) { blood.hit(0, 1, 0, 0, 1, 0, 1.5); blood.update(1 / 60); }
assert.equal(pool.count, 144); assert.equal(pool.geometry, geometry);
const hitColor = new THREE.Color();
pool.getColorAt(0, hitColor);
assert(pool.visible && hitColor.r > hitColor.g, 'Crimson hit feedback must remain red through instance colours');
for (const value of pool.instanceMatrix.array) assert(Number.isFinite(value));
for (let i = 0; i < 70; i++) blood.update(1 / 60);
assert(!pool.visible, 'Expired feedback must leave no permanent geometry');
blood.dispose(); assert.equal(scene.children.length, 0);

// Confirm static batching preserves world bounds, shadows and animated objects.
const root = new THREE.Group(); root.position.set(3, 1, 2); root.rotation.y = .4;
const material = new THREE.MeshBasicMaterial();
for (let i = 0; i < 6; i++) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), material);
  mesh.position.set(i * 2, 1, 0); mesh.castShadow = true; root.add(mesh);
}
const animated = new THREE.Mesh(new THREE.BoxGeometry(), material); animated.position.set(-3, 2, 1); root.add(animated);
root.updateMatrixWorld(true);
const before = new THREE.Box3().setFromObject(root);
const animatedBefore = animated.getWorldPosition(new THREE.Vector3());
m.batchStaticScenery(root, [animated]);
const after = new THREE.Box3().setFromObject(root);
assert(before.min.distanceTo(after.min) < 1e-5 && before.max.distanceTo(after.max) < 1e-5);
assert(animated.getWorldPosition(new THREE.Vector3()).distanceTo(animatedBefore) < 1e-6);
assert.equal(root.children.filter(child => child.isMesh).length, 2, 'Six static meshes should become one draw');
assert(root.children.find(child => child.name === 'Batched static scenery').castShadow);
const baked = root.children.find(child => child.name === 'Batched static scenery');
const bakedBefore = new THREE.Box3().setFromObject(baked);
let localRebuilds = 0;
const rebuild = baked.updateMatrix.bind(baked);
baked.updateMatrix = () => { localRebuilds++; rebuild(); };
root.position.x += 4;
new THREE.Box3().setFromObject(root);
const queriedBounds = new THREE.Box3().setFromObject(baked);
assert(Math.abs(queriedBounds.min.x - bakedBefore.min.x - 4) < 1e-5 && Math.abs(queriedBounds.max.x - bakedBefore.max.x - 4) < 1e-5,
  'Bounds follow changed parents before a render updates the scene');
animated.rotation.y += .3;
for (let i = 0; i < 120; i++) root.updateMatrixWorld(true);
assert.equal(localRebuilds, 0, 'Baked local transforms do no repeated frame work');
const movedBounds = new THREE.Box3().setFromObject(baked);
assert(movedBounds.min.x > before.min.x && animated.matrixAutoUpdate, 'Moving parents and animated parts still update normally');

// Fixed world scenery skips entire matrix traversals, while an excluded child
// and its ancestors remain live. A reusable root can still receive a new map.
const fixedRoot = new THREE.Group(); fixedRoot.position.set(4, 1, 2);
const fixedBranch = new THREE.Group(), liveBranch = new THREE.Group();
const fixedMesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
const liveMesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
fixedBranch.add(fixedMesh); liveBranch.add(liveMesh); fixedRoot.add(fixedBranch, liveBranch);
const fixedBounds = new THREE.Box3().setFromObject(fixedRoot);
m.freezeStaticWorldTransforms(fixedRoot, [liveMesh]);
const frozenBounds = new THREE.Box3().setFromObject(fixedRoot);
assert(fixedBounds.min.distanceTo(frozenBounds.min) < 1e-8 && fixedBounds.max.distanceTo(frozenBounds.max) < 1e-8);
let fixedVisits = 0;
const visitFixed = fixedMesh.updateMatrixWorld.bind(fixedMesh);
fixedMesh.updateMatrixWorld = force => { fixedVisits++; visitFixed(force); };
for (let i = 0; i < 120; i++) { liveBranch.position.y = i; liveMesh.position.x = i; fixedRoot.updateMatrixWorld(); }
assert.equal(fixedVisits, 0, 'Static descendants are never visited by per-frame matrix updates');
assert.equal(liveMesh.matrixWorld.elements[12], 123);
assert.equal(liveMesh.matrixWorld.elements[13], 120);
assert(fixedRoot.matrixAutoUpdate && liveBranch.matrixAutoUpdate && liveMesh.matrixAutoUpdate);
const replacement = new THREE.Mesh(new THREE.BoxGeometry(), material); replacement.position.z = 8;
fixedRoot.clear(); fixedRoot.add(replacement); m.freezeStaticWorldTransforms(fixedRoot);
fixedRoot.updateMatrixWorld(); assert.equal(replacement.matrixWorld.elements[14], 10);

for (const scale of [1, 1.38, 1.46]) for (const height of [.02, .3, 1, 2.5]) for (const floor of [.02, 3.02]) {
  const athlete = new THREE.Group(), shadow = new THREE.Mesh(new THREE.PlaneGeometry(), material);
  athlete.scale.setScalar(scale); athlete.position.set(2, floor + height, 3); athlete.rotation.y = .5; athlete.add(shadow);
  m.updateCharacterGroundShadow(athlete, shadow, floor);
  const position = shadow.getWorldPosition(new THREE.Vector3());
  assert(Math.abs(position.y - floor) < 1e-8, 'Scaled, jumping and smoothed characters keep a floor contact shadow');
  assert.equal(position.x, 2); assert.equal(position.z, 3);
}
console.log('PASS: static world traversal skipping, live descendants, map replacement and floor shadows with scaled/jumping characters.');

// Canvas drawing is mocked here to exercise real model geometry without a GPU.
// This does not validate how the textures or shaders look on screen.
globalThis.document = { createElement: () => ({ width: 256, height: 256, getContext: () => new Proxy({
  measureText: text => ({ width: String(text).length * 8 }),
  createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
}, { get: (target, key) => key in target ? target[key] : () => {} }) }) };
const rig = m.createCrayonCharacter(m.CRAYON_CHARACTERS[0]);
// Long-running emotes must stay anchored, and every pose must fit the preview camera.
const previewBounds = m.characterPreviewBounds(rig, true);
const previewCenter = previewBounds.getCenter(new THREE.Vector3());
const previewSize = previewBounds.getSize(new THREE.Vector3());
const baseline = -.73;
for (const fps of [30, 60, 120]) {
  for (let frame = 0; frame < fps * 96; frame++) {
    m.animateMenuEmote(rig, frame / fps, 1 / fps, false, baseline);
    assert(rig.root.position.y >= baseline && rig.root.position.y <= baseline + .056, 'Celebration cannot accumulate vertical drift');
  }
}
rig.root.position.set(0, 0, 0);
for (const aspect of [.35, .6, 1, 1.8, 3]) {
  const camera = new THREE.PerspectiveCamera(32, aspect, .1, 30);
  camera.position.set(0, 0, m.characterPreviewDistance(previewSize, aspect, 32));
  camera.updateMatrixWorld(true);
  for (let time = 0; time < 32; time += .25) {
    m.animateMenuEmote(rig, time, .1, false, 0);
    const bounds = new THREE.Box3().setFromObject(rig.bodyGroup);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new THREE.Vector3(x, y, z).sub(previewCenter).project(camera);
      assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `Full emote fits preview aspect ${aspect}`);
    }
  }
}
rig.root.position.set(0, 0, 0);
console.log('PASS: 96-second emotes at 30/60/120 FPS stay anchored; complete animation fits five preview aspect ratios.');
for (let time = 0; time < 36; time += .02) {
  const pose = m.mainMenuIdlePose(time);
  assert(Math.abs(pose.rightZ) < .1 && Math.abs(pose.leftZ) < .5, 'Menu hands stay near the body instead of spreading like wings');
  assert.equal(pose.bounce, 0, 'Menu stance stays planted');
}
const menuRig = m.createCrayonCharacter(m.CRAYON_CHARACTERS[0], 1, 1);
const idleSize = m.characterPreviewBounds(menuRig, true, 'menu').getSize(new THREE.Vector3());
const oldSize = m.characterPreviewBounds(menuRig, true).getSize(new THREE.Vector3());
assert(m.characterPreviewDistance(idleSize, .6, 32, 1.045) < m.characterPreviewDistance(oldSize, .6, 32) * .8, 'Relaxed menu framing visibly enlarges the hero');
m.disposeSceneGeometry(new THREE.Scene().add(menuRig.root));
for (const config of m.CRAYON_CHARACTERS) {
  const actor = m.createCrayonCharacter(config, 1, 1);
  const envelope = m.characterPreviewBounds(actor, true, 'menu');
  const center = envelope.getCenter(new THREE.Vector3()), size = envelope.getSize(new THREE.Vector3());
  for (const aspect of [.35, .6, 1, 1.8, 3]) {
    const camera = new THREE.PerspectiveCamera(32, aspect, .1, 30);
    camera.position.set(0, 0, m.characterPreviewDistance(size, aspect, 32, 1.045)); camera.updateMatrixWorld(true);
    for (let time = 0; time < 12; time += .3) {
      m.animateMainMenuIdle(actor, time, 1 / 30, false, 0);
      actor.bodyGroup.rotation.y = Math.sin(time * .45) * .12;
      const box = new THREE.Box3().setFromObject(actor.bodyGroup);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const screen = new THREE.Vector3(x, y, z).sub(center).project(camera);
        assert(Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1, `${config.id} menu idle remains uncropped at aspect ${aspect}`);
      }
      assert.equal(actor.root.position.y, 0);
    }
  }
  m.disposeSceneGeometry(new THREE.Scene().add(actor.root));
}
console.log('PASS: relaxed menu hands, larger hero framing and every outfit fits five aspect ratios through the greeting cycle.');
buildSync({ stdin: { contents: `export * from './src/components/LoadingCharacters3D'; export * from './src/components/LoadingScreen';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/loading-cast-test.mjs' });
const loading = await import('../.npm-cache/loading-cast-test.mjs');
const smokerConfig = m.CRAYON_CHARACTERS.find(character => character.id === 'smokey_jester');
assert(smokerConfig && smokerConfig.defaultFace === 'fierce_pro');
const smokerRig = m.createCrayonCharacter(smokerConfig, 1, 1);
assert(smokerRig.headGroup.getObjectByName('Mouth cigar'), 'Cigar follows the head through animation and ragdoll');
assert(smokerRig.headGroup.getObjectByName('Smokey spiky hair'));
assert(smokerRig.bodyGroup.getObjectByName('Midnight leather jacket'));
const smoke = smokerRig.headGroup.getObjectByName('Cigar drifting smoke');
assert(smoke && smoke.geometry.instanceCount === 10 && !smoke.material.depthWrite, 'Bounded transparent smoke uses a single instanced draw');
m.disposeSceneGeometry(new THREE.Scene().add(smokerRig.root));
const net = m.createVolleyballNet(m.COURT_THEMES[0]);
const edges = net.children.filter(child => child.name === 'Net tape contrast edge');
assert.equal(edges.length, 4, 'Both borders of both tapes remain visible on pale maps');
for (const edge of edges) assert(edge.geometry.parameters.height >= .015 && edge.geometry.parameters.height <= .025, 'Net outline is legible without becoming a thick bar');
buildSync({ stdin: { contents: `export * from './src/three/volleyballNetElasticity';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/net-visual-test.mjs' });
const elasticity = await import('../.npm-cache/net-visual-test.mjs');
const netVisual = elasticity.createElasticNetVisual(net);
const cachedSpring = elasticity.createNetSpring();
const sampleRest = new Float32Array([-3.6, 1.6, 0, 0, 1.6, 0, .7, 2.1, 0, 3.6, 1.6, 0]);
const sampleOffsets = new Float32Array(4);
for (const [x, y, velocity] of [[0, 1.5, -20], [.5, 2, 12], [-.5, 1.2, -14], [1, 1.8, 8]]) cachedSpring.impact(x, y, velocity);
for (let i = 0; i < 100; i++) {
  cachedSpring.update(.02); cachedSpring.sampleVertices(sampleRest, sampleOffsets);
  for (let vertex = 0; vertex < sampleOffsets.length; vertex++) assert(Math.abs(sampleOffsets[vertex] - cachedSpring.displacement(sampleRest[vertex * 3], sampleRest[vertex * 3 + 1])) < 1e-6, 'Cached spring matches direct displacement through impact expiry');
}
assert(sampleOffsets.every(value => value === 0));
// Exercise the actual court scenery, retaining every moving object and the
// deforming net while reducing static mesh draws. Geometry bounds stay fixed.
let sceneryBefore = 0, sceneryAfter = 0;
for (const theme of m.COURT_THEMES) {
  const world = new THREE.Group(), courtNet = m.createVolleyballNet(theme);
  const scenery = m.createSceneryProps(theme);
  world.add(courtNet, scenery.sceneryGroup);
  const moving = [...scenery.clouds, ...scenery.spinningProps, ...scenery.waveRings, ...scenery.waterfallFoams, ...courtNet.children.filter(child => child.userData.elasticNet)];
  const boundsBefore = new THREE.Box3().setFromObject(world);
  world.traverse(object => { if (object.isMesh) sceneryBefore++; });
  for (const cloud of scenery.clouds) m.batchStaticScenery(cloud, scenery.spinningProps);
  m.batchStaticScenery(world, moving); m.freezeStaticWorldTransforms(world, moving);
  const boundsAfter = new THREE.Box3().setFromObject(world);
  assert(boundsBefore.min.distanceTo(boundsAfter.min) < 1e-4 && boundsBefore.max.distanceTo(boundsAfter.max) < 1e-4, `${theme.id} batching retains scenery bounds`);
  world.traverse(object => { if (object.isMesh) sceneryAfter++; });
  for (const object of moving) {
    assert(object.parent && object.matrixAutoUpdate, 'Moving scenery and elastic net remain attached and animated');
    const initial = object.getWorldPosition(new THREE.Vector3()); object.position.x += .2;
    world.updateMatrixWorld();
    assert(object.getWorldPosition(new THREE.Vector3()).distanceTo(initial) > 1e-6, `${theme.id} animated child follows its rotated/scaled parent`);
    object.position.x -= .2;
  }
  m.disposeSceneGeometry(world);
}
assert(sceneryAfter < sceneryBefore, `Batching reduces real court mesh count: ${sceneryBefore} → ${sceneryAfter}`);
console.log(`PASS: all ${m.COURT_THEMES.length} courts retain bounds/animation; scenery meshes ${sceneryBefore} → ${sceneryAfter} (${Math.round((1 - sceneryAfter / sceneryBefore) * 100)}% fewer).`);
const cords = net.getObjectByName('Elastic net cords');
const rest = new Float32Array(cords.geometry.attributes.position.array);
netVisual.spring.impact(0, 1.6, -20); netVisual.update(.08);
assert(cords.geometry.attributes.position.array.some((value, i) => i % 3 === 2 && Math.abs(value - rest[i]) > .2), 'Ball impact visibly flexes the mesh rather than looking rigid');
netVisual.update(2);
assert.deepEqual(cords.geometry.attributes.position.array, rest, 'Net geometry returns exactly to its rest shape');
m.disposeSceneGeometry(new THREE.Scene().add(net));
const hero = loading.createLoadingGunHero('green_hoodie');
assert(hero.bodyGroup.getObjectByName('arena-assault'), 'Loading hero holds the actual game weapon');
const heroFrame = loading.loadingGunFraming(hero);
assert(heroFrame.min.y > .3, 'Gun close-up frames the upper body rather than shrinking the full character');
for (const aspect of [.5, .8, 1.2, 2.4]) {
  const size = heroFrame.getSize(new THREE.Vector3()), center = heroFrame.getCenter(new THREE.Vector3());
  const halfHeight = Math.max(size.y / 2, size.x / aspect / 2);
  const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .1, 30);
  camera.position.set(center.x, center.y, 9); camera.updateMatrixWorld(true);
  for (const yaw of [-.025, 0, .025]) {
    hero.bodyGroup.rotation.y = yaw;
    for (const part of [hero.headGroup, hero.bodyGroup.getObjectByName('arena-assault')]) {
      const box = new THREE.Box3().setFromObject(part);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const screen = new THREE.Vector3(x, y, z).project(camera);
        assert(Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1, `Loading face and gun fit aspect ${aspect}`);
      }
    }
  }
}
const heroWeapon = hero.bodyGroup.getObjectByName('arena-assault').children.find(child => child.isMesh);
let gunDisposed = false; heroWeapon.geometry.addEventListener('dispose', () => { gunDisposed = true; });
m.disposeSceneGeometry(new THREE.Scene().add(hero.root));
assert(gunDisposed, 'Scene changes dispose gun geometry along with the hero');
for (const design of loading.LOADING_SCENES) {
  const cast = loading.createLoadingCast(design.characters);
  assert.equal(cast.length, design.characters.length);
  for (const actor of cast) {
    const box = new THREE.Box3().setFromObject(actor.root);
    assert(Math.abs(box.max.y - m.CHARACTER_MODEL_HEIGHT) < 1e-5, '3D loading cast uses the normalized game models');
    assert.equal(actor.root.scale.x, 1, 'Loading designs preserve equal character scale');
    assert(actor.leftArm && actor.rightArm && actor.headGroup, 'Loading characters retain their animated game rig');
    m.disposeSceneGeometry(new THREE.Scene().add(actor.root));
  }
}
for (const character of m.CRAYON_CHARACTERS) {
  const characterRig = m.createCrayonCharacter(character);
  const bounds = new THREE.Box3().setFromObject(characterRig.root.getObjectByName('Uniform character size'));
  assert(Math.abs(bounds.min.y) < 1e-6, 'Every character stands on the same floor');
  assert(Math.abs(bounds.max.y - m.CHARACTER_MODEL_HEIGHT) < 1e-6, `${character.name} must have the shared standing height`);
  m.disposeSceneGeometry(new THREE.Scene().add(characterRig.root));
}
rig.root.scale.setScalar(1.38); rig.root.position.set(0, .02, 0); scene.add(rig.root);
const originalArm = rig.leftArm.quaternion.clone();
let meshes = 0; rig.root.traverse(object => { if (object.isMesh) meshes++; });
const ragdolls = m.createCharacterRagdolls(scene, () => 0);
ragdolls.spawn(rig, 6, -3);
const liveSize = new THREE.Box3().setFromObject(rig.bodyGroup).getSize(new THREE.Vector3());
const dollSize = new THREE.Box3().setFromObject(scene.children.at(-1)).getSize(new THREE.Vector3());
assert(liveSize.distanceTo(dollSize) < 1e-5, 'Ragdoll retains the live normalized character scale at spawn');
for (let i = 0; i < 60; i++) ragdolls.update(1 / 60);
assert.equal(ragdolls.count, 1);
assert(rig.leftArm.quaternion.equals(originalArm), 'Ragdoll copies cannot change the living rig');
scene.traverse(object => {
  for (const value of [...object.position, ...object.scale, ...object.quaternion]) assert(Number.isFinite(value));
});
for (let i = 0; i < 6; i++) ragdolls.spawn(rig, 2, 1);
assert.equal(ragdolls.count, 3, 'Ragdolls have a fixed population budget');
for (let i = 0; i < 120; i++) ragdolls.update(1 / 60);
assert.equal(ragdolls.count, 0);
ragdolls.dispose();

const shield = m.createSpawnShield();
m.updateSpawnShield(shield, 1); assert(shield.visible);
const opacity = shield.children[0].material.uniforms.opacity.value;
m.updateSpawnShield(shield, .1); assert(shield.children[0].material.uniforms.opacity.value < opacity);
m.updateSpawnShield(shield, 0); assert(!shield.visible);
assert.equal(shield.children.length, 2, 'Shield uses only its clear shell and base ring');
const gate = m.createFortGate(material, material, material, material);
const gateBounds = new THREE.Box3().setFromObject(gate);
assert(gateBounds.max.y < 4.5 && gateBounds.min.y > -.1);
gate.traverse(object => { if (object.isMesh) for (const value of object.geometry.attributes.position.array) assert(Number.isFinite(value)); });

const standings = [{ id: 'bot', name: 'Bjorn', kills: 15, deaths: 3, isPlayer: false }, { id: 'you', name: 'Player', kills: 5, deaths: 8, isPlayer: true }];
const html = renderToStaticMarkup(React.createElement(m.MatchResults, { stats: { playerScore: 0, aiScore: 1, matchWinner: 'ai', arenaStandings: standings, raceTimeSec: 180 }, mode: 'obstacle_rush', playerName: 'Player', opponentName: 'Bjorn', mapName: 'Grand Fort', hasRoom: false, onRestart() {}, onModes() {}, onMenu() {} }));
assert(html.includes('result-score">5<'), 'Headline uses final standings, never the old win/loss flag');
assert.equal((html.match(/<button/g) || []).length, 2);
const roomResults = renderToStaticMarkup(React.createElement(m.MatchResults, { stats: { playerScore: 5, aiScore: 2, matchWinner: 'player' }, mode: 'duo_2v2', playerName: 'Player', opponentName: 'Rival', roomCode: 'ABC123', onRestart() {}, onMenu() {} }));
assert(roomResults.includes('Back to room') && roomResults.includes('Leave room') && roomResults.includes('ABC123'));
assert(!roomResults.includes('Main menu'), 'Custom results keep the room as the primary destination');
assert(!html.includes('Grand Fort') && !html.includes('result-map-preview'), 'No map section on results');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(!app.includes('VisualTuner') && !app.includes('setVisualTuningOpen'));
console.log('PASS: bounded aim assistance, refresh-independent movement, adaptive frame budget, pooled blood, geometry batching, real character rig/ragdoll lifecycle, shield, gate and consistent final scores. Character meshes after batching: ' + meshes);
