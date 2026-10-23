import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ObstacleRushCanvas } from './ObstacleRushCanvas';
import { FloorIsLavaCanvas } from './FloorIsLavaCanvas';
import { VolleyballCanvas } from './VolleyballCanvas';
import { CRAYON_CHARACTERS, type CourtTheme, type FloorIsLavaMapConfig, type ObstacleRushMapConfig } from '../types/game';
import { getVisualSettings, subscribeVisualSettings } from '../three/visualSettings';

const CACHE_KEY = 'sixzun-map-snapshots-v6';
const snapshots = new Map<string, string>();
try {
  for (const oldKey of ['sixzun-map-snapshots-v1', 'sixzun-map-snapshots-v2', 'sixzun-map-snapshots-v3', 'sixzun-map-snapshots-v4', 'sixzun-map-snapshots-v5']) localStorage.removeItem(oldKey);
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  if (Array.isArray(cached)) for (const entry of cached.slice(-10)) {
    if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].startsWith('data:image/')) snapshots.set(entry[0], entry[1]);
  }
} catch { /* Private browsing or storage limits still allow in-memory previews. */ }
const listeners = new Set<() => void>();
const subscribe = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
const pending: Array<{ start: () => void }> = [];
let rendering: { start: () => void } | undefined;
function schedule(start: () => void) {
  const job = { start };
  pending.push(job);
  const next = () => { if (!rendering && pending.length) { rendering = pending.shift(); rendering?.start(); } };
  queueMicrotask(next);
  return () => { const index = pending.indexOf(job); if (index >= 0) pending.splice(index, 1); if (rendering === job) rendering = undefined; queueMicrotask(next); };
}
const noop = () => {};
const player = CRAYON_CHARACTERS[0];
type Props = { kind: 'gun'; map: ObstacleRushMapConfig } | { kind: 'nuke'; map: FloorIsLavaMapConfig } | { kind: 'court'; map: CourtTheme };

export function ActualMapThumbnail(props: Props) {
  const visualSettings = useSyncExternalStore(subscribeVisualSettings, getVisualSettings, getVisualSettings);
  const id = `${props.kind}:${props.map.id}:${props.kind === 'court' ? '' : JSON.stringify(visualSettings)}`;
  const src = useSyncExternalStore(subscribe, () => snapshots.get(id), () => undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [failedId, setFailedId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const actions = useRef({ spikeRequested: false, diveRequested: false, superRequested: false });
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: '80px' });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (src) { setActiveId(null); return; }
    if (!visible || failedId === id) { setActiveId(null); return; }
    return schedule(() => setActiveId(id));
  }, [id, src, visible, failedId]);
  useEffect(() => {
    if (activeId !== id || src) return;
    const timeout = window.setTimeout(() => { setFailedId(id); setActiveId(null); }, 8000);
    return () => window.clearTimeout(timeout);
  }, [activeId, id, src]);
  const ready = useCallback((image: string) => {
    snapshots.set(id, image);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify([...snapshots].slice(-10))); } catch { /* Cache is optional. */ }
    for (const listener of listeners) listener();
  }, [id]);
  return <div ref={root} className="actual-map-thumbnail" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#06243c' }}>
    {src ? <img src={src} alt={props.map.name} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div className="map-preview-placeholder" role="status" aria-label={`Loading ${props.map.name} preview`}><span>{failedId === id ? 'Preview unavailable' : 'Loading arena…'}</span></div>}
    {activeId === id && !src && <div key={id} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 640, height: 360, opacity: 0, pointerEvents: 'none' }}>
      {props.kind === 'gun' ? <ObstacleRushCanvas onPreview={ready} gameState="MODE_SELECT" playerChar={player} rushMap={props.map} difficulty="breezy" cameraPreset="dynamic_follow" gameSpeedMultiplier={1} cameraFov={45} enableVfx={false} enableScreenShake={false} actionTriggerRef={actions} onHudUpdate={noop} onCallout={noop} onRaceFinished={noop} /> : props.kind === 'nuke' ? <FloorIsLavaCanvas onPreview={ready} gameState="MODE_SELECT" playerCharacter={player} aiDifficulty="breezy" cameraPreset="dynamic_follow" lavaMapId={props.map.id} onHudUpdate={noop} onGameOver={noop} /> : <VolleyballCanvas onPreview={ready} gameState="MODE_SELECT" gameMode="duo_2v2" playerChar={player} partnerChar={CRAYON_CHARACTERS[1]} aiChar1={CRAYON_CHARACTERS[2]} aiChar2={CRAYON_CHARACTERS[3]} is2v2 theme={props.map} difficulty="breezy" modifier="none" cameraPreset="dynamic_follow" servingSide="player" actionTriggerRef={actions} onRallyUpdate={noop} onPointFinished={noop} onBonusScore={noop} onCallout={noop} superCharge={0} />}
    </div>}
  </div>;
}
