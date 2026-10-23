import * as THREE from 'three';

export const WEATHER_OPTIONS = [
  { id: 'normal', name: 'Normal', detail: 'Clear skies' },
  { id: 'rain', name: 'Rain', detail: 'Light showers' },
  { id: 'snow', name: 'Snow', detail: 'Soft snowflakes' },
  { id: 'cold', name: 'Cold', detail: 'Gentle frost mist' },
  { id: 'auto', name: 'Auto', detail: 'Weather changes slowly' },
] as const;
export type WeatherId = typeof WEATHER_OPTIONS[number]['id'];
export function normalizeWeather(value: unknown): WeatherId { return WEATHER_OPTIONS.some(option => option.id === value) ? value as WeatherId : 'normal'; }
let selected: WeatherId = 'normal';
try { selected = normalizeWeather(localStorage.getItem('sixzun_weather')) === 'normal' ? 'normal' : 'auto'; } catch {}
const listeners = new Set<() => void>();
export const getWeather = () => selected;
export const subscribeWeather = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export function setWeather(value: WeatherId) {
  selected = normalizeWeather(value);
  try { localStorage.setItem('sixzun_weather', selected); } catch {}
  listeners.forEach(callback => callback());
}
export function weatherAtTime(choice: WeatherId, seconds: number): Exclude<WeatherId, 'auto'> {
  if (choice !== 'auto') return choice;
  return (['normal', 'rain', 'normal', 'snow', 'cold', 'normal'] as const)[Math.floor(Math.max(0, seconds) / 65) % 6];
}

// Two batched draws at most; no terrain, physics, visibility or controls change.
export function createWeather(scene: THREE.Scene) {
  const count = 110;
  const offsets = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { offsets[i * 3] = (Math.random() - .5) * 54; offsets[i * 3 + 1] = Math.random() * 18; offsets[i * 3 + 2] = (Math.random() - .5) * 54; }
  const drops = new Float32Array(count * 6);
  const flakes = new Float32Array(count * 3);
  const rainGeometry = new THREE.BufferGeometry();
  const snowGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(drops, 3).setUsage(THREE.DynamicDrawUsage));
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(flakes, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#b0dceb', transparent: true, opacity: 0, depthWrite: false });
  const snowMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { opacity: { value: 0 }, pointSize: { value: 4 }, tint: { value: new THREE.Color('#e7f6ff') } }, vertexShader: 'uniform float pointSize; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_PointSize = pointSize; }', fragmentShader: 'uniform float opacity; uniform vec3 tint; void main(){ float d=length(gl_PointCoord-vec2(.5)); float a=smoothstep(.5,.12,d)*opacity; if(a<.001) discard; gl_FragColor=vec4(tint,a); }' });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  const snow = new THREE.Points(snowGeometry, snowMaterial);
  const group = new THREE.Group(); group.name = 'Optional light weather'; group.add(rain, snow); scene.add(group);
  rain.frustumCulled = false; snow.frustumCulled = false;
  let elapsed = 0;
  return {
    update(dt: number, camera: THREE.Camera, enabled = true) {
      elapsed += Math.min(Math.max(dt, 0), .1);
      const kind = enabled ? weatherAtTime(getWeather(), elapsed) : 'normal';
      const blend = Math.min(1, Math.max(0, dt) * 2);
      rainMaterial.opacity = THREE.MathUtils.lerp(rainMaterial.opacity, kind === 'rain' ? .22 : 0, blend);
      snowMaterial.uniforms.opacity.value = THREE.MathUtils.lerp(snowMaterial.uniforms.opacity.value, kind === 'snow' ? .48 : kind === 'cold' ? .018 : 0, blend);
      rain.visible = rainMaterial.opacity > .001;
      snow.visible = snowMaterial.uniforms.opacity.value > .001;
      snowMaterial.uniforms.pointSize.value = kind === 'cold' ? 110 : 4;
      if (!rain.visible && !snow.visible) return;
      const cx = THREE.MathUtils.clamp(camera.position.x, -18, 18), cz = THREE.MathUtils.clamp(camera.position.z - 5, -18, 18);
      for (let i = 0; i < count; i++) {
        const p = i * 3, line = i * 6;
        offsets[p + 1] -= Math.min(dt, .1) * (kind === 'rain' ? 11 : kind === 'snow' ? 1.15 : .18);
        if (offsets[p + 1] < .2) offsets[p + 1] += 18;
        const x = cx + offsets[p] + Math.sin(elapsed * .3 + i) * .5, y = offsets[p + 1], z = cz + offsets[p + 2];
        flakes[p] = x; flakes[p + 1] = kind === 'cold' ? y * .17 + .5 : y; flakes[p + 2] = z;
        drops[line] = x; drops[line + 1] = y; drops[line + 2] = z;
        drops[line + 3] = x - .07; drops[line + 4] = y + .48; drops[line + 5] = z;
      }
      rainGeometry.attributes.position.needsUpdate = true; snowGeometry.attributes.position.needsUpdate = true;
    },
    dispose() { group.removeFromParent(); rainGeometry.dispose(); snowGeometry.dispose(); rainMaterial.dispose(); snowMaterial.dispose(); },
  };
}
