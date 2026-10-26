import * as THREE from 'three';
import type { CharacterConfig } from '../types/game';
import type { CharacterRig } from './crayonModels';
import { addCrayonOutline, getContactShadowTexture, getToonGradientMap } from './crayonMaterials';

type AssetId = 'motu' | 'patlu';
type Control = 'head' | 'leftArm' | 'rightArm' | 'leftFoot' | 'rightFoot';
interface AttributeRange { byteOffset: number; count: number }
interface BoneData { name: string; parent: number; position: number[]; quaternion: number[]; scale: number[] }
interface DriverData { bone: number; pivot: number[]; parentQuaternion: number[]; worldQuaternion: number[]; restZ: number }
export interface ImportedCharacterMetadata {
  schemaVersion: 2;
  id: AssetId;
  bones: BoneData[];
  drivers: Record<Control, DriverData>;
  materials: { texture: string; opacity: number }[];
  surfaces: { material: number; attributes: Record<'position' | 'normal' | 'uv' | 'skinWeight' | 'skinIndex' | 'index' | 'matchIndex', AttributeRange> }[];
}
interface Asset { metadata: ImportedCharacterMetadata; data: ArrayBuffer; textures: THREE.Texture[] }
const assets = new Map<AssetId, Asset>();
let pending: Promise<void> | undefined;
const controlNames: Record<Control, string> = { head: 'rig-head', leftArm: 'rig-left-arm', rightArm: 'rig-right-arm', leftFoot: 'rig-left-foot', rightFoot: 'rig-right-foot' };

export function installImportedCharacterAsset(metadata: ImportedCharacterMetadata, data: ArrayBuffer, textures: THREE.Texture[]) {
  if (metadata.schemaVersion !== 2 || !metadata.bones.length) throw new Error(`Invalid ${metadata.id} skeleton`);
  for (const surface of metadata.surfaces) for (const range of Object.values(surface.attributes)) {
    if (range.byteOffset % 4 || range.byteOffset + range.count * 4 > data.byteLength) throw new Error(`Invalid ${metadata.id} geometry`);
  }
  assets.set(metadata.id, { metadata, data, textures });
}

export function preloadImportedCharacters(): Promise<void> {
  if (pending) return pending;
  pending = Promise.allSettled((['motu', 'patlu'] as const).map(async id => {
    if (assets.has(id)) return;
    const signal = AbortSignal.timeout(20000);
    const read = async (file: string) => {
      const response = await fetch(`/characters/${file}?rig=2`, { signal });
      if (!response.ok) throw new Error(`Could not load ${id} (${response.status})`);
      return response;
    };
    const [metadata, data] = await Promise.all([read(`${id}.json`).then(r => r.json()) as Promise<ImportedCharacterMetadata>, read(`${id}.bin`).then(r => r.arrayBuffer())]);
    const textures = await Promise.all(metadata.materials.map(async material => {
      const bitmap = await createImageBitmap(await (await read(material.texture)).blob());
      const texture = new THREE.Texture(bitmap);
      texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; texture.needsUpdate = true;
      return texture;
    }));
    installImportedCharacterAsset(metadata, data, textures);
  })).then(results => {
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}

// Render loops update only matrices. Explicit bounds queries recompute the
// deformed surface, so profile framing includes raised hands and skin movement.
class CharacterSkinMesh extends THREE.SkinnedMesh {
  override updateWorldMatrix(parents: boolean, children: boolean) {
    Object.assign(this, { boundingBox: null, boundingSphere: null });
    super.updateWorldMatrix(parents, children);
    if (this.bindMode === THREE.AttachedBindMode) this.bindMatrixInverse.copy(this.matrixWorld).invert();
  }
}

interface Drive {
  control: THREE.Group; bone: THREE.Bone; parentInverse: THREE.Quaternion;
  worldRest: THREE.Quaternion; lowerArms: THREE.Quaternion;
  baseline: THREE.Vector3; restPosition: THREE.Vector3; target: THREE.Quaternion; offset: THREE.Vector3;
}

/** Game controls drive actual FBX bones; the intact surface blends its original
 * weights across shoulders, neck and hips. Copy also supports independent dolls. */
class CharacterSkinBody extends THREE.Group {
  metadata?: ImportedCharacterMetadata;
  private drives: Drive[] = [];
  override copy(source: this, recursive = true): this {
    super.copy(source, recursive); this.metadata = source.metadata; this.drives = [];
    return this;
  }
  private applyPose() {
    if (!this.metadata) return;
    if (!this.drives.length) {
      for (const [name, driver] of Object.entries(this.metadata.drivers) as [Control, DriverData][]) {
        const control = this.getObjectByName(controlNames[name]) as THREE.Group;
        const bone = this.getObjectByName(this.metadata.bones[driver.bone].name) as THREE.Bone;
        const baseline = new THREE.Vector3().fromArray(driver.pivot); if (name.endsWith('Foot')) baseline.y = .1;
        this.drives.push({ control, bone, baseline, parentInverse: new THREE.Quaternion().fromArray(driver.parentQuaternion).invert(), worldRest: new THREE.Quaternion().fromArray(driver.worldQuaternion), lowerArms: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), driver.restZ), restPosition: new THREE.Vector3().fromArray(this.metadata.bones[driver.bone].position), target: new THREE.Quaternion(), offset: new THREE.Vector3() });
      }
    }
    for (const drive of this.drives) {
      drive.target.copy(drive.parentInverse).multiply(drive.control.quaternion).multiply(drive.lowerArms).multiply(drive.worldRest);
      drive.bone.quaternion.copy(drive.target); drive.bone.scale.copy(drive.control.scale);
      drive.offset.subVectors(drive.control.position, drive.baseline).applyQuaternion(drive.parentInverse);
      drive.bone.position.copy(drive.restPosition).add(drive.offset);
    }
  }
  override updateMatrixWorld(force?: boolean) { this.applyPose(); super.updateMatrixWorld(force); }
  override updateWorldMatrix(parents: boolean, _children: boolean) { this.applyPose(); super.updateWorldMatrix(parents, true); }
}

