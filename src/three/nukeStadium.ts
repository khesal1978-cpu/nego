import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAnnularPrism } from './roundArenaGeometry';

/** Circular promenade and curved stands follow the playable disc. */
export function createNukeStadium(materials: { wall: THREE.Material; trim: THREE.Material; dark: THREE.Material; deck: THREE.Material; accent: THREE.Material; foliage: THREE.Material }, jungle: boolean) {
  const group = new THREE.Group();
  group.name = 'Nuke circular amphitheatre';
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y = 0, shadow = true) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y;
    mesh.castShadow = shadow; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const ring = (inner: number, outer: number, height: number, y: number, material: THREE.Material, start = 0, sweep = Math.PI * 2) => add(createAnnularPrism(inner, outer, height, start, sweep), material, y);
  const box = (parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  ring(17.65, 21.25, .25, -.28, materials.dark);
  ring(18.13, 21.25, .06, -.03, materials.deck);
  ring(17.65, 18.13, .42, -.06, materials.wall);
  ring(17.61, 18.18, .12, .36, materials.trim);
  // Keep the front low so the arena is visible; back rail follows the same arc.
  for (const y of [.9, 1.42]) ring(17.94, 18.06, .1, y, materials.accent, Math.PI, Math.PI);
  for (let i = 0; i <= 20; i++) {
    const angle = Math.PI + i * Math.PI / 20;
    const post = add(new THREE.CylinderGeometry(.17, .23, 1.6, 12), materials.trim, 1.13);
    post.position.x = Math.cos(angle) * 18; post.position.z = Math.sin(angle) * 18;
  }
  // Two curved seating wings leave a broad central entrance aisle.
  for (const start of [Math.PI + .12, Math.PI * 1.5 + .2]) {
    const sweep = Math.PI / 2 - .32;
    ring(21.1, 26.4, .45, -.4, materials.dark, start, sweep);
    for (let row = 0; row < 4; row++) {
      const inner = 21.15 + row * 1.2, top = .8 + row * .59;
      ring(inner, inner + 1.2, top, 0, materials.wall, start, sweep);
      ring(inner, inner + 1.18, .035, top, materials.deck, start, sweep);
      ring(inner + .79, inner + 1.08, .19, top + .04, materials.accent, start, sweep);
    }
    ring(26, 26.5, 3.55, 0, materials.wall, start, sweep);
    ring(25.9, 26.6, .18, 3.55, materials.trim, start, sweep);
  }
  // Entrance stays broad and low; its covered walkway meets the round promenade.
  const entrance = new THREE.Group(); entrance.position.z = -23.25; group.add(entrance);
  box(entrance, 0, -.04, 0, 7.6, .16, 10.5, materials.deck);
  for (const side of [-1, 1]) {
    box(entrance, side * 2.9, 1.65, 0, .75, 3.3, 4.6, materials.wall);
    box(entrance, side * 2.9, .3, 0, 1.2, .6, 4.95, materials.trim);
    box(entrance, side * 2.9, 3.35, 0, 1.05, .25, 4.9, materials.trim);
  }
  const arch = new THREE.Shape();
  arch.moveTo(-3.25, 0); arch.absarc(0, 0, 3.25, Math.PI, 0, true);
  arch.lineTo(2.5, 0); arch.absarc(0, 0, 2.5, 0, Math.PI, false); arch.closePath();
  const archMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 4.6, bevelEnabled: false, curveSegments: 20 }), materials.trim);
  archMesh.scale.y = .68; archMesh.position.set(0, 3.3, -2.3); archMesh.castShadow = true; entrance.add(archMesh);
  box(entrance, 0, 5.65, 0, 8.1, .32, 5.6, materials.accent);
  box(entrance, 0, 5.43, 0, 8.4, .12, 5.8, materials.trim);
  if (jungle) box(entrance, 0, 5.99, -.3, 5.2, .35, 3.2, materials.wall);
  for (const side of [-1, 1]) {
    const pavilion = new THREE.Group(); pavilion.position.set(side * 22.6, 0, -1.5); pavilion.rotation.y = side * .18; group.add(pavilion);
    box(pavilion, 0, .22, 0, 3.6, .44, 7.8, materials.wall);
    box(pavilion, 0, .49, 0, 3.7, .08, 7.9, materials.deck);
    for (const x of [-1.4, 1.4]) for (const z of [-3.35, 3.35]) box(pavilion, x, 1.8, z, .38, 2.6, .42, materials.trim);
    box(pavilion, 0, 3.16, 0, 3.5, .2, 7.5, materials.trim);
    box(pavilion, 0, 3.38, 0, 4.2, .26, 8.3, materials.accent);
    for (const theta of [.32, .68, 1.06]) {
      const planter = new THREE.Group(); planter.position.set(side * Math.cos(theta) * 20.35, 0, Math.sin(theta) * 20.35); planter.rotation.y = side * -theta; group.add(planter);
      box(planter, 0, .34, 0, 1.35, .6, 2.1, materials.trim);
      box(planter, 0, .81, 0, 1.15, .38, 1.84, materials.foliage);
    }
  }
  // Static geometry batches keep draw calls low even with curved seating.
  group.updateMatrixWorld(true);
  const batches = new Map<string, { material: THREE.Material; shadow: boolean; geometries: THREE.BufferGeometry[] }>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const key = `${mesh.material.uuid}:${mesh.castShadow}`;
    if (!batches.has(key)) batches.set(key, { material: mesh.material, shadow: mesh.castShadow, geometries: [] });
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld); batches.get(key)!.geometries.push(geometry); mesh.geometry.dispose();
  });
  group.clear();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries);
    if (!geometry) throw new Error('Nuke scenery geometry could not be merged');
    const mesh = new THREE.Mesh(geometry, batch.material); mesh.name = 'Batched circular stadium';
    mesh.castShadow = batch.shadow; mesh.receiveShadow = true; group.add(mesh);
    batch.geometries.forEach(part => part.dispose());
  }
  return group;
}
