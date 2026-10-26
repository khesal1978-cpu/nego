import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

// Preserve complete surfaces and the FBX skeleton. Never cut triangles into limbs.
const source = process.argv[2] || 'D:/Downloads', output = 'public/characters';
fs.mkdirSync(output, { recursive: true });
globalThis.window = { URL };
const manager = new THREE.LoadingManager();
manager.addHandler(/.*/, { load: () => new THREE.Texture(), setPath() { return this; } });
await MeshoptSimplifier.ready;
function compactSurface(geometry, indices) {
  const vertices = [...new Set(indices)], remap = new Map(vertices.map((vertex, index) => [vertex, index]));
  const result = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const values = new Float32Array(vertices.length * attribute.itemSize);
    vertices.forEach((vertex, index) => {
      for (let component = 0; component < attribute.itemSize; component++) values[index * attribute.itemSize + component] = attribute.getComponent(vertex, component);
    });
    result.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  result.setIndex(new THREE.BufferAttribute(Uint32Array.from(indices, vertex => remap.get(vertex)), 1));
  // Smooth the reduced surface across coincident UV seams for rounded toon
  // shading. Opposing faces stay separate instead of cancelling their normals.
  result.computeVertexNormals();
  const { position, normal } = result.attributes, buckets = new Map();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const key = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)].map(value => Math.round(value * 1e6)).join(',');
    const bucket = buckets.get(key) || []; bucket.push(vertex); buckets.set(key, bucket);
  }
  const average = new THREE.Vector3(), current = new THREE.Vector3();
  for (const vertices of buckets.values()) {
    average.set(0, 0, 0);
    for (const vertex of vertices) average.add(current.fromBufferAttribute(normal, vertex));
    average.normalize();
    for (const vertex of vertices) {
      if (current.fromBufferAttribute(normal, vertex).dot(average) > .5) normal.setXYZ(vertex, average.x, average.y, average.z);
    }
  }
  return result;
}
for (const [id, file, diffuse] of [['motu', 'Motu.fbx', 'motu/Motu_diff.png'], ['patlu', 'motu-patlu/source/Patlu_global_ctrl.fbx', 'motu-patlu/textures/Patlu_diff.png']]) {
  const old = JSON.parse(fs.readFileSync(path.join(output, `${id}.json`))), buffer = fs.readFileSync(path.join(source, file));
  const scene = new FBXLoader(manager).parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  if (id === 'patlu') scene.rotation.x += Math.PI / 2;
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene, true), scale = 1.4 / (bounds.max.y - bounds.min.y);
  const normalize = new THREE.Matrix4().makeScale(scale, scale, scale).setPosition(0, -bounds.min.y * scale, 0);
  const meshes = []; scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  if (meshes.length !== 1) throw new Error(`${id}: expected one complete skinned mesh`);
  const mesh = meshes[0]; mesh.normalizeSkinWeights(); mesh.skeleton.update();
  const sourceBones = mesh.skeleton.bones;
  const worlds = sourceBones.map(bone => {
    const matrix = new THREE.Matrix4().multiplyMatrices(normalize, bone.matrixWorld), p = new THREE.Vector3(), q = new THREE.Quaternion();
    matrix.decompose(p, q, new THREE.Vector3());
    return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
  });
  const bones = sourceBones.map((bone, i) => {
    let parent = bone.parent; while (parent && !sourceBones.includes(parent)) parent = parent.parent;
    const parentIndex = sourceBones.indexOf(parent), local = parentIndex < 0 ? worlds[i] : new THREE.Matrix4().multiplyMatrices(worlds[parentIndex].clone().invert(), worlds[i]);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); local.decompose(p, q, s);
    return { name: bone.name, parent: parentIndex, position: p.toArray(), quaternion: q.toArray(), scale: s.toArray() };
  });
  // Leave room for the hands beside the belly/kurta, including the menu's
  // small inward idle tilt. A full 90-degree drop puts them inside the clothes.
  const restingArmAngle = THREE.MathUtils.degToRad(id === 'motu' ? 68 : 75);
  const drivers = {}, mapping = id === 'motu' ? { head: 'mixamorigHead', leftArm: 'mixamorigRightArm', rightArm: 'mixamorigLeftArm', leftFoot: 'mixamorigRightUpLeg', rightFoot: 'mixamorigLeftUpLeg' } : { head: 'head_bn', leftArm: 'r_arm_bn', rightArm: 'l_arm_bn', leftFoot: 'r_thigh_bn', rightFoot: 'l_thigh_bn' };
  for (const [name, boneName] of Object.entries(mapping)) {
    const index = bones.findIndex(b => b.name === boneName); if (index < 0) throw new Error(`${id}: missing ${boneName}`);
    const parent = bones[index].parent < 0 ? new THREE.Matrix4() : worlds[bones[index].parent];
    drivers[name] = { bone: index, pivot: new THREE.Vector3().setFromMatrixPosition(worlds[index]).toArray(), parentQuaternion: new THREE.Quaternion().setFromRotationMatrix(parent).toArray(), worldQuaternion: new THREE.Quaternion().setFromRotationMatrix(worlds[index]).toArray(), restZ: name.endsWith('Arm') ? (name === 'leftArm' ? 1 : -1) * restingArmAngle : 0 };
  }
  const geometry = mesh.geometry.clone(), position = geometry.attributes.position;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().multiplyMatrices(normalize, mesh.matrixWorld));
  for (let i = 0; i < position.count; i++) {
    const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(normalize), n = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i).applyNormalMatrix(normalMatrix);
    position.setXYZ(i, p.x, p.y, p.z); geometry.attributes.normal.setXYZ(i, n.x, n.y, n.z);
    geometry.attributes.uv.setY(i, 1 - geometry.attributes.uv.getY(i));
  }
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: position.count, materialIndex: 0 }];
  const chunks = [], surfaces = []; let byteOffset = 0;
  const write = array => { const range = { byteOffset, count: array.length }; chunks.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength)); byteOffset += array.byteLength; return range; };
  for (const group of groups) {
    const subset = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
      const attribute = geometry.attributes[name], values = [];
      for (let i = group.start; i < group.start + group.count; i++) for (let c = 0; c < attribute.itemSize; c++) values.push(attribute.getComponent(i, c));
      subset.setAttribute(name, new THREE.BufferAttribute(new Float32Array(values), attribute.itemSize));
    }
    const welded = mergeVertices(subset, 1e-6), index = new Uint32Array(welded.index.array), vertexCount = welded.attributes.position.count, values = new Float32Array(vertexCount * 13);
    for (let i = 0; i < vertexCount; i++) { let o = i * 13; for (const name of ['normal', 'uv', 'skinWeight', 'skinIndex']) for (let c = 0; c < welded.attributes[name].itemSize; c++) values[o++] = welded.attributes[name].getComponent(i, c); }
    const simplify = (input, ratio, error) => MeshoptSimplifier.simplifyWithAttributes(input, welded.attributes.position.array, 3, values, 13, [.25,.25,.25,.5,.5,1,1,1,1,.02,.02,.02,.02], null, Math.floor(index.length * ratio / 3) * 3, error, ['LockBorder'])[0];
    const previewIndex = simplify(index, .45, .025), matchIndex = simplify(previewIndex, .2, .04);
    const preview = compactSurface(welded, previewIndex), match = compactSurface(welded, matchIndex);
    const writeAttributes = compact => {
      const attributes = {};
      for (const name of ['position', 'normal', 'uv', 'skinWeight']) attributes[name] = write(new Float32Array(compact.attributes[name].array));
      attributes.skinIndex = write(new Uint32Array(compact.attributes.skinIndex.array));
      return attributes;
    };
    const surface = { material: group.materialIndex, sourceTriangles: index.length / 3, attributes: writeAttributes(preview), matchAttributes: writeAttributes(match) };
    surface.attributes.index = write(new Uint32Array(preview.index.array)); surface.attributes.matchIndex = write(new Uint32Array(match.index.array)); surfaces.push(surface);
  }
  const materials = old.materials;
  fs.copyFileSync(path.join(source, diffuse), path.join(output, materials[0].texture));
  if (id === 'patlu') fs.copyFileSync(path.join(source, 'motu-patlu/textures/PatluGlasses_diff.png'), path.join(output, materials[1].texture));
  const metadata = { schemaVersion: 2, id, height: 1.4, bones, drivers, materials, surfaces, attribution: old.attribution, modifications: 'Full FBX skeleton and continuous skin weights retained; compact reduced preview/match surfaces, smoothed toon normals, normalized size/orientation and game pose retargeting. Supplied diffuse textures retained.' };
  fs.writeFileSync(path.join(output, `${id}.bin`), Buffer.concat(chunks)); fs.writeFileSync(path.join(output, `${id}.json`), JSON.stringify(metadata));
  console.log(`${id}: ${bones.length} bones; ${surfaces.length} continuous surfaces; ${surfaces.reduce((sum,s)=>sum+s.attributes.index.count/3,0)} preview triangles; ${surfaces.reduce((sum,s)=>sum+s.attributes.matchIndex.count/3,0)} match triangles; ${byteOffset} bytes`);
}