export function createImportedCharacter(config: CharacterConfig, anisotropy: number, facingZ: 1 | -1, local: boolean, detail: 'preview' | 'match'): CharacterRig {
  const asset = assets.get(config.modelAsset!); if (!asset) throw new Error(`${config.name} model has not loaded`);
  const { metadata, data } = asset;
  const root = new THREE.Group(), model = new THREE.Group(), bodyGroup = new CharacterSkinBody();
  root.add(model); model.add(bodyGroup); bodyGroup.userData.skinnedCharacter = true;
  const bones = metadata.bones.map(info => { const bone = new THREE.Bone(); bone.name = info.name; bone.position.fromArray(info.position); bone.quaternion.fromArray(info.quaternion); bone.scale.fromArray(info.scale); return bone; });
  metadata.bones.forEach((info, i) => { (info.parent < 0 ? bodyGroup : bones[info.parent]).add(bones[i]); });
  const controls = {} as Record<Control, THREE.Group>;
  for (const [name, driver] of Object.entries(metadata.drivers) as [Control, DriverData][]) {
    const control = new THREE.Group(); control.name = controlNames[name]; control.position.fromArray(driver.pivot);
    if (name.endsWith('Foot')) control.position.y = .1;
    controls[name] = control; bodyGroup.add(control);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); skeleton.calculateInverses();
  const materials = metadata.materials.map((material, index) => {
    asset.textures[index].anisotropy = anisotropy;
    return new THREE.MeshToonMaterial({ map: asset.textures[index], gradientMap: getToonGradientMap(), side: THREE.DoubleSide, transparent: material.opacity < 1, opacity: material.opacity, depthWrite: material.opacity === 1 });
  });
  for (const surface of metadata.surfaces) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, size] of [['position',3], ['normal',3], ['uv',2], ['skinWeight',4], ['skinIndex',4]] as const) {
      const range = surface.attributes[name], values = name === 'skinIndex' ? new Uint32Array(data, range.byteOffset, range.count) : new Float32Array(data, range.byteOffset, range.count);
      geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
    }
    const range = surface.attributes[detail === 'match' ? 'matchIndex' : 'index'];
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data, range.byteOffset, range.count), 1));
    const mesh = new CharacterSkinMesh(geometry, materials[surface.material]); mesh.name = `${config.name} continuous skin`;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; bodyGroup.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
    if (!materials[surface.material].transparent) {
      const oldOutline = addCrayonOutline(mesh, .008); oldOutline.removeFromParent();
      const outline = new CharacterSkinMesh(oldOutline.geometry, oldOutline.material); outline.name = `${config.name} skinned outline`;
      outline.frustumCulled = false; bodyGroup.add(outline); outline.bind(skeleton, new THREE.Matrix4());
    }
  }
  bodyGroup.metadata = metadata; bodyGroup.rotation.y = facingZ === 1 ? 0 : Math.PI;
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(bodyGroup, true), scale = 1.9 / (bounds.max.y - bounds.min.y);
  model.name = 'Uniform character size'; model.scale.setScalar(scale); model.position.y = -bounds.min.y * scale;
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3), new THREE.MeshBasicMaterial({ map: getContactShadowTexture(), transparent: true, depthWrite: false, opacity: .72 }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = .015; root.add(shadowMesh);
  let playerRing: THREE.Mesh | undefined;
  if (local) {
    playerRing = new THREE.Mesh(new THREE.RingGeometry(.46,.56,36), new THREE.MeshBasicMaterial({ color: 0xa3e635, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
    playerRing.rotation.x = -Math.PI / 2; playerRing.position.y = .022; playerRing.visible = false; root.add(playerRing);
  }
  root.updateWorldMatrix(true, true);
  return { root, bodyGroup, headGroup: controls.head, leftArm: controls.leftArm, rightArm: controls.rightArm, leftFoot: controls.leftFoot, rightFoot: controls.rightFoot, shadowMesh, playerRing };
}
