import * as THREE from 'three';

/** Bring the distant coastline closer without shrinking the circular court.
 * Use the same transform for turf, cliffs, hills and surf so they meet. */
export function compactNukeCoast(geometry: THREE.BufferGeometry, hillHeight = 1) {
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) * .84;
    const z = positions.getZ(i) * (positions.getZ(i) < 0 ? .72 : .95);
    const y = -.45 + (positions.getY(i) + .45) * hillHeight;
    positions.setXYZ(i, x, y, z);
    // One broad, filtered grass tile per seven metres, continuous across seams.
    if (uv) uv.setXY(i, x, z);
  }
  positions.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
