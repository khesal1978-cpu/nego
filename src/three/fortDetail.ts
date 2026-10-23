import * as THREE from 'three';

const stoneTextures = new Map<string, THREE.CanvasTexture>();
export function createMasonryTexture(base: string, mortar: string) {
  const key = base + mortar;
  if (stoneTextures.has(key)) return stoneTextures.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = mortar; ctx.fillRect(0, 0, 512, 512);
  let seed = 37;
  const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  const baseColor = new THREE.Color(base);
  for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
    const x = col * (512 / 3) + (row % 2) * (256 / 3) + 3, y = row * 128 + 3;
    const width = 512 / 3 - 6, height = 122;
    ctx.fillStyle = '#' + baseColor.clone().offsetHSL(0, -.005, (random() - .5) * .045).getHexString();
    ctx.beginPath(); ctx.roundRect(x, y, width, height, 6); ctx.fill();
    ctx.save(); ctx.clip();
    const light = ctx.createLinearGradient(x, y, x, y + height);
    light.addColorStop(0, '#f5f3e71f'); light.addColorStop(.18, '#ffffff00'); light.addColorStop(1, '#10273722');
    ctx.fillStyle = light; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#ecf3e529'; ctx.fillRect(x + 5, y + 3, width - 10, 3);
    ctx.fillStyle = '#15314425'; ctx.fillRect(x + 4, y + height - 5, width - 8, 3);
    // Broad worn stone patches survive mipmapping without sparkling speckles.
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#10293708' : '#f1f3dd0b';
      ctx.beginPath(); ctx.ellipse(x + random() * width, y + random() * height, 8 + random() * 17, 3 + random() * 6, random(), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.anisotropy = 8;
  stoneTextures.set(key, texture); return texture;
}

export function createFortGate(stone: THREE.Material, trim: THREE.Material, wood: THREE.Material, metal: THREE.Material) {
  const group = new THREE.Group(); group.name = 'Recessed arched timber gate';
  const outer = new THREE.Shape(); outer.moveTo(-2.2, 0); outer.lineTo(-2.2, 2.0); outer.absarc(0, 2, 2.2, Math.PI, 0, true); outer.lineTo(2.2, 0); outer.closePath();
  const opening = new THREE.Path(); opening.moveTo(-1.62, .12); opening.lineTo(1.62, .12); opening.lineTo(1.62, 2); opening.absarc(0, 2, 1.62, 0, Math.PI, false); opening.closePath(); outer.holes.push(opening);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .38, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 1, curveSegments: 24 }), stone);
  frame.castShadow = frame.receiveShadow = true; group.add(frame);
  for (let i = 0; i < 10; i++) {
    const x = -1.6 + (i + .5) * .32;
    const top = 2 + Math.sqrt(Math.max(0, 1.62 ** 2 - (Math.abs(x) + .16) ** 2));
    const plank = new THREE.Mesh(new THREE.BoxGeometry(.308, top - .16, .16), wood);
    plank.position.set(x, (top + .16) / 2, .12); plank.receiveShadow = true; group.add(plank);
  }
  for (const side of [-1, 1]) {
    for (const y of [.72, 1.7, 2.6]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.31, .11, .065), metal); strap.position.set(side * .83, y, .245); group.add(strap);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 6, 16), metal); handle.position.set(side * .2, 1.43, .3); group.add(handle);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.68, .3, .55), trim); base.position.set(side * 1.9, .15, .18); group.add(base);
  }
  const key = new THREE.Mesh(new THREE.BoxGeometry(.4, .57, .47), trim); key.position.set(0, 3.96, .24); group.add(key);
  return group;
}
