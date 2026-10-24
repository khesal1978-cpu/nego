import type { GameState } from '../types/game';

export type AudioScene = 'menu' | 'game' | 'silent';

export function backgroundAudioScene(state: GameState, ready: boolean): AudioScene {
  if (!ready || state === 'PAUSED' || state === 'GAME_OVER') return 'silent';
  return state === 'PLAYING' ? 'game' : 'menu';
}
