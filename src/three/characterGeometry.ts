import * as THREE from 'three';

/** Match characters occupy a small part of the screen. Keep smooth normals and
 * the same silhouette; reserve dense curved surfaces for the profile close-up. */
export function characterGeometry(match: boolean) {
  return {
    sphere: (...args: ConstructorParameters<typeof THREE.SphereGeometry>) => {
      if (match) { args[1] = Math.min(args[1] ?? 32, 20); args[2] = Math.min(args[2] ?? 16, 12); }
      return new THREE.SphereGeometry(...args);
    },
    capsule: (...args: ConstructorParameters<typeof THREE.CapsuleGeometry>) => {
      if (match) { args[2] = Math.min(args[2] ?? 4, 4); args[3] = Math.min(args[3] ?? 8, 12); }
      return new THREE.CapsuleGeometry(...args);
    },
    torus: (...args: ConstructorParameters<typeof THREE.TorusGeometry>) => {
      if (match) { args[2] = Math.min(args[2] ?? 12, 6); args[3] = Math.min(args[3] ?? 48, 20); }
      return new THREE.TorusGeometry(...args);
    },
    cylinder: (...args: ConstructorParameters<typeof THREE.CylinderGeometry>) => {
      if (match) args[3] = Math.min(args[3] ?? 32, 16);
      return new THREE.CylinderGeometry(...args);
    },
  };
}
