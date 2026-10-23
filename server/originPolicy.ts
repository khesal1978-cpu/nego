export function createOriginPolicy(origins: string | undefined, production: boolean) {
  const allowed = new Set((origins || '').split(',').map(value => value.trim()).filter(Boolean).map(value => new URL(value).origin));
  return (origin: string | undefined, host: string | undefined) => {
    if (!origin) return true; // Health checks and command-line deployment probes.
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
      return allowed.has(origin) || parsed.host === host || (!production && allowed.size === 0);
    } catch { return false; }
  };
}
