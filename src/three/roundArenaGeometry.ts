import * as THREE from 'three';
import { NUKE_FLOOR_RADIUS } from '../components/nukeArena';

export function createAnnularPrism(inner: number, outer: number, height: number, start = 0, sweep = Math.PI * 2) {
  const shape = new THREE.Shape();
  if (sweep >= Math.PI * 2 - .0001) {
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
  } else {
    const steps = Math.max(8, Math.ceil(sweep * 24));
    for (let i = 0; i <= steps; i++) {
      const theta = start + sweep * i / steps;
      if (i === 0) shape.moveTo(Math.cos(theta) * outer, Math.sin(theta) * outer);
      else shape.lineTo(Math.cos(theta) * outer, Math.sin(theta) * outer);
    }
    for (let i = steps; i >= 0; i--) {
      const theta = start + sweep * i / steps;
      shape.lineTo(Math.cos(theta) * inner, Math.sin(theta) * inner);
    }
    shape.closePath();
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 });
  geometry.rotateX(Math.PI / 2); geometry.translate(0, height, 0);
  const uv = geometry.getAttribute('uv'), p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getY(i)) > .5) uv.setXY(i, p.getX(i) / 4, p.getZ(i) / 4);
    else uv.setXY(i, Math.atan2(p.getZ(i), p.getX(i)) * outer / 3.6, p.getY(i) / 3.2);
  }
  return geometry;
}

export function createRoundNukeFloorGeometry() {
  const geometry = new THREE.CircleGeometry(NUKE_FLOOR_RADIUS, 128);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Reuse the existing painted turf; replace only its rectangular boundary. */
export function createRoundNukeFloorTexture(source: THREE.CanvasTexture, anisotropy: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source.image as HTMLCanvasElement, 134, 92, 756, 838, 0, 0, 1024, 1024);
  ctx.beginPath(); ctx.arc(512, 512, 495, 0, Math.PI * 2);
  ctx.strokeStyle = '#31586a'; ctx.lineWidth = 13; ctx.stroke();
  ctx.strokeStyle = '#e4f2d6'; ctx.lineWidth = 7; ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter; texture.anisotropy = anisotropy;
  return texture;
}
