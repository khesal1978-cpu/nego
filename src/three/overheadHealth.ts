import * as THREE from 'three';

const width = 1.1;
const inverseParent = new THREE.Quaternion();
const facing = new THREE.Quaternion();
const offset = new THREE.Vector3();

export function createOverheadHealthBar(parent: THREE.Object3D) {
  const background = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .15), new THREE.MeshBasicMaterial({ color: '#092330', side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(width, .085), new THREE.MeshBasicMaterial({ color: '#A8EF52', side: THREE.DoubleSide, depthTest: true, depthWrite: false, toneMapped: false }));
  background.name = 'hit-health-background'; fill.name = 'hit-health-fill';
  background.position.set(0, 2.18, 0); fill.position.copy(background.position);
  background.renderOrder = 10; fill.renderOrder = 11;
  background.visible = fill.visible = false;
  parent.add(background, fill);
  return { background, fill };
}

export function hitHealthVisible(hp: number, secondsSinceHit: number, active = true) {
  return active && hp > 0 && secondsSinceHit >= 0 && secondsSinceHit < 2.2;
}

/** Billboard in parent-local space, so turning the character cannot tilt the bar. */
export function updateOverheadHealth(background: THREE.Mesh, fill: THREE.Mesh, camera: THREE.Camera, hp: number, maxHp: number, visible: boolean) {
  background.visible = fill.visible = visible;
  if (!visible || !background.parent) return;
  background.parent.getWorldQuaternion(inverseParent).invert();
  camera.getWorldQuaternion(facing);
  facing.premultiply(inverseParent);
  background.quaternion.copy(facing); fill.quaternion.copy(facing);
  const ratio = Math.min(1, Math.max(0, hp / Math.max(1, maxHp)));
  fill.scale.x = ratio;
  // Keep the left edge fixed while health decreases, with depth separation in
  // camera space. The scene depth still hides bars behind solid walls.
  offset.set((ratio - 1) * width / 2, 0, .008).applyQuaternion(facing);
  fill.position.copy(background.position).add(offset);
  (fill.material as THREE.MeshBasicMaterial).color.set(ratio <= .25 ? '#F18C70' : ratio <= .5 ? '#E8D460' : '#A8EF52');
}
