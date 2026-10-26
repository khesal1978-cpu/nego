import * as THREE from 'three';
import type { CharacterRig } from './crayonModels';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

type Particle = { p: THREE.Vector3; previous: THREE.Vector3; radius: number };
type Doll = { body: THREE.Group; particles: Particle[]; constraints: Array<[number, number, number]>; scale: number; yaw: THREE.Quaternion; life: number; parts: Array<THREE.Object3D | undefined> };
const STEP = 1 / 90;
const rest = [[0, .42, 0], [0, .86, 0], [0, 1.24, 0], [-.34, .52, .06], [.34, .52, .06], [-.118, .1, .025], [.118, .1, .025]];

/** Seven connected masses drive the existing character's torso/head/limbs.
 * Simulation uses fixed steps, floor collision and distance constraints. */
export function createCharacterRagdolls(scene: THREE.Scene, floorAt: (x: number, z: number, y: number) => number) {
  const dolls: Doll[] = [];
  const delta = new THREE.Vector3(), axis = new THREE.Vector3(), local = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const orientation = new THREE.Quaternion(), inverse = new THREE.Quaternion();
  let accumulator = 0;
  function release(body: THREE.Group) {
    body.removeFromParent();
    const skeletons = new Set<THREE.Skeleton>();
    body.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
    skeletons.forEach(skeleton => skeleton.dispose());
  }
  function clear() { for (const doll of dolls) release(doll.body); dolls.length = 0; }
  return {
    spawn(rig: CharacterRig, vx: number, vz: number) {
      if (dolls.length >= 3) release(dolls.shift()!.body);
      rig.root.updateWorldMatrix(true, true);
      // bodyGroup's world transform includes the shared model-size normalization.
      const scale = rig.bodyGroup.getWorldScale(new THREE.Vector3()).x;
      const yaw = rig.bodyGroup.getWorldQuaternion(new THREE.Quaternion());
      const origin = rig.bodyGroup.getWorldPosition(new THREE.Vector3());
      const impact = new THREE.Vector3(vx, 0, vz).clampLength(0, 16);
      const particles = rest.map(([x, y, z], i) => {
        const p = new THREE.Vector3(x, y, z).multiplyScalar(scale).applyQuaternion(yaw).add(origin);
        const impulse = new THREE.Vector3(impact.x * .42 + (i % 2 ? .3 : -.3), i < 3 ? 1.55 : .8, impact.z * .42 + (i === 2 ? .65 : 0));
        return { p, previous: p.clone().addScaledVector(impulse, -STEP), radius: (i === 2 ? .33 : i < 2 ? .23 : .09) * scale };
      });
      const pairs = [[0, 1], [1, 2], [1, 3], [1, 4], [0, 5], [0, 6], [3, 4], [5, 6], [0, 2]];
      const constraints = pairs.map(([a, b]) => [a, b, particles[a].p.distanceTo(particles[b].p)] as [number, number, number]);
      const body = (rig.bodyGroup.userData.skinnedCharacter ? cloneSkeleton(rig.bodyGroup) : rig.bodyGroup.clone(true)) as THREE.Group;
      body.traverse(object => { if (object.userData.excludeRagdoll) object.visible = false; });
      body.scale.copy(rig.bodyGroup.getWorldScale(new THREE.Vector3()));
      body.position.copy(origin); body.quaternion.copy(yaw); scene.add(body);
      const parts = ['rig-head', 'rig-left-arm', 'rig-right-arm', 'rig-left-foot', 'rig-right-foot'].map(name => body.getObjectByName(name));
      dolls.push({ body, particles, constraints, scale, yaw, life: 1.8, parts });
    },
    update(dt: number) {
      accumulator = Math.min(accumulator + dt, .08);
      while (accumulator >= STEP) {
        accumulator -= STEP;
        for (const doll of dolls) {
          doll.life -= STEP;
          for (const point of doll.particles) {
            delta.subVectors(point.p, point.previous).multiplyScalar(.991);
            point.previous.copy(point.p); point.p.add(delta); point.p.y -= 19 * STEP * STEP;
          }
          for (let pass = 0; pass < 7; pass++) {
            for (const [a, b, length] of doll.constraints) {
              const p = doll.particles[a].p, q = doll.particles[b].p;
              delta.subVectors(q, p); const distance = Math.max(.0001, delta.length());
              delta.multiplyScalar((distance - length) / distance * .5); p.add(delta); q.sub(delta);
            }
            for (const point of doll.particles) {
              const floor = floorAt(point.p.x, point.p.z, point.p.y) + point.radius;
              if (point.p.y < floor) {
                const verticalMotion = point.p.y - point.previous.y;
                point.p.y = floor;
                point.previous.x += (point.p.x - point.previous.x) * .28;
                point.previous.z += (point.p.z - point.previous.z) * .28;
                // A small first-contact rebound gives way to a settled floor pose.
                point.previous.y = floor - Math.max(0, verticalMotion < -.004 ? -verticalMotion * .12 : 0);
              }
            }
          }
        }
      }
      for (let i = dolls.length - 1; i >= 0; i--) {
        const doll = dolls[i];
        if (doll.life <= 0) { release(doll.body); dolls.splice(i, 1); continue; }
        const p = doll.particles;
        axis.subVectors(p[1].p, p[0].p).normalize();
        orientation.setFromUnitVectors(up, axis).multiply(doll.yaw);
        doll.body.quaternion.copy(orientation);
        doll.body.position.copy(p[0].p).addScaledVector(axis, -.42 * doll.scale);
        inverse.copy(orientation).invert();
        const head = doll.parts[0];
        if (head) { local.subVectors(p[2].p, p[1].p).applyQuaternion(inverse).normalize(); head.quaternion.setFromUnitVectors(up, local); }
        for (let side = 0; side < 2; side++) {
          const arm = doll.parts[1 + side];
          if (arm) {
            local.copy(arm.position).multiplyScalar(doll.scale).applyQuaternion(orientation).add(doll.body.position);
            delta.subVectors(p[3 + side].p, local).applyQuaternion(inverse).normalize();
            local.set(side ? .132 : -.132, -.3, .058).normalize(); arm.quaternion.setFromUnitVectors(local, delta);
          }
          const foot = doll.parts[3 + side];
          if (foot) {
            foot.position.copy(p[5 + side].p).sub(doll.body.position).applyQuaternion(inverse).divideScalar(doll.scale);
            local.subVectors(p[0].p, p[5 + side].p).applyQuaternion(inverse).normalize(); foot.quaternion.setFromUnitVectors(up, local);
          }
        }
      }
    },
    clear,
    dispose: clear,
    get count() { return dolls.length; },
  };
}
