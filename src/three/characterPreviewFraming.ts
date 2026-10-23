import { Box3, MathUtils, Vector3 } from 'three';
import type { CharacterRig } from './crayonModels';
import { mainMenuIdlePose, menuEmotePose } from './menuEmotes';

/** Measure the whole emote cycle once, so the camera never follows individual jumps. */
export function characterPreviewBounds(rig: CharacterRig, animated: boolean, presentation: 'turntable' | 'menu' = 'turntable') {
  const parts = [rig.bodyGroup, rig.headGroup, rig.leftArm, rig.rightArm, rig.leftFoot, rig.rightFoot];
  const rotations = parts.map(part => part.quaternion.clone());
  const baseline = rig.root.position.clone();
  rig.root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(rig.bodyGroup);
  if (animated) {
    for (let time = 0; time < (presentation === 'menu' ? 12 : 32); time += .125) {
      const pose = presentation === 'menu' ? mainMenuIdlePose(time) : menuEmotePose(time);
      rig.leftArm.rotation.set(pose.leftX, 0, pose.leftZ);
      rig.rightArm.rotation.set(pose.rightX, 0, pose.rightZ);
      rig.bodyGroup.rotation.z = pose.bodyZ;
      rig.headGroup.rotation.z = pose.headZ;
      rig.leftFoot.rotation.x = pose.footX; rig.rightFoot.rotation.x = -pose.footX;
      rig.root.position.y = baseline.y + pose.bounce;
      for (const yaw of presentation === 'menu' ? [-.12, 0, .12] : [rig.bodyGroup.rotation.y]) {
        rig.bodyGroup.rotation.y = yaw;
        rig.root.updateMatrixWorld(true);
        bounds.union(new Box3().setFromObject(rig.bodyGroup));
      }
    }
  }
  parts.forEach((part, index) => part.quaternion.copy(rotations[index]));
  rig.root.position.copy(baseline);
  rig.root.updateMatrixWorld(true);
  // Include arbitrary drag rotation, slight idle yaw and the gaps between samples.
  const horizontalRadius = Math.max(
    Math.hypot(bounds.min.x, bounds.min.z), Math.hypot(bounds.min.x, bounds.max.z),
    Math.hypot(bounds.max.x, bounds.min.z), Math.hypot(bounds.max.x, bounds.max.z)
  );
  if (presentation === 'turntable') {
    bounds.min.x = bounds.min.z = -horizontalRadius;
    bounds.max.x = bounds.max.z = horizontalRadius;
  }
  return bounds.expandByScalar(.04);
}

export function characterPreviewDistance(size: Vector3, aspect: number, fov: number, padding = 1.12) {
  const tan = Math.tan(MathUtils.degToRad(fov / 2));
  return Math.max(size.y / (2 * tan), size.x / (2 * tan * Math.max(.01, aspect))) * padding + size.z / 2;
}
