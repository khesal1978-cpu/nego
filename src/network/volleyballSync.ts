import { stepVolleyballBall, type VolleyballBallMotion } from '../components/volleyballNetCollision';

/** Keep newer local/direct hits while their acknowledgement is still travelling from the host. */
export function createVolleyHitSync() {
  let localId = 0;
  const seen = new Map<string, { id: number; until: number }>();
  return {
    issue(player: string, now: number) { const id = ++localId; seen.set(player, { id, until: now + 800 }); return id; },
    receive(player: string, id: unknown, now: number) {
      if (!Number.isSafeInteger(id) || (id as number) <= 0) return true; // Older clients can still play.
      if ((seen.get(player)?.id || 0) >= (id as number)) return false;
      seen.set(player, { id: id as number, until: now + 800 }); return true;
    },
    capture() { return Object.fromEntries([...seen].map(([player, hit]) => [player, hit.id])); },
    canApply(acknowledged: unknown, now: number, pointFinished = false) {
      if (pointFinished) { for (const hit of seen.values()) hit.until = 0; return true; }
      const ids = acknowledged && typeof acknowledged === 'object' ? acknowledged as Record<string, unknown> : {};
      for (const [player, hit] of seen) if (now < hit.until && (!Number.isSafeInteger(ids[player]) || Number(ids[player]) < hit.id)) return false;
      return true;
    },
  };
}

/** Monotonic round trips avoid relying on clock synchronization between phones. */
export function createVolleyTiming(self: string, send: (kind: string, payload: Record<string, unknown>) => void, now = () => performance.now()) {
  let nextProbe = -Infinity, nonce = 0, sent = 0;
  const delay = new Map<string, number>(), answered = new Set<string>();
  return {
    update() {
      const time = now(); if (time < nextProbe) return;
      sent = time; nextProbe = time + 3000; answered.clear();
      send('volley:ping', { requester: self, nonce: ++nonce });
    },
    receive(sender: string, kind: string, data: Record<string, unknown>) {
      if (kind === 'volley:ping') {
        if (data.requester === sender && Number.isSafeInteger(data.nonce)) send('volley:pong', { requester: sender, nonce: data.nonce });
        return true;
      }
      if (kind !== 'volley:pong') return false;
      if (data.requester === self && data.nonce === nonce && !answered.has(sender)) {
        const rtt = now() - sent;
        if (rtt >= 0 && rtt < 1500) { answered.add(sender); const sample = Math.min(.18, rtt / 2000); delay.set(sender, delay.has(sender) ? delay.get(sender)! * .65 + sample * .35 : sample); }
      }
      return true;
    },
    delay: (sender: string) => delay.get(sender) || 0,
  };
}

/** Project a packet to receipt time, retaining the same net collision and gravity rules. */
export function predictVolleyBall(state: VolleyballBallMotion, delay: number, gravity: number, radius: number) {
  const result = { ...state };
  for (let remaining = Math.min(.18, Math.max(0, delay)); remaining > 0;) {
    const step = Math.min(1 / 120, remaining); remaining -= step;
    stepVolleyballBall(result, gravity, step, radius);
    if (result.by <= radius) { result.by = radius; break; }
  }
  return result;
}

/** Small bounded extrapolation replaces waiting motionlessly for each movement packet. */
export function predictVolleyPlayer(position: { x: number; y: number; z: number }, velocity: { x: number; z: number }, age: number) {
  const ahead = Math.min(.12, Math.max(0, age));
  return { x: Math.max(-3.5, Math.min(3.5, position.x + velocity.x * ahead)), y: position.y, z: position.z + velocity.z * ahead };
}
