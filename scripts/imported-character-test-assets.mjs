import fs from 'node:fs';
import { Texture } from 'three';

export function installTestCharacterAssets(module) {
  for (const id of ['motu', 'patlu']) {
    const metadata = JSON.parse(fs.readFileSync(`public/characters/${id}.json`, 'utf8'));
    const buffer = fs.readFileSync(`public/characters/${id}.bin`);
    module.installImportedCharacterAsset(metadata, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), metadata.materials.map(() => new Texture()));
  }
}
