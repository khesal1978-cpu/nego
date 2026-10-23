/** Give brief mobile handovers time to recover; bound ICE renegotiations while
 * the existing WebSocket fallback continues carrying game traffic. */
export function watchIceRecovery(pc: RTCPeerConnection, refresh: () => void, clock = {
  set: (callback: () => void, ms: number) => window.setTimeout(callback, ms),
  clear: (timer: number) => window.clearTimeout(timer),
}) {
  let timer: number | undefined, attempts = 0;
  const cancel = () => { if (timer !== undefined) clock.clear(timer); timer = undefined; };
  const change = () => {
    if (pc.connectionState === 'connected') { attempts = 0; cancel(); return; }
    if (pc.connectionState === 'closed') { cancel(); return; }
    if (!['failed', 'disconnected'].includes(pc.connectionState) || timer !== undefined || attempts >= 2) return;
    timer = clock.set(() => {
      timer = undefined;
      if (!['failed', 'disconnected'].includes(pc.connectionState)) return;
      attempts++; refresh();
      try { pc.restartIce(); } catch { /* Older browsers retain WebSocket fallback. */ }
    }, pc.connectionState === 'failed' ? 1000 : 4000);
  };
  pc.onconnectionstatechange = change;
  return () => { cancel(); pc.onconnectionstatechange = null; };
}
