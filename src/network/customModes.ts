export type CustomMode = 'volleyball_1v1' | 'volleyball_2v2' | 'obstacle_rush' | 'floor_is_lava';

export const isVolleyballMode = (mode: string | undefined) => mode === 'volleyball_1v1' || mode === 'volleyball_2v2';
export const volleyballSlots = (mode: string) => mode === 'volleyball_1v1' ? 2 : 4;

export function customPlayerCount(mode: CustomMode, requested: number) {
  return isVolleyballMode(mode) ? volleyballSlots(mode) : Math.max(2, Math.min(5, Math.round(requested) || 5));
}

/** Every player sees themselves near the camera; duel rivals always use a1. */
export function volleyballActorPrefix(mode: CustomMode, slot: { playerId: string | null; team: string; slotIndex: number }, playerId: string, team: string): 'p' | 'pt' | 'a1' | 'a2' {
  return slot.playerId === playerId ? 'p' : slot.team === team ? 'pt' : mode === 'volleyball_1v1' || slot.slotIndex % 2 === 0 ? 'a1' : 'a2';
}
