import { DEFAULT_ICE_SERVERS, normalizeIceServers } from '../src/network/iceServers.js';

export function createTurnCredentials(env: Record<string, string | undefined>, request: typeof fetch = (...args) => fetch(...args), now = Date.now) {
  const key = env.CLOUDFLARE_TURN_KEY_ID, token = env.CLOUDFLARE_TURN_API_TOKEN;
  const cache = new Map<string, { until: number; value: { iceServers: RTCIceServer[]; expiresIn: number; relay: boolean } }>();
  const pending = new Map<string, Promise<{ iceServers: RTCIceServer[]; expiresIn: number; relay: boolean }>>();
  const fallback = () => ({ iceServers: [...DEFAULT_ICE_SERVERS], expiresIn: 60, relay: false });
  return {
    configured: Boolean(key && token),
    async get(player: string) {
      if (!key || !token) return fallback();
      const saved = cache.get(player);
      if (saved && saved.until > now()) return { ...saved.value, expiresIn: Math.floor((saved.until - now()) / 1000) + 300 };
      if (pending.has(player)) return pending.get(player)!;
      const work = (async () => {
        try {
          const response = await request(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 3600 }), signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) return fallback();
          const body = await response.json();
          const iceServers = normalizeIceServers(body.iceServers);
          const relay = iceServers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/.test(url)));
          const value = { iceServers, expiresIn: relay ? 3600 : 60, relay };
          for (const [id, entry] of cache) if (entry.until <= now()) cache.delete(id);
          if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
          if (relay) cache.set(player, { until: now() + 3300_000, value });
          return value;
        } catch { return fallback(); }
      })();
      pending.set(player, work);
      try { return await work; } finally { pending.delete(player); }
    },
    forget(player: string) { cache.delete(player); },
  };
}
