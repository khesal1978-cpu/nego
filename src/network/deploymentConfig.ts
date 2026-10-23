declare const __SIXZUN_MULTIPLAYER_URL__: string;
declare const __SIXZUN_PUBLIC_MQTT__: boolean;

export function normalizeBackendOrigin(value: string) {
  if (!value.trim()) return '';
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) throw new Error('VITE_MULTIPLAYER_URL must be an HTTP(S) origin without a path or credentials.');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('The deployed multiplayer backend must use HTTPS.');
  return url.origin;
}
const configuredOrigin = typeof __SIXZUN_MULTIPLAYER_URL__ === 'string' ? normalizeBackendOrigin(__SIXZUN_MULTIPLAYER_URL__) : '';
export const PUBLIC_MQTT_ENABLED = typeof __SIXZUN_PUBLIC_MQTT__ !== 'undefined' && __SIXZUN_PUBLIC_MQTT__;
export const multiplayerApi = (path: string) => configuredOrigin + path;
export function multiplayerSocket(location: { protocol: string; host: string }) {
  const origin = configuredOrigin || `${location.protocol}//${location.host}`;
  return origin.replace(/^http/, 'ws') + '/ws';
}
