import * as THREE from 'three';

/** Reupload CPU-backed textures and invalidate handles owned by the old context. */
export function refreshSceneResources(scene: THREE.Scene) {
  const textures = new Set<THREE.Texture>(), materials = new Set<THREE.Material>();
  if (scene.background instanceof THREE.Texture) textures.add(scene.background);
  if (scene.environment) textures.add(scene.environment);
  scene.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
      if (object instanceof THREE.SkinnedMesh && object.skeleton.boneTexture) textures.add(object.skeleton.boneTexture);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        if (material instanceof THREE.ShaderMaterial) for (const uniform of Object.values(material.uniforms)) if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
      }
      for (const attribute of Object.values(object.geometry.attributes) as (THREE.BufferAttribute | THREE.InterleavedBufferAttribute)[]) attribute.needsUpdate = true;
      if (object.geometry.index) object.geometry.index.needsUpdate = true;
    }
    const shadow = (object as THREE.DirectionalLight).shadow;
    if (shadow) {
      shadow.map?.dispose(); shadow.map = null;
      shadow.mapPass?.dispose(); shadow.mapPass = null;
      shadow.needsUpdate = true;
    }
  });
  textures.forEach(texture => { texture.needsUpdate = true; });
  materials.forEach(material => { material.needsUpdate = true; });
}

/** Mobile browsers may evict WebGL while backgrounded. Restore the existing match. */
export function bindWebGLRecovery(renderer: THREE.WebGLRenderer, scene: THREE.Scene, options: {
  resume: () => void; restored?: () => void; lost?: () => void;
}) {
  const canvas = renderer.domElement;
  // Headless simulation boundaries do not expose DOM event targets.
  if (!canvas?.addEventListener || typeof window === 'undefined' || !document.addEventListener) return { ready: () => true, dispose() {} };
  let lost = false, disposed = false, attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let overlay: HTMLDivElement | undefined;
  const showRecovery = () => {
    if (overlay || !canvas.parentElement) return;
    overlay = document.createElement('div');
    overlay.setAttribute('role', 'status');
    overlay.style.cssText = 'position:absolute;inset:0;z-index:190;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#092633;color:#fff9e5;font:700 16px system-ui;text-align:center;padding:20px';
    const message = document.createElement('span'); message.textContent = 'Restoring graphics…'; overlay.appendChild(message);
    canvas.parentElement.appendChild(overlay);
  };
  const requestRestore = () => {
    clearTimeout(timer);
    if (disposed || document.hidden || !lost) return;
    attempts++;
    try { renderer.forceContextRestore(); } catch { /* The browser may already be restoring it. */ }
    if (attempts < 3) timer = setTimeout(requestRestore, 1000);
    else if (overlay && !overlay.querySelector('button')) {
      const button = document.createElement('button'); button.textContent = 'Reload game';
      button.style.cssText = 'min-height:44px;padding:10px 20px;border:0;border-radius:10px;background:#ffeaa3;color:#173948;font:800 14px system-ui;cursor:pointer';
      button.onclick = () => window.location.reload(); overlay.appendChild(button);
    }
  };
  const contextLost = (event: Event) => {
    event.preventDefault(); lost = true; attempts = 0;
    options.lost?.(); showRecovery();
    clearTimeout(timer); timer = setTimeout(requestRestore, 500);
  };
  const restored = () => {
    if (disposed) return;
    lost = false; attempts = 0; clearTimeout(timer);
    renderer.setRenderTarget(null);
    refreshSceneResources(scene); renderer.shadowMap.needsUpdate = true;
    options.restored?.();
    options.resume();
    overlay?.remove(); overlay = undefined;
  };
  const resume = () => {
    if (disposed || document.hidden) return;
    if (lost || renderer.getContext().isContextLost()) { lost = true; attempts = 0; showRecovery(); requestRestore(); }
    else options.resume(); // Repaint paused/menu scenes too, even when no props changed.
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', restored);
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', resume);
  return {
    ready: () => !lost && !disposed,
    dispose() {
      disposed = true; clearTimeout(timer); overlay?.remove();
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', restored);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
    },
  };
}
