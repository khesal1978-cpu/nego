import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

// Convert the supplied models once. Runtime uses six lightweight articulated
// parts, retaining the original indexed surfaces, UVs and texture atlases.
globalThis.ProgressEvent ??= class { constructor(type, values) { Object.assign(this, { type }, values); } };
const sourceDirectory = process.argv[2] || 'D:/Downloads';
const outputDirectory = 'public/characters';
fs.mkdirSync(outputDirectory, { recursive: true });
await MeshoptSimplifier.ready;

for (const [id, file] of [['motu', 'motu_patlu.glb'], ['patlu', 'motu_patlu (1).glb']]) {
  const armX = id === 'motu' ? .33 : .094, armY = id === 'motu' ? .84 : .931, armZ = id === 'motu' ? 0 : -.022;
  const pivots = { body: [0, 0, 0], head: [0, .94, 0], leftArm: [-armX, armY, armZ], rightArm: [armX, armY, armZ], leftFoot: [-.118, .1, 0], rightFoot: [.118, .1, 0] };
  const data = fs.readFileSync(path.join(sourceDirectory, file));
  const length = data.readUInt32LE(12);
  const original = JSON.parse(data.subarray(20, 20 + length));
  const json = structuredClone(original), binary = data.subarray(28 + length);
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + binary.toString('base64');
  json.materials.forEach(material => delete material.pbrMetallicRoughness.baseColorTexture);
  const { scene } = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene, true);
  const scale = 1.4 / (bounds.max.y - bounds.min.y);
  const facing = 1;
  const transform = new THREE.Matrix4().makeScale(scale * facing, scale, scale * facing);
  transform.setPosition(0, -bounds.min.y * scale, 0);
  const groups = new Map(), materials = [];
  for (const [i, material] of original.materials.entries()) {
    const textureIndex = material.pbrMetallicRoughness.baseColorTexture.index;
    const image = original.images[original.textures[textureIndex].source];
    const view = original.bufferViews[image.bufferView];
    const texture = `${id}-${i}.png`;
    fs.writeFileSync(path.join(outputDirectory, texture), binary.subarray(view.byteOffset, view.byteOffset + view.byteLength));
    materials.push({ texture, opacity: material.pbrMetallicRoughness.baseColorFactor?.[3] ?? 1 });
  }
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    const g = mesh.geometry, vertices = [], normals = [], normalMatrix = new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().multiplyMatrices(transform, mesh.matrixWorld));
    for (let v = 0; v < g.attributes.position.count; v++) {
      vertices.push(mesh.getVertexPosition(v, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(transform));
      normals.push(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, v).applyNormalMatrix(normalMatrix));
    }
    const classify = index => {
      const p = vertices[index];
      if (id === 'motu') {
        if (p.y > .965) return 'head';
        if (Math.abs(p.x) > .33 && p.y > .63) return p.x < 0 ? 'leftArm' : 'rightArm';
        if (p.y < .36) return p.x < 0 ? 'leftFoot' : 'rightFoot';
        return 'body';
      }
      const weights = g.attributes.skinWeight, joints = g.attributes.skinIndex;
      let influence = 0, bone;
      for (let k = 0; k < 4; k++) if (weights.getComponent(index, k) > influence) { influence = weights.getComponent(index, k); bone = mesh.skeleton.bones[joints.getComponent(index, k)]; }
      for (let current = bone; current; current = current.parent) {
        if (/head_bn_|neck_bn_/.test(current.name)) return 'head';
        if (/l_arm_bn_/.test(current.name)) return 'rightArm';
        if (/r_arm_bn_/.test(current.name)) return 'leftArm';
        if (/l_thigh_bn_/.test(current.name)) return 'rightFoot';
        if (/r_thigh_bn_/.test(current.name)) return 'leftFoot';
      }
      return 'body';
    };
    const material = mesh.material.name.includes('glasses') ? 1 : 0;
    for (let t = 0; t < g.index.count; t += 3) {
      const indices = [0, 1, 2].map(k => g.index.getX(t + k)), votes = indices.map(classify);
      const part = votes.find(v => votes.filter(other => other === v).length >= 2) || votes[0];
      const key = part + ':' + material;
      if (!groups.has(key)) groups.set(key, { part, material, map: new Map(), position: [], normal: [], uv: [], index: [] });
      const group = groups.get(key);
      for (const index of indices) {
        if (!group.map.has(index)) {
          group.map.set(index, group.map.size);
          const p = vertices[index].clone(), n = normals[index].clone();
          // Fold the source T-pose into relaxed downward arms around its shoulders.
          if (part.endsWith('Arm')) {
            const side = part === 'leftArm' ? -1 : 1;
            const shoulder = new THREE.Vector3(side * armX, armY, armZ);
            const rotation = new THREE.Matrix4().makeRotationZ(-side * Math.PI / 2);
            p.sub(shoulder).applyMatrix4(rotation).add(new THREE.Vector3(...pivots[part]));
            n.transformDirection(rotation);
          }
          p.sub(new THREE.Vector3(...pivots[part]));
          group.position.push(...p.toArray()); group.normal.push(...n.toArray());
          group.uv.push(g.attributes.uv.getX(index), g.attributes.uv.getY(index));
        }
        group.index.push(group.map.get(index));
      }
    }
  });
  const chunks = [], parts = []; let byteOffset = 0;
  for (const group of groups.values()) {
    const positions = new Float32Array(group.position), vertexAttributes = new Float32Array(group.map.size * 5);
    for (let i = 0; i < group.map.size; i++) vertexAttributes.set([...group.normal.slice(i * 3, i * 3 + 3), ...group.uv.slice(i * 2, i * 2 + 2)], i * 5);
    group.matchIndex = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(group.index), positions, 3, vertexAttributes, 5, [.25, .25, .25, .5, .5], null, Math.floor(group.index.length * .6 / 3) * 3, .015, ['LockBorder'])[0];
    const part = { name: group.part, material: group.material, pivot: pivots[group.part], attributes: {} };
    for (const name of ['position', 'normal', 'uv', 'index', 'matchIndex']) {
      const array = name.endsWith('Index') || name === 'index' ? new Uint32Array(group[name]) : new Float32Array(group[name]);
      part.attributes[name] = { byteOffset, count: array.length };
      const chunk = Buffer.from(array.buffer); chunks.push(chunk); byteOffset += chunk.byteLength;
    }
    parts.push(part);
  }
  const metadata = { id, height: 1.4, materials, parts, attribution: original.asset.extras, modifications: 'Normalized size and facing; articulated rigid parts; lowered arms from the T-pose. Original textures retained.' };
  fs.writeFileSync(path.join(outputDirectory, `${id}.bin`), Buffer.concat(chunks));
  fs.writeFileSync(path.join(outputDirectory, `${id}.json`), JSON.stringify(metadata));
  console.log(id, parts.map(p => `${p.name}: ${p.attributes.index.count / 3}`).join(', '), `${byteOffset} geometry bytes`);
}
