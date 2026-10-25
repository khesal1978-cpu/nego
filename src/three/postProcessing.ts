import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { effectivePixelRatio, gameplayPixelRatio, getVisualCompare, getVisualSettings, publishRenderMetrics, type VisualSettings } from './visualSettings';
import { createFrameBudget } from './frameBudget';
import { bindWebGLRecovery } from './webglRecovery';

export interface StylizedPostPipeline {
  setSize: (width: number, height: number) => void;
  render: (elapsedSec?: number) => void;
  dispose: () => void;
}

export function createStylizedPostPipeline(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
  width: number, height: number,
  options?: { bloomStrength?: number; bloomRadius?: number; bloomThreshold?: number; vignetteIntensity?: number; colorGrade?: boolean; saturation?: number; contrast?: number; preview?: boolean; detail?: boolean }
): StylizedPostPipeline {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options?.colorGrade ? 1.06 : 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (!options?.colorGrade) {
    const recovery = bindWebGLRecovery(renderer, scene, { resume: () => renderer.render(scene, camera) });
    return { setSize: () => {}, render: () => { if (recovery.ready()) renderer.render(scene, camera); }, dispose: () => recovery.dispose() };
  }

  const target = new THREE.WebGLRenderTarget(1, 1, { type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 0 });
  const composer = new EffectComposer(renderer, target);
  const gradeShader = {
    uniforms: {
      gradeEnabled: { value: true }, tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) },
      saturation: { value: 1 }, contrast: { value: 1 }, brightness: { value: 0 }, gamma: { value: 1 },
      warmth: { value: 0 }, tint: { value: 0 }, shadows: { value: 0 }, highlights: { value: 0 },
      shadowCoolness: { value: 0 }, highlightWarmth: { value: 0 },
      vignette: { value: 0 }, sharpness: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform bool gradeEnabled; uniform vec2 resolution;
      uniform float saturation, contrast, brightness, gamma, warmth, tint, shadows, highlights, vignette, sharpness, shadowCoolness, highlightWarmth;
      void main() {
        vec4 sampleColor = displaySample(vUv);
        if (!gradeEnabled) { gl_FragColor = sampleColor; return; }
        vec3 color = sampleColor.rgb;
        if (sharpness > 0.001) {
          vec3 blurred = (displaySample(vUv + vec2(resolution.x, 0.)).rgb + displaySample(vUv - vec2(resolution.x, 0.)).rgb
            + displaySample(vUv + vec2(0., resolution.y)).rgb + displaySample(vUv - vec2(0., resolution.y)).rgb) * .25;
          color += clamp(color - blurred, vec3(-.08), vec3(.08)) * sharpness;
        }
        float luma = dot(color, vec3(.2126, .7152, .0722));
        color += shadows * (1. - smoothstep(.0, .6, luma)) * .3 + highlights * smoothstep(.4, 1., luma) * .3;
        color *= vec3(1. + warmth * .12 + tint * .04, 1. - tint * .08, 1. - warmth * .12 + tint * .04);
        color += vec3(-.025, .013, .065) * shadowCoolness * (1. - smoothstep(.05, .65, luma));
        color += vec3(.055, .025, -.025) * highlightWarmth * smoothstep(.45, .95, luma);
        color = mix(vec3(dot(color, vec3(.2126, .7152, .0722))), color, saturation);
        color = pow(max((color - .5) * contrast + .5 + brightness, vec3(0.)), vec3(1. / gamma));
        vec2 edge = (vUv - .5) * 1.414;
        color *= 1. - vignette * smoothstep(.25, 1., dot(edge, edge));
        gl_FragColor = vec4(clamp(color, 0., 1.), sampleColor.a);
      }`,
  };
  const grade = new OutputPass();
  Object.assign(grade.uniforms, gradeShader.uniforms);
  // Output conversion and grading share a draw, preserving the existing order.
  const displayShader = grade.material.fragmentShader
    .replace('void main()', 'vec4 displaySample(vec2 sampleUv)')
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', 'vec4 displayColor = texture2D( tDiffuse, sampleUv );')
    .replaceAll('gl_FragColor', 'displayColor')
    .replace(/}\s*$/, 'return displayColor; }');
  grade.material.fragmentShader = displayShader + gradeShader.fragmentShader;
  grade.material.toneMapped = false;
  const fxaa = new ShaderPass(FXAAShader);
  fxaa.material.toneMapped = false;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(grade);
  composer.addPass(fxaa);
  let bloom: UnrealBloomPass | undefined;
  let lastSettings: VisualSettings | undefined;
  let lastCompare = false, sizeDirty = true;
  const originalIntensity = new WeakMap<THREE.Light, number>();
  const originalFog = scene.fog instanceof THREE.FogExp2 ? scene.fog.density : 0;
  const originalAutoReset = renderer.info.autoReset;
  renderer.info.autoReset = false;
  let frames = 0, sampleStart = 0;
  const resolution = new THREE.Vector2();
  const frameBudget = createFrameBudget();
  const compactDevice = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  renderer.shadowMap.autoUpdate = false;

  function applySettings(settings: VisualSettings, comparing: boolean) {
    const enabled = settings.enabled && !comparing;
    const tone = { aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping, agx: THREE.AgXToneMapping, linear: THREE.LinearToneMapping };
    renderer.toneMapping = enabled ? tone[settings.toneMapping] : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = enabled ? settings.exposure : 1.02;
    for (const key of ['saturation', 'contrast', 'brightness', 'gamma', 'warmth', 'tint', 'shadows', 'highlights', 'vignette', 'sharpness', 'shadowCoolness', 'highlightWarmth'] as const) grade.uniforms[key].value = settings[key];
    if (!compactDevice && options?.detail && frameBudget.scale >= .9) grade.uniforms.sharpness.value = Math.max(settings.sharpness, .1);
    else if (compactDevice) grade.uniforms.sharpness.value = 0;
    grade.uniforms.gradeEnabled.value = enabled;
    const samples = compactDevice ? 0 : Math.min(settings.msaa, renderer.capabilities.maxSamples, frameBudget.scale < .95 ? 0 : 2);
    fxaa.enabled = settings.fxaa && samples === 0;
    const useBloom = enabled && settings.bloom > 0 && !compactDevice && frameBudget.targetFps <= 60 && frameBudget.scale >= .9;
    // Only allocate the additional bloom targets while the effect is requested.
    if (useBloom && !bloom) {
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), settings.bloom, settings.bloomRadius, settings.bloomThreshold);
      composer.insertPass(bloom, 1);
      sizeDirty = true;
    } else if (!useBloom && bloom) { composer.removePass(bloom); bloom.dispose(); bloom = undefined; }
    if (bloom) { bloom.strength = settings.bloom; bloom.radius = settings.bloomRadius; bloom.threshold = settings.bloomThreshold; }

    const shadowSize = frameBudget.scale <= .85 ? 0 : Math.min(settings.shadowSize, compactDevice || frameBudget.scale <= .9 ? 512 : 1024);
    renderer.shadowMap.enabled = shadowSize > 0;
    scene.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      if (!originalIntensity.has(object)) originalIntensity.set(object, object.intensity);
      object.intensity = originalIntensity.get(object)! * (enabled ? (object instanceof THREE.HemisphereLight || object instanceof THREE.AmbientLight ? settings.ambient : settings.sunlight) : 1);
      const shadow = (object as THREE.DirectionalLight).shadow;
      if (shadow && object.castShadow && shadowSize > 0 && shadow.mapSize.x !== shadowSize) {
        shadow.mapSize.set(shadowSize, shadowSize);
        shadow.map?.dispose(); shadow.map = null;
        shadow.mapPass?.dispose(); shadow.mapPass = null;
        shadow.needsUpdate = true;
      }
    });
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = originalFog * (enabled ? settings.fog : 1);
    renderer.shadowMap.needsUpdate = true;
    const requestedRatio = gameplayPixelRatio(settings.pixelRatio, frameBudget.scale, compactDevice, options?.detail);
    const ratio = options?.preview ? 1 : effectivePixelRatio(width, height, window.devicePixelRatio, requestedRatio);
    if (composer.renderTarget1.samples !== samples) {
      for (const buffer of [composer.renderTarget1, composer.renderTarget2]) { buffer.dispose(); buffer.samples = samples; }
    }
    if (renderer.getPixelRatio() !== ratio || sizeDirty) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height);
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      renderer.getDrawingBufferSize(resolution);
      grade.uniforms.resolution.value.set(1 / resolution.x, 1 / resolution.y);
      fxaa.uniforms.resolution.value.copy(grade.uniforms.resolution.value);
      // Soft highlights do not need full-resolution blur targets.
      bloom?.setSize(Math.max(1, resolution.x / 2), Math.max(1, resolution.y / 2));
      sizeDirty = false;
    }
  }
  const pipeline: StylizedPostPipeline = {
    setSize: (w, h) => { width = Math.max(1, w); height = Math.max(1, h); sizeDirty = true; },
    render: () => {
      if (!recovery.ready()) return;
      const settings = getVisualSettings();
      const comparing = !options?.preview && getVisualCompare();
      if (settings !== lastSettings || comparing !== lastCompare || sizeDirty) {
        applySettings(settings, comparing); lastSettings = settings; lastCompare = comparing;
      }
      renderer.info.reset();
      // Shadows must use the same pose as the visible character, rather than
      // holding an old silhouette for several animation frames.
      if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
      composer.render();
      if (!options?.preview) {
        const now = performance.now();
        if (!sampleStart) sampleStart = now; else frames++;
        if (now - sampleStart >= 1000) {
          const elapsed = now - sampleStart;
          publishRenderMetrics({ fps: Math.round(frames * 1000 / elapsed), frameMs: Math.round(elapsed / Math.max(1, frames) * 10) / 10, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: renderer.domElement.width, height: renderer.domElement.height });
          const previousTarget = frameBudget.targetFps;
          if (elapsed < 1600 && frames >= 2 && frameBudget.sample(frames * 1000 / elapsed)) sizeDirty = true;
          if (frameBudget.targetFps !== previousTarget) sizeDirty = true;
          frames = 0; sampleStart = now;
        }
      }
    },
    dispose: () => {
      recovery.dispose();
      bloom?.dispose(); grade.dispose(); fxaa.dispose(); composer.dispose();
      renderer.info.autoReset = originalAutoReset;
    },
  };
  const recovery = bindWebGLRecovery(renderer, scene, {
    restored: () => {
      if (bloom) { composer.removePass(bloom); bloom.dispose(); bloom = undefined; }
      composer.reset(); grade.material.needsUpdate = true; fxaa.material.needsUpdate = true;
      lastSettings = undefined; sizeDirty = true;
    },
    resume: () => pipeline.render(),
  });
  return pipeline;
}
