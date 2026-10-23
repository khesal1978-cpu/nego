export const VISUAL_RANGES = {
  exposure: [0.5, 1.8, 0.01], saturation: [0, 1.8, 0.01], contrast: [0.7, 1.4, 0.01],
  brightness: [-0.2, 0.2, 0.01], gamma: [0.7, 1.5, 0.01], warmth: [-1, 1, 0.02], tint: [-1, 1, 0.02],
  shadows: [-0.4, 0.4, 0.01], highlights: [-0.4, 0.4, 0.01],
  shadowCoolness: [0, 1, 0.02], highlightWarmth: [0, 1, 0.02],
  bloom: [0, 1.2, 0.02], bloomRadius: [0, 1, 0.02], bloomThreshold: [0.4, 1.5, 0.02],
  vignette: [0, 0.6, 0.01], sharpness: [0, 0.5, 0.01],
  sunlight: [0.4, 1.6, 0.02], ambient: [0.4, 1.6, 0.02], fog: [0, 2, 0.05],
  pixelRatio: [0.75, 2, 0.05],
} as const;
export type VisualNumber = keyof typeof VISUAL_RANGES;
export type VisualSettings = Record<VisualNumber, number> & {
  enabled: boolean; hud: boolean; fxaa: boolean;
  toneMapping: 'aces' | 'neutral' | 'agx' | 'linear';
  msaa: 0 | 2 | 4; shadowSize: 0 | 512 | 1024 | 2048;
};
export const DEFAULT_VISUAL_SETTINGS: Readonly<VisualSettings> = Object.freeze({
  enabled: true, hud: true, fxaa: true, toneMapping: 'aces',
  exposure: 1.06, saturation: 1.14, contrast: 1.14, brightness: 0, gamma: 1.03, warmth: .03, tint: -.04,
  shadows: .04, highlights: -.08, shadowCoolness: .24, highlightWarmth: .16,
  bloom: .26, bloomRadius: .62, bloomThreshold: 1.08,
  vignette: .08, sharpness: 0, sunlight: 1.1, ambient: 1.04, fog: 1.2,
  pixelRatio: 2, msaa: 4, shadowSize: 2048,
});
// Keep the user's exact exported look available for a direct comparison.
export const SHARED_VISUAL_LOOK: Readonly<VisualSettings> = Object.freeze({
  ...DEFAULT_VISUAL_SETTINGS, exposure: 1.03, saturation: 1.07, contrast: 1.29, brightness: -.01,
  gamma: 1, warmth: -.14, tint: -.34, shadows: -.09, highlights: .24,
  shadowCoolness: 0, highlightWarmth: 0, bloom: .86, bloomRadius: .62, bloomThreshold: 1,
  vignette: .19, sharpness: .21, sunlight: 1.1, ambient: .8, fog: 1.75, pixelRatio: 2, msaa: 4, shadowSize: 2048,
});
export const QUALITY_PRESETS = {
  smooth: { pixelRatio: 1, msaa: 0, fxaa: true, shadowSize: 512, bloom: 0 },
  balanced: { pixelRatio: 1.65, msaa: 2, fxaa: true, shadowSize: 1024, bloom: 0 },
  detailed: { pixelRatio: 2, msaa: 4, fxaa: false, shadowSize: 2048 },
} satisfies Record<string, Partial<VisualSettings>>;
// New art direction is the default; the previous tuning remains under its v1 key.
const storageKey = 'donag-visual-tuning-v2';

export function normalizeVisualSettings(input: unknown): VisualSettings {
  const result = { ...DEFAULT_VISUAL_SETTINGS };
  if (!input || typeof input !== 'object') return result;
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(VISUAL_RANGES) as VisualNumber[]) {
    const n = value[key];
    if (typeof n === 'number' && Number.isFinite(n)) {
      const [min, max] = VISUAL_RANGES[key];
      result[key] = Math.min(max, Math.max(min, n));
    }
  }
  for (const key of ['enabled', 'hud', 'fxaa'] as const) if (typeof value[key] === 'boolean') result[key] = value[key];
  if (['aces', 'neutral', 'agx', 'linear'].includes(String(value.toneMapping))) result.toneMapping = value.toneMapping as VisualSettings['toneMapping'];
  if ([0, 2, 4].includes(value.msaa as number)) result.msaa = value.msaa as VisualSettings['msaa'];
  if ([0, 512, 1024, 2048].includes(value.shadowSize as number)) result.shadowSize = value.shadowSize as VisualSettings['shadowSize'];
  return result;
}
let settings = { ...DEFAULT_VISUAL_SETTINGS };
try { if (typeof localStorage !== 'undefined') settings = normalizeVisualSettings(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch { /* Storage is optional. */ }
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
export const getVisualSettings = () => settings;
export const subscribeVisualSettings = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function updateVisualSettings(patch: Partial<VisualSettings>) {
  settings = normalizeVisualSettings({ ...settings, ...patch });
  for (const listener of listeners) listener();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Live tuning still works without storage. */ } }, 200);
}
export const resetVisualSettings = () => updateVisualSettings({ ...DEFAULT_VISUAL_SETTINGS });
let compare = false;
export const setVisualCompare = (value: boolean) => { compare = value; };
export const getVisualCompare = () => compare;
export function visualSettingsExport(context: string) {
  return JSON.stringify({ version: 2, context, settings }, null, 2);
}
export function effectivePixelRatio(width: number, height: number, deviceRatio: number, requested: number) {
  // Bound the framebuffer as well as DPR, including large desktop displays.
  return Math.max(0.5, Math.min(deviceRatio || 1, Math.max(1, requested), Math.sqrt(3_000_000 / Math.max(1, width * height))));
}
export function gameplayPixelRatio(requested: number, scale: number, _touch: boolean, _detail = false) {
  // Preserve fine edges during a match, including on phones. Explicit low presets still work.
  const quality = Math.min(2, Math.max(1, requested));
  return Math.max(Math.min(quality, 1.65), quality * Math.max(.85, Math.min(1, scale)));
}
export type RenderMetrics = { fps: number; frameMs: number; calls: number; triangles: number; width: number; height: number };
let metrics: RenderMetrics | null = null;
const metricListeners = new Set<() => void>();
export const getRenderMetrics = () => metrics;
export const subscribeRenderMetrics = (listener: () => void) => { metricListeners.add(listener); return () => { metricListeners.delete(listener); }; };
export const publishRenderMetrics = (value: RenderMetrics) => { metrics = value; for (const listener of metricListeners) listener(); };
