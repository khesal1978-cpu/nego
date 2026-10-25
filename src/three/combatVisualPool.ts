import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Shape = 'assault' | 'shotgun' | 'fire' | 'ring' | 'streak' | 'shell' | 'nuke-ring' | 'nuke-big-ring';
type Visual<K extends Shape> = K extends 'assault' | 'shotgun' | 'fire' ? THREE.Group : THREE.Mesh;

/** Reuse transient GPU resources; releasing an impact must not dispose a live projectile's geometry. */
export function createCombatVisualPool() {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const free = new Map<Shape, THREE.Object3D[]>();
  const records = new Map<THREE.Object3D, { shape: Shape; materials: THREE.MeshBasicMaterial[]; leased: boolean }>();
  let created = 0;
  const geometry = (key: string, build: () => THREE.BufferGeometry) => {
    if (!geometries.has(key)) geometries.set(key, build());
    return geometries.get(key)!;
  };
  function take<K extends Shape>(shape: K, color: THREE.ColorRepresentation): Visual<K> {
    let object = free.get(shape)?.pop();
    if (!object) {
      const materials: THREE.MeshBasicMaterial[] = [];
      const mesh = (key: string, build: () => THREE.BufferGeometry, tint: THREE.ColorRepresentation, opacity = 1, side: THREE.Side = THREE.FrontSide) => {
        const material = new THREE.MeshBasicMaterial({ color: tint, transparent: opacity < 1, opacity, side });
        materials.push(material); return new THREE.Mesh(geometry(key, build), material);
      };
      if (shape === 'assault' || shape === 'shotgun' || shape === 'fire') {
        const group = new THREE.Group(); object = group;
        if (shape === 'assault') group.add(mesh('bolt', () => new THREE.CapsuleGeometry(.08, .3, 4, 6).rotateX(Math.PI / 2), color));
        if (shape === 'shotgun') {
          group.add(mesh('pellet', () => {
            const core = new THREE.SphereGeometry(.10, 8, 6);
            const trail = new THREE.CapsuleGeometry(.05, .25, 4, 6).rotateX(Math.PI / 2).translate(0, 0, -.09);
            const combined = mergeGeometries([core, trail], false)!; core.dispose(); trail.dispose(); return combined;
          }, color));
        }
        if (shape === 'fire') {
          group.add(mesh('fire-core', () => new THREE.DodecahedronGeometry(.16, 0), '#FFEAA3'));
          group.add(mesh('fire-shell', () => new THREE.SphereGeometry(.25, 10, 8), color, .7));
        }
      } else if (shape === 'shell') object = mesh('shell', () => new THREE.CylinderGeometry(.032, .032, .11, 6), color);
      else if (shape === 'streak') object = mesh('streak', () => new THREE.ConeGeometry(.045, .28, 5).rotateX(Math.PI / 2), color);
      else {
        const inner = shape === 'ring' ? .18 : .24, outer = shape === 'nuke-big-ring' ? .64 : shape === 'nuke-ring' ? .44 : .36;
        object = mesh(shape, () => new THREE.RingGeometry(inner, outer, 24).rotateX(-Math.PI / 2), color, .85, THREE.DoubleSide);
      }
      records.set(object, { shape, materials, leased: true }); created++;
    }
    const record = records.get(object)!; record.leased = true;
    object.position.set(0, 0, 0); object.rotation.set(0, 0, 0); object.scale.setScalar(1); object.visible = true;
    if (shape === 'fire') record.materials[1].color.set(color);
    else record.materials[0].color.set(color);
    for (const material of record.materials) material.opacity = material.transparent ? (shape === 'fire' ? .7 : shape === 'shotgun' ? .6 : .85) : 1;
    return object as Visual<K>;
  }
  function release(object: THREE.Object3D) {
    const record = records.get(object);
    if (!record || !record.leased) return false;
    object.removeFromParent(); object.visible = false; record.leased = false;
    const available = free.get(record.shape) ?? []; free.set(record.shape, available);
    if (available.length < 96) available.push(object);
    else { for (const material of record.materials) material.dispose(); records.delete(object); }
    return true;
  }
  return {
    take, release,
    get stats() { return { created, retained: records.size, geometries: geometries.size }; },
    dispose() {
      for (const [object, record] of records) { object.removeFromParent(); record.materials.forEach(material => material.dispose()); }
      geometries.forEach(value => value.dispose()); records.clear(); free.clear(); geometries.clear();
    },
  };
}

/** Nearby shotgun pellets share one visual impact; the collision engine still handles every pellet. */
export function createImpactGate() {
  const impacts: { x: number; y: number; z: number; at: number }[] = [];
  return (x: number, y: number, z: number, now: number) => {
    while (impacts.length && now - impacts[0].at > 70) impacts.shift();
    if (impacts.some(p => Math.abs(p.y - y) < 1 && Math.hypot(p.x - x, p.z - z) < 1)) return false;
    if (impacts.length >= 24) return false;
    impacts.push({ x, y, z, at: now }); return true;
  };
}
