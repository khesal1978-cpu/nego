import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getToonGradientMap } from './crayonMaterials';

function material(color: string) { return new THREE.MeshToonMaterial({ color, gradientMap: getToonGradientMap() }); }

function rounded(group: THREE.Group, size: [number, number, number], position: [number, number, number], mat: THREE.Material, radius = 0.02) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 4))), mat);
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createArenaWeapon(type: 'assault' | 'shotgun' | 'fire', accent = '#638C92'): THREE.Group {
  const group = new THREE.Group();
  group.name = `arena-${type}`;
  const dark = material('#283941'), steel = material('#788C91'), grip = material('#34454A');
  const accentMat = material(accent), walnut = material('#90765B'), pale = material('#C2CCC7');
  const barrel = (x: number, y: number, z: number, radius: number, length: number, mat = steel) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  rounded(group, [0.12, 0.15, 0.25], [0, -0.005, -0.19], type === 'shotgun' ? walnut : grip);
  rounded(group, [0.14, 0.17, 0.035], [0, -0.005, -0.32], dark, 0.01);
  rounded(group, [0.16, 0.17, 0.36], [0, 0.025, 0.08], type === 'fire' ? material('#A85F4B') : steel);
  rounded(group, [0.08, 0.17, 0.095], [0, -0.12, -0.025], grip).rotation.x = -0.22;
  rounded(group, [0.172, 0.036, 0.16], [0, 0.032, 0.055], accentMat, 0.009);
  rounded(group, [0.035, 0.035, 0.09], [0.09, 0.07, 0.13], dark, 0.007);

  if (type === 'assault') {
    rounded(group, [0.085, 0.2, 0.11], [0, -0.13, 0.14], dark).rotation.x = 0.14;
    rounded(group, [0.1, 0.035, 0.12], [0, -0.235, 0.154], steel, 0.01);
    rounded(group, [0.14, 0.13, 0.27], [0, 0.02, 0.36], grip);
    for (const z of [0.27, 0.32, 0.37, 0.42]) rounded(group, [0.15, 0.07, 0.018], [0, 0.035, z], dark, 0.004);
    barrel(0, 0.035, 0.55, 0.032, 0.22);
    barrel(0, 0.035, 0.68, 0.05, 0.08, dark);
    rounded(group, [0.085, 0.04, 0.25], [0, 0.127, 0.07], dark, 0.007);
    rounded(group, [0.094, 0.07, 0.10], [0, 0.178, 0.045], grip, 0.014);
    rounded(group, [0.066, 0.042, 0.014], [0, 0.18, 0.10], material('#8CB5B7'), 0.004);
  } else if (type === 'shotgun') {
    for (const x of [-0.042, 0.042]) {
      barrel(x, 0.05, 0.44, 0.039, 0.5);
      barrel(x, 0.05, 0.695, 0.042, 0.025, dark);
    }
    rounded(group, [0.14, 0.11, 0.22], [0, -0.035, 0.37], walnut);
    for (const z of [0.29, 0.33, 0.37, 0.41, 0.45]) rounded(group, [0.145, 0.115, 0.011], [0, -0.035, z], grip, 0.003);
    rounded(group, [0.035, 0.032, 0.035], [0, 0.108, 0.6], pale, 0.007);
  } else {
    barrel(0, -0.1, 0.25, 0.078, 0.31, material('#B18B58'));
    barrel(0, -0.1, 0.14, 0.085, 0.027, dark);
    barrel(0, -0.1, 0.36, 0.085, 0.027, dark);
    barrel(0, 0.045, 0.47, 0.066, 0.30, dark);
    for (const z of [0.37, 0.43, 0.49, 0.55]) barrel(0, 0.045, z, 0.074, 0.014);
    barrel(0, 0.045, 0.645, 0.072, 0.055, material('#B18B58'));
    rounded(group, [0.08, 0.045, 0.07], [0, 0.135, 0.07], pale);
  }
  return group;
}

export function createArenaMedkit(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arena-medkit';
  const shell = material('#D6DFD7'), green = material('#51806C'), dark = material('#41565A');
  rounded(group, [0.94, 0.59, 0.47], [0, 0, 0], shell, 0.07);
  rounded(group, [0.95, 0.055, 0.48], [0, 0.08, 0], green, 0.015);
  rounded(group, [0.46, 0.075, 0.12], [0, 0.41, 0], dark);
  [-0.2, 0.2].forEach(x => rounded(group, [0.07, 0.14, 0.12], [x, 0.33, 0], dark));
  [-0.32, 0.32].forEach(x => rounded(group, [0.1, 0.17, 0.055], [x, 0.05, 0.251], dark, 0.013));
  [-1, 1].forEach(side => {
    rounded(group, [0.36, 0.12, 0.025], [0, -0.06, side * 0.25], green, 0.012);
    rounded(group, [0.12, 0.35, 0.028], [0, -0.06, side * 0.252], green, 0.012);
  });
  rounded(group, [0.34, 0.018, 0.10], [0, 0.30, 0], green, 0.008);
  rounded(group, [0.10, 0.019, 0.28], [0, 0.302, 0], green, 0.008);
  return group;
}
