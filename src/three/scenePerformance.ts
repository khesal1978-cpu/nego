import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

class StaticSceneryMesh extends THREE.Mesh {
  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    // Bounds queries visit children without forwarding the parent's dirty flag.
    // Refresh world space there while retaining the baked local transform.
    super.updateWorldMatrix(updateParents, updateChildren, true);
  }
}

/** Call only on scenery fixed in world space, after placement. Keep moving
 * branches and their ancestors live; cache the remaining subtrees in one pass. */
export function freezeStaticWorldTransforms(root: THREE.Object3D, animated: THREE.Object3D[] = []) {
  const live = new Set<THREE.Object3D>([root]);
  for (const object of animated) {
    object.traverse(child => live.add(child));
    for (let parent = object.parent; parent; parent = parent.parent) live.add(parent);
  }
  root.updateWorldMatrix(true, true);
  const visit = (object: THREE.Object3D) => {
    if (live.has(object)) { for (const child of object.children) visit(child); return; }
    object.traverse(child => { child.matrixAutoUpdate = false; child.matrixWorldAutoUpdate = false; });
    // No transforms in this branch change during the match. Rendering and
    // shadow passes can reuse its world matrices without walking descendants.
    object.updateMatrixWorld = () => {};
  };
  visit(root);
}

/** Keep a contact shadow on the floor even while a scaled rig jumps or the
 * network smooths its vertical position. The shadow is a direct child of root. */
export function updateCharacterGroundShadow(root: THREE.Object3D, shadow: THREE.Mesh, floorY = .02) {
  const scale = Math.max(.001, root.scale.y);
  shadow.position.y = (floorY - root.position.y) / scale;
  shadow.scale.setScalar(Math.max(.45, 1 - Math.max(0, root.position.y - floorY) * .22));
}

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
    const merged = new StaticSceneryMesh(geometry, batch.material); merged.name = 'Batched static scenery';
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    merged.castShadow = first.castShadow; merged.receiveShadow = first.receiveShadow; merged.renderOrder = first.renderOrder;
    // The baked mesh stays fixed within its parent, including animated rigs.
    // Parent world matrices still update; its local matrix needs no per-frame rebuild.
    merged.updateMatrix(); merged.matrixAutoUpdate = false;
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
  geometry.forEach(value => value.dispose()); materials.forEach(value => { if (!value.userData.sharedCrayonResource) value.dispose(); });
}
