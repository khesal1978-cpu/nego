import type { GameMode, GameState } from '../types/game';
import type { CustomRoomInfo } from '../network/multiplayerClient';

export function activeMatchRoom(snapshot: CustomRoomInfo | null, current: CustomRoomInfo | null, state: GameState, mode: GameMode) {
  if (!snapshot || !current || snapshot.code !== current.code || !['PLAYING', 'PAUSED', 'GAME_OVER'].includes(state)) return null;
  const roomMode = snapshot.mode === 'volleyball_1v1' ? 'duo_2v2' : snapshot.mode === 'volleyball_2v2' ? 'hoop_volley' : snapshot.mode;
  return roomMode === mode ? snapshot : null;
}
export function nextRandomMap<T extends { id: string }>(maps: readonly T[], current: string, random = Math.random): T {
  const choices = maps.filter(map => map.id !== current);
  return (choices.length ? choices : maps)[Math.min((choices.length || maps.length) - 1, Math.floor(random() * (choices.length || maps.length)))];
}
