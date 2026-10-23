import type { CharacterRig } from './crayonModels';
import { MathUtils } from 'three';

/** Four short emotes separated by neutral rests; time-based rather than frame-based. */
export function menuEmotePose(time: number) {
  const cycle = ((time % 32) + 32) % 32, slot = Math.floor(cycle / 8), t = cycle % 8;
  const weight = MathUtils.smoothstep(t, 0, .7) * (1 - MathUtils.smoothstep(t, 5.3, 6.2));
  const beat = Math.sin(t * 5.2);
  const pose = { leftX: -.12, leftZ: -.15, rightX: -.12, rightZ: .15, bodyZ: 0, headZ: 0, footX: 0, bounce: 0 };
  if (slot === 0) { pose.leftZ -= (1.95 + beat * .22) * weight; pose.leftX -= .3 * weight; pose.headZ = -.1 * weight; }
  if (slot === 1) { pose.leftZ -= 2.35 * weight; pose.rightZ += 2.35 * weight; pose.bounce = Math.max(0, beat) * .055 * weight; }
  if (slot === 2) { pose.leftX += beat * .65 * weight; pose.rightX -= beat * .65 * weight; pose.leftZ -= .5 * weight; pose.rightZ += .5 * weight; pose.bodyZ = beat * .11 * weight; pose.headZ = -beat * .09 * weight; pose.footX = beat * .23 * weight; }
  if (slot === 3) { pose.leftZ -= 1.15 * weight; pose.rightZ += 1.15 * weight; pose.bodyZ = Math.sin(t * 1.6) * .16 * weight; pose.headZ = -pose.bodyZ * .6; }
  return pose;
}
/** A relaxed menu pose: one small greeting, with the other hand at the side. */
export function mainMenuIdlePose(time: number) {
  const t = ((time % 12) + 12) % 12;
  const wave = MathUtils.smoothstep(t, 2, 2.8) * (1 - MathUtils.smoothstep(t, 4.5, 5.3));
  return {
    leftX: -.08 - wave * .24, leftZ: .08 - wave * (.5 + Math.sin(t * 5) * .06),
    rightX: -.08, rightZ: -.08,
    bodyZ: Math.sin(time * .8) * .012, headZ: Math.sin(time * 1.1) * .02,
    footX: 0, bounce: 0,
  };
}

function applyPose(rig: CharacterRig, p: ReturnType<typeof menuEmotePose>, dt: number, baselineY: number) {
  const blend = 1 - Math.exp(-10 * dt);
  rig.leftArm.rotation.x = MathUtils.lerp(rig.leftArm.rotation.x, p.leftX, blend);
  rig.leftArm.rotation.z = MathUtils.lerp(rig.leftArm.rotation.z, p.leftZ, blend);
  rig.rightArm.rotation.x = MathUtils.lerp(rig.rightArm.rotation.x, p.rightX, blend);
  rig.rightArm.rotation.z = MathUtils.lerp(rig.rightArm.rotation.z, p.rightZ, blend);
  rig.bodyGroup.rotation.z = p.bodyZ;
  rig.headGroup.rotation.z = p.headZ;
  rig.root.position.y = baselineY + p.bounce;
  rig.leftFoot.rotation.x = p.footX; rig.rightFoot.rotation.x = -p.footX;
}

export function animateMenuEmote(rig: CharacterRig, time: number, dt: number, reducedMotion: boolean, baselineY = rig.root.position.y) {
  applyPose(rig, menuEmotePose(reducedMotion ? 0 : time), dt, baselineY);
}

export function animateMainMenuIdle(rig: CharacterRig, time: number, dt: number, reducedMotion: boolean, baselineY: number) {
  applyPose(rig, mainMenuIdlePose(reducedMotion ? 0 : time), dt, baselineY);
}
