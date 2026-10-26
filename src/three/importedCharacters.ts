import * as THREE from 'three';
import type { CharacterConfig } from '../types/game';
import type { CharacterRig } from './crayonModels';
import { addCrayonOutline, getContactShadowTexture, getToonGradientMap } from './crayonMaterials';

type AssetId = 'motu' | 'patlu';
type PartName = 'body' | 'head' | 'leftArm' | 'rightArm' | 'leftFoot' | 'rightFoot';
interface AttributeRange { byteOffset: number; count: number }
export interface ImportedCharacterMetadata {
  id: AssetId;
  materials: { texture: string; opacity: number }[];
  parts: { name: PartName; material: number; pivot: [number, number, number]; attributes: Record<'position' | 'normal' | 'uv' | 'index' | 'matchIndex', AttributeRange> }[];
}
interface Asset { metadata: ImportedCharacterMetadata; data: ArrayBuffer; textures: THREE.Texture[] }
const assets = new Map<AssetId, Asset>();
let pending: Promise<void> | undefined;

export function installImportedCharacterAsset(metadata: ImportedCharacterMetadata, data: ArrayBuffer, textures: THREE.Texture[]) {
  for (const part of metadata.parts) for (const range of Object.values(part.attributes)) {
    if (range.byteOffset % 4 || range.byteOffset + range.count * 4 > data.byteLength) throw new Error(`Invalid ${metadata.id} geometry`);
  }
  assets.set(metadata.id, { metadata, data, textures });
}

/** Prepare assets before scenes measure a rig. Geometry and decoded textures
 * are shared across title, customization and four-player matches. */
export function preloadImportedCharacters(): Promise<void> {
  if (pending) return pending;
  pending = Promise.allSettled((['motu', 'patlu'] as const).map(async id => {
    if (assets.has(id)) return;
    const signal = AbortSignal.timeout(20000);
    const read = async (file: string) => {
      const response = await fetch(`/characters/${file}`, { signal });
      if (!response.ok) throw new Error(`Could not load ${id} (${response.status})`);
      return response;
    };
    const [metadata, data] = await Promise.all([read(`${id}.json`).then(r => r.json()) as Promise<ImportedCharacterMetadata>, read(`${id}.bin`).then(r => r.arrayBuffer())]);
    const textures = await Promise.all(metadata.materials.map(async material => {
      const blob = await (await read(material.texture)).blob();
      const bitmap = await createImageBitmap(blob);
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

export function createImportedCharacter(config: CharacterConfig, anisotropy: number, facingZ: 1 | -1, local: boolean, detail: 'preview' | 'match'): CharacterRig {
  const asset = assets.get(config.modelAsset!);
  if (!asset) throw new Error(`${config.name} model has not loaded`);
  const root = new THREE.Group(), model = new THREE.Group(), bodyGroup = new THREE.Group();
  root.add(model); model.add(bodyGroup); bodyGroup.rotation.y = facingZ === 1 ? 0 : Math.PI;
  const groups = { body: bodyGroup, head: new THREE.Group(), leftArm: new THREE.Group(), rightArm: new THREE.Group(), leftFoot: new THREE.Group(), rightFoot: new THREE.Group() };
  const names = { head: 'rig-head', leftArm: 'rig-left-arm', rightArm: 'rig-right-arm', leftFoot: 'rig-left-foot', rightFoot: 'rig-right-foot' };
  for (const name of Object.keys(names) as (keyof typeof names)[]) { groups[name].name = names[name]; bodyGroup.add(groups[name]); }
  const materials = asset.metadata.materials.map((material, index) => {
    asset.textures[index].anisotropy = anisotropy;
    return new THREE.MeshToonMaterial({ map: asset.textures[index], gradientMap: getToonGradientMap(), side: THREE.DoubleSide, transparent: material.opacity < 1, opacity: material.opacity, depthWrite: material.opacity === 1 });
  });
  for (const part of asset.metadata.parts) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
      const range = part.attributes[name];
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(asset.data, range.byteOffset, range.count), size));
    }
    const range = part.attributes[detail === 'match' ? 'matchIndex' : 'index'];
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(asset.data, range.byteOffset, range.count), 1));
    const mesh = new THREE.Mesh(geometry, materials[part.material]); mesh.name = `${config.name} ${part.name}`;
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (!materials[part.material].transparent) addCrayonOutline(mesh, .012);
    groups[part.name].add(mesh);
    if (part.name !== 'body') groups[part.name].position.fromArray(part.pivot);
  }
  // Rounded sleeve joins cover the cut boundaries as rigid arms rotate.
  for (const arm of [groups.leftArm, groups.rightArm]) {
    const radius = config.modelAsset === 'motu' ? .105 : .055;
    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), new THREE.MeshToonMaterial({ color: config.modelAsset === 'motu' ? '#BD3938' : '#C2A323', gradientMap: getToonGradientMap() }));
    sleeve.name = `${config.name} sleeve joint`; sleeve.castShadow = true; arm.add(sleeve);
  }
  const bounds = new THREE.Box3().setFromObject(bodyGroup), scale = 1.9 / (bounds.max.y - bounds.min.y);
  model.name = 'Uniform character size'; model.scale.setScalar(scale); model.position.y = -bounds.min.y * scale;
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: getContactShadowTexture(), transparent: true, depthWrite: false, opacity: .72 }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = .015; root.add(shadowMesh);
  let playerRing: THREE.Mesh | undefined;
  if (local) {
    playerRing = new THREE.Mesh(new THREE.RingGeometry(.46, .56, 36), new THREE.MeshBasicMaterial({ color: 0xa3e635, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
    playerRing.rotation.x = -Math.PI / 2; playerRing.position.y = .022; playerRing.visible = false; root.add(playerRing);
  }
  root.updateWorldMatrix(true, true);
  return { root, bodyGroup, headGroup: groups.head, leftArm: groups.leftArm, rightArm: groups.rightArm, leftFoot: groups.leftFoot, rightFoot: groups.rightFoot, shadowMesh, playerRing };
}
