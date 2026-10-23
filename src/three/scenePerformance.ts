import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch only static opaque scenery; animated objects and pickups keep their
 * own transforms. Matching materials/shadow flags share one draw call. */
export function batchStaticScenery(root: THREE.Group, animated: THREE.Object3D[] = []) {
  const excluded = new Set<THREE.Object3D>();
  animated.forEach(object => object.traverse(child => excluded.add(child)));
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || excluded.has(object) || Array.isArray(object.material) || !object.visible || object.material.transparent) return;
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const attributes = Object.keys(mesh.geometry.attributes).sort().join(',');
    const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, attributes, Boolean(mesh.geometry.index)].join(':');
    if (!batches.has(key)) batches.set(key, { material: mesh.material, meshes: [] });
    batches.get(key)!.meshes.push(mesh);
  });
  for (const batch of batches.values()) {
    if (batch.meshes.length < 3) continue;
    const geometries = batch.meshes.map(mesh => {
      const geometry = mesh.geometry.clone();
      return geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(part => part.dispose());
    if (!geometry) continue;
    const first = batch.meshes[0];
    const merged = new THREE.Mesh(geometry, batch.material); merged.name = 'Batched static scenery';
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    merged.castShadow = first.castShadow; merged.receiveShadow = first.receiveShadow; merged.renderOrder = first.renderOrder;
    for (const mesh of batch.meshes) {
      // Preserve unbatched children such as transparent details and outlines.
      for (const child of [...mesh.children]) root.attach(child);
      mesh.removeFromParent();
    }
    root.add(merged);
  }
}

export function disposeSceneGeometry(scene: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometry.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
}
