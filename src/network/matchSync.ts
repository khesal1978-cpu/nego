import { multiplayerClient, type CustomRoomInfo } from './multiplayerClient';

/** A single host owns shared physics and results; each human owns their input. */
export function createMatchSync(mode: CustomRoomInfo['mode'] | readonly CustomRoomInfo['mode'][], enabled: boolean, client = multiplayerClient) {
  let elapsed = 0;
  let revision = 0;
  let received = -1;
  let hostId = '';
  let dirty = false;
  const room = () => enabled && client.currentRoom && (Array.isArray(mode) ? mode.includes(client.currentRoom.mode) : client.currentRoom.mode === mode) ? client.currentRoom : null;
  const authority = () => !room() || room()!.hostId === client.playerId;
  return {
    active: () => Boolean(room()),
    authority,
    // Coalesce combat changes into one snapshot at the end of this frame.
    invalidate() { dirty = true; },
    publish(dt: number, capture: () => Record<string, unknown>, force = false) {
      if (!room() || !authority()) return;
      elapsed += dt;
      if (!force && !dirty && elapsed < .05) return;
      elapsed = 0;
      dirty = false;
      client.sendGameEvent(`${room()!.mode}:state`, { revision: ++revision, ...capture() });
    },
    receive(sender: string, kind: string, payload: Record<string, any>) {
      if (!room() || authority() || sender !== room()!.hostId || kind !== `${room()!.mode}:state`) return false;
      if (hostId !== sender) { hostId = sender; received = -1; }
      if (!Number.isSafeInteger(payload.revision) || payload.revision <= received) return false;
      received = payload.revision;
      return true;
    },
  };
}

export function numericState<T extends object>(object: T, fields: readonly (keyof T)[]) {
  return Object.fromEntries(fields.map(key => [key, object[key]]));
}

export function applyNumericState<T extends object>(object: T, state: Record<string, unknown>, fields: readonly (keyof T)[]) {
  for (const key of fields) {
    const value = state[String(key)];
    if (typeof value === 'number' && Number.isFinite(value)) object[key] = value as T[keyof T];
  }
}
