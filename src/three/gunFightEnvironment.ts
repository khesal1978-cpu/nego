import * as THREE from 'three';

export function createFortRoofGeometry(radius: number, height: number): THREE.LatheGeometry {
  const profile = [
    [0, 0], [radius, 0], [radius * 1.025, height * .045],
    [radius * .99, height * .09], [radius * .88, height * .18],
    [radius * .72, height * .36], [radius * .54, height * .57],
    [radius * .35, height * .77], [radius * .15, height * .94], [0, height],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y - height / 2)), 48);
  // Lathe poles otherwise contain zero-area triangles. A closed underside also
  // keeps light/shadow rays from leaking through the eave.
  const p = geometry.getAttribute('position'), indices = geometry.index!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const clean: number[] = [];
  for (let i = 0; i < indices.count; i += 3) {
    const ai = indices.getX(i), bi = indices.getX(i + 1), ci = indices.getX(i + 2);
    a.fromBufferAttribute(p, ai); b.fromBufferAttribute(p, bi); c.fromBufferAttribute(p, ci);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12) clean.push(ai, bi, ci);
  }
  geometry.setIndex(clean);
  return geometry;
}

export function createFortSurfaceTexture(base: string, kind: 'roof' | 'deck', anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  if (kind === 'roof') {
    // Subtle overlapping courses, without alternating black checkerboard tiles.
    for (let row = 0; row < 6; row++) {
      const y = row * 43;
      ctx.fillStyle = 'rgba(18, 38, 50, .09)';
      ctx.fillRect(0, y + 39, 256, 4);
      ctx.fillStyle = 'rgba(222, 231, 224, .06)';
      ctx.fillRect(0, y + 3, 256, 3);
      for (let col = -1; col < 8; col++) {
        ctx.fillStyle = 'rgba(18, 38, 50, .05)';
        ctx.fillRect(col * 40 + (row % 2) * 20, y + 6, 2, 30);
      }
    }
  } else {
    let seed = 1907;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(37, 64, 68, .045)' : 'rgba(240, 244, 232, .065)';
      const x = random() * 256, y = random() * 256;
      const width = 5 + random() * 18, height = 1 + random() * 3;
      for (const offset of [-256, 0, 256]) ctx.fillRect(x + offset, y, width, height);
    }
    ctx.strokeStyle = 'rgba(42, 64, 68, .10)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      for (let x = (y / 64 % 2) * 64; x < 256; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// One coastline encloses the courtyard, beacon and hills. All three use the
// same footprint, so the distant scenery never reads as separate islands.
const COAST: ReadonlyArray<readonly [number, number]> = [
  [-33, 25], [-38, 15], [-40, 1], [-52, -16], [-60, -36],
  [-55, -53], [-35, -65], [-8, -69], [20, -67], [44, -60],
  [59, -43], [58, -25], [44, -8], [37, 8], [34, 23], [21, 28], [-14, 28],
];

const coastCurve = new THREE.CatmullRomCurve3(
  COAST.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal'
);
const coastPoints = coastCurve.getPoints(128).slice(0, -1);

export function createFortCoastShape(scale = 1): THREE.Shape {
  // Extruded XY shapes are rotated +PI/2 into world XZ.
  return new THREE.Shape(coastPoints.map(p => new THREE.Vector2(p.x * scale, p.z * scale)));
}

export function createFortSurfGeometry(scale: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(coastPoints.map(p => new THREE.Vector2(p.x * scale, -p.z * scale)));
  const inner = coastPoints.map(p => new THREE.Vector2(p.x * (scale - 0.012), -p.z * (scale - 0.012)));
  shape.holes.push(new THREE.Path(inner.reverse()));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function insideCoast(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = coastPoints.length - 1; i < coastPoints.length; j = i++) {
    const a = coastPoints[i];
    const b = coastPoints[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

const HILLS = [
  [-38, -39, 17, 17, 17], [-19, -48, 18, 18, 21],
  [5, -51, 22, 18, 25], [30, -47, 18, 17, 20],
  [44, -30, 12, 16, 12], [-46, -23, 12, 15, 10],
];

export function getFortLandscapeHeight(x: number, z: number): number {
  let ridge = 0;
  for (const [hx, hz, rx, rz, height] of HILLS) {
    const distance = ((x - hx) / rx) ** 2 + ((z - hz) / rz) ** 2;
    ridge += height * Math.exp(-distance * 1.8);
  }
  const apron = Math.max(
    THREE.MathUtils.smoothstep(Math.abs(x), 32, 42),
    1 - THREE.MathUtils.smoothstep(z, -35, -24)
  );
  const coastDistance = Math.min(...coastPoints.map(p => Math.hypot(x - p.x, z - p.z)));
  const shore = THREE.MathUtils.smoothstep(coastDistance, 1, 9);
  const contour = 1 + Math.sin(x * 0.19 + z * 0.12) * 0.055 + Math.cos(z * 0.27) * 0.035;
  return -0.45 + ridge * apron * shore * contour;
}

// Smooth overlapping ridges form a single mesh, with a flat apron that meets
// the original lawn below its surface. Nothing enters the playable court.
export function createFortHills(material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(124, 104, 80, 68);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -20);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, getFortLandscapeHeight(x, z));
    // Match the unchanged lawn's world-space texture coordinates at the seam.
    uv.setXY(i, x, z);
  }
  const source = geometry.getIndex()!;
  const indices: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    const triangle = [source.getX(i), source.getX(i + 1), source.getX(i + 2)];
    if (triangle.every(v => insideCoast(positions.getX(v), positions.getZ(v)))) indices.push(...triangle);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'connected-fort-hills';
  mesh.receiveShadow = true;
  return mesh;
}

// A stone block has the same physical size on a large curtain wall and a small
// terrace. Default primitive UVs would stretch one tile across each object.
export function applyFortMasonryScale(root: THREE.Object3D, materials: THREE.Material[]): void {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !materials.includes(object.material)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    if (!(geometry instanceof THREE.BoxGeometry || geometry instanceof THREE.CylinderGeometry)) return;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (Math.abs(normal.getY(i)) > 0.5) {
        uv.setXY(i, x / 3.6, z / 3.2);
      } else if (geometry instanceof THREE.CylinderGeometry) {
        const radius = Math.max(geometry.parameters.radiusTop, geometry.parameters.radiusBottom);
        uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius / 3.6, y / 3.2);
      } else {
        uv.setXY(i, (Math.abs(normal.getX(i)) > 0.5 ? z : x) / 3.6, y / 3.2);
      }
    }
    uv.needsUpdate = true;
  });
}
