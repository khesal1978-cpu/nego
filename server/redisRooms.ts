import { createRoomEngine, type RoomNotice, type RoomSnapshot } from './roomEngine';
import { randomUUID } from 'node:crypto';

export type RoomRecord = { epoch: string; revision: number; snapshot: RoomSnapshot };
export type RoomCommit = { kind: 'commit'; epoch: string; revision: number; notices: RoomNotice[] };
export interface RoomStore {
  read(): Promise<RoomRecord>;
  update<T>(change: (engine: ReturnType<typeof createRoomEngine>) => T): Promise<{ value: T; commit: RoomCommit }>;
  publish(message: unknown): Promise<void>;
  subscribe(message: (value: any) => void, connected: () => Promise<void>, signal: AbortSignal): Promise<void>;
}

export function redisEnvironment(env: Record<string, string | undefined>) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Redis REST URL must be an HTTPS origin.');
  return { url: parsed.origin, token, namespace: env.REDIS_NAMESPACE || `sixzun:${env.VERCEL_PROJECT_ID || 'game'}:${env.VERCEL_ENV || 'development'}` };
}

export const COMMIT_ROOMS = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', 7200)
redis.call('PUBLISH', KEYS[2], ARGV[3])
return 1`;

/** One atomic commit owns room membership. Retrying a conflict recomputes the
 * action against fresh state, so simultaneous joins never overwrite a player. */
export function createRedisRoomStore(config: NonNullable<ReturnType<typeof redisEnvironment>>, request: typeof fetch = fetch): RoomStore {
  const stateKey = `${config.namespace}:rooms`, channel = `${config.namespace}:events`;
  const headers = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' };
  async function command(args: unknown[]) {
    const response = await request(config.url, { method: 'POST', headers, body: JSON.stringify(args), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw Error('Room storage is unavailable. Please try again shortly.');
    const body = await response.json();
    if (body.error) throw Error('Room storage rejected the request. Check the Redis plan and connection.');
    return body.result;
  }
  const decode = (raw: string | null): RoomRecord => raw ? JSON.parse(raw) : { epoch: '', revision: 0, snapshot: { rooms: [], clients: [] } };
  return {
    async read() { return decode(await command(['GET', stateKey])); },
    async update(change) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const raw: string | null = await command(['GET', stateKey]);
        const previous = decode(raw), notices: RoomNotice[] = [];
        const engine = createRoomEngine(previous.snapshot, notice => notices.push(notice));
        for (const client of engine.clients.values()) if (Date.now() - client.lastSeenAt > 90000) {
          engine.removePlayerFromCurrentRoom(client); engine.clients.delete(client.playerId);
        }
        const value = change(engine);
        const snapshot = engine.snapshot();
        // Bound accidental/abusive growth of the shared lobby document.
        if (snapshot.rooms.length > 150 || snapshot.clients.length > 750) throw Error('The lobby is busy. Please try again later.');
        const next = { epoch: previous.epoch || randomUUID(), revision: previous.revision + 1, snapshot };
        // Expiring many players should publish one final notice per room/list.
        const compact = new Map<string, RoomNotice>();
        for (const notice of notices) compact.set(`${notice.type}:${notice.room?.code || notice.code || ''}`, notice);
        const commit: RoomCommit = { kind: 'commit', epoch: next.epoch, revision: next.revision, notices: [...compact.values()] };
        if (await command(['EVAL', COMMIT_ROOMS, 2, stateKey, channel, raw || '', JSON.stringify(next), JSON.stringify(commit)])) return { value, commit };
      }
      throw Error('The room changed while updating. Please try again.');
    },
    async publish(message) { await command(['PUBLISH', channel, JSON.stringify(message)]); },
    async subscribe(message, connected, signal) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      const deadline = setTimeout(abort, 10000); deadline.unref();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
      const response = await request(`${config.url}/subscribe/${encodeURIComponent(channel)}`, {
        method: 'POST', headers: { Authorization: headers.Authorization, Accept: 'text/event-stream' }, signal: controller.signal,
      });
      if (!response.ok || !response.body) throw Error('Room event connection is unavailable.');
      // Read after subscribing, so a change between GET and subscription cannot be lost.
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '', started = false;
        while (!signal.aborted) {
          const { value, done } = await reader.read(); if (done) break;
          pending += decoder.decode(value, { stream: true });
          if (pending.length > 2_000_000) throw Error('Room event exceeded size limit.');
          let end: number;
          while ((end = pending.indexOf('\n')) >= 0) {
            const line = pending.slice(0, end).replace(/\r$/, ''); pending = pending.slice(end + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trimStart();
            if (!started && data.startsWith(`subscribe,${channel},`)) { started = true; clearTimeout(deadline); await connected(); }
            const prefix = `message,${channel},`;
            if (data.startsWith(prefix)) { try { message(JSON.parse(data.slice(prefix.length))); } catch { /* Ignore incomplete events. */ } }
          }
        }
      } finally { clearTimeout(deadline); signal.removeEventListener('abort', abort); await reader?.cancel().catch(() => {}); }
      if (!signal.aborted) throw Error('Room event connection closed.');
    },
  };
}
