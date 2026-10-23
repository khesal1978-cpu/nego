import * as THREE from 'three';
import { createFortRoofGeometry } from './gunFightEnvironment';

// Sink a continuous footing into the court, then soften its outer edge with
// low stones and grass. No colliders: these details stay at the fort perimeter.
export function createFortGrounding(radius: number, stone: THREE.Material, grass: THREE.Material) {
  const group = new THREE.Group();
  group.name = 'Grounded fort footing';
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.08, radius * 1.24, .48, 16), stone);
  footing.position.y = -.08;
  footing.receiveShadow = true;
  group.add(footing);
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const grassGeometry = new THREE.ConeGeometry(.085, .32, 3);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7 + .18;
    const x = Math.sin(angle) * radius * 1.12, z = Math.cos(angle) * radius * 1.12;
    const rock = new THREE.Mesh(rockGeometry, stone);
    rock.position.set(x, .035, z);
    rock.scale.set(.22 + (i % 3) * .065, .13 + (i % 2) * .055, .23);
    rock.rotation.set(.15, angle, -.12);
    rock.receiveShadow = true;
    group.add(rock);
    for (let blade = 0; blade < 2; blade++) {
      const tuft = new THREE.Mesh(grassGeometry, grass);
      tuft.position.set(x + Math.cos(angle) * (.18 + blade * .12), .13, z - Math.sin(angle) * (.18 + blade * .12));
      tuft.rotation.set(Math.sin(angle) * .16, angle + blade, Math.cos(angle) * .18);
      group.add(tuft);
    }
  }
  return group;
}

export function createHipRoofGeometry(width: number, depth: number, height: number) {
  const x = width / 2, z = depth / 2, ridge = width * .27;
  const vertices = [
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z,
    -ridge, height, 0, ridge, height, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3]);
  const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
  const p = flat.getAttribute('position'), n = flat.getAttribute('normal'), uv: number[] = [];
  for (let i = 0; i < p.count; i++) uv.push((Math.abs(n.getX(i)) > .5 ? p.getZ(i) : p.getX(i)) / 4, (p.getY(i) + p.getZ(i) * .3) / 3);
  flat.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return flat;
}

export function createFortTower(radius: number, shaftHeight: number, roofHeight: number, materials: { wall: THREE.Material; trim: THREE.Material; dark: THREE.Material; roof: THREE.Material; accent: THREE.Material }) {
  const group = new THREE.Group(); group.name = 'Round watchtower';
  const cylinder = (top: number, bottom: number, h: number, y: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, 40), material);
    mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const baseHeight = radius * .46;
  cylinder(radius * 1.08, radius * 1.2, baseHeight, baseHeight / 2, materials.dark);
  cylinder(radius, radius * 1.07, shaftHeight, baseHeight + shaftHeight / 2, materials.wall);
  const shoulder = baseHeight + shaftHeight;
  cylinder(radius * 1.13, radius, .38, shoulder + .19, materials.trim);
  cylinder(radius * 1.13, radius * 1.13, .23, shoulder + .495, materials.dark);
  const roofBase = shoulder + .61;
  const roof = new THREE.Mesh(createFortRoofGeometry(radius * 1.25, roofHeight), materials.roof);
  roof.name = 'Closed smooth tower roof'; roof.userData.roofBase = roofBase;
  roof.position.y = roofBase + roofHeight / 2;
  roof.castShadow = true; roof.receiveShadow = false; group.add(roof);
  // Broad arched recesses and a projecting sill replace spindly flags and trim.
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const panel = new THREE.Group(); panel.rotation.y = yaw; group.add(panel);
    const opening = new THREE.Shape(); const w = radius * .3, h = Math.min(1.3, shaftHeight * .24);
    opening.moveTo(-w, 0); opening.lineTo(w, 0); opening.lineTo(w, h); opening.absarc(0, h, w, 0, Math.PI, false); opening.closePath();
    const recess = new THREE.Mesh(new THREE.ShapeGeometry(opening, 12), materials.dark);
    recess.position.set(0, baseHeight + shaftHeight * .53, radius * 1.045 + .02); panel.add(recess);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 2.5, .15, .22), materials.trim);
    sill.position.set(0, recess.position.y - .055, recess.position.z); panel.add(sill);
    if (yaw === 0 && shaftHeight > 5) {
      const banner = new THREE.Mesh(new THREE.BoxGeometry(radius * .51, shaftHeight * .25, .075), materials.accent);
      banner.position.set(0, baseHeight + shaftHeight * .26, radius * 1.06 + .04); panel.add(banner);
    }
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius * .085, 12, 8), materials.trim);
  cap.position.y = roofBase + roofHeight; group.add(cap);
  return group;
}
