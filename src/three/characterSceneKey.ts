import type { CharacterConfig } from '../types/game';

/** Equivalent profile snapshots must not restart a running WebGL scene. */
export function characterSceneKey(character: CharacterConfig) {
  return JSON.stringify(Object.keys(character).sort().map(key => [key, character[key as keyof CharacterConfig]]));
}
