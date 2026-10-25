import type { CustomRoomInfo } from './multiplayerClient';
import { isVolleyballMode } from './customModes';

export function volleyballControl(room: CustomRoomInfo | null, playerId: string) {
  if (!room || !isVolleyballMode(room.mode) || room.status !== 'PLAYING') return { custom: false, partnerBot: true, rival1Bot: true, rival2Bot: true };
  const me = room.slots.find(slot => slot.playerId === playerId);
  const teammate = room.slots.find(slot => slot.team === me?.team && slot.playerId !== playerId && slot.occupiedBy !== 'empty');
  const rivals = room.slots.filter(slot => slot.team !== me?.team && slot.occupiedBy !== 'empty');
  return { custom: true, partnerBot: teammate?.occupiedBy === 'bot', rival1Bot: rivals[0]?.occupiedBy === 'bot', rival2Bot: rivals[1]?.occupiedBy === 'bot' };
}

// A missing packet pauses remote movement; it never transfers a human to AI.
export function remoteMovement(playerId: string | null, lastTick: number | undefined, now: number, vx: number, vz: number, speed: number) {
  if (!playerId) return null;
  return lastTick !== undefined && lastTick > 0 && now >= lastTick && now - lastTick < 500 ? { x: vx / speed, z: vz / speed } : { x: 0, z: 0 };
}

export function gunFireRequested(_custom: boolean, held: boolean | undefined, keyboard: boolean | undefined, pressed = false, _targetAcquired = true) {
  return held === true || keyboard === true || pressed;
}
