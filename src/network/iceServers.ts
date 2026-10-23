export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];
export function normalizeIceServers(value: unknown): RTCIceServer[] {
  if (!Array.isArray(value)) return [...DEFAULT_ICE_SERVERS];
  const result: RTCIceServer[] = [];
  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue;
    const urls = (Array.isArray(item.urls) ? item.urls : [item.urls]).filter((url: unknown): url is string => typeof url === 'string' && /^(stun|stuns|turn|turns):[^\s@]+$/i.test(url) && !/:53(?:\?|$)/.test(url)).slice(0, 8);
    if (!urls.length) continue;
    if (urls.some((url: string) => /^turns?:/i.test(url))) {
      if (typeof item.username !== 'string' || typeof item.credential !== 'string' || !item.username || !item.credential) continue;
      result.push({ urls, username: item.username, credential: item.credential });
    } else result.push({ urls });
  }
  return result.length ? result : [...DEFAULT_ICE_SERVERS];
}
