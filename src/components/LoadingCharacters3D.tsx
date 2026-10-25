import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CRAYON_CHARACTERS } from '../types/game';
import { createCrayonCharacter } from '../three/crayonModels';
import { animateMenuEmote } from '../three/menuEmotes';
import { disposeSceneGeometry } from '../three/scenePerformance';
import { effectivePixelRatio } from '../three/visualSettings';
import { createArenaWeapon } from '../three/arenaProps';
import { bindWebGLRecovery } from '../three/webglRecovery';

export type LoadingPresentation = 'cast' | 'gun';

export function createLoadingCast(ids: readonly string[], anisotropy = 1) {
  return ids.map((id, index) => {
    const config = CRAYON_CHARACTERS.find(character => character.id === id)!;
    const rig = createCrayonCharacter(config, anisotropy, 1);
    rig.root.position.set((index - (ids.length - 1) / 2) * 1.55, 0, 0);
    rig.root.rotation.y = (index - (ids.length - 1) / 2) * -.16;
    rig.shadowMesh.visible = false;
    rig.root.updateWorldMatrix(true, true);
    return rig;
  });
}

export function createLoadingGunHero(id: string, anisotropy = 1) {
  const rig = createLoadingCast([id], anisotropy)[0];
  rig.root.rotation.y = -.55;
  rig.rightArm.rotation.set(-1.12, -.22, -.18);
  rig.leftArm.rotation.set(-1.18, .52, .25);
  const gun = createArenaWeapon('assault', '#b4d776');
  gun.position.set(.11, .67, .27);
  rig.bodyGroup.add(gun);
  return rig;
}

/** Fit the face, shoulders and held gun; deliberately crop only the lower legs. */
export function loadingGunFraming(rig: ReturnType<typeof createLoadingGunHero>) {
  const yaw = rig.bodyGroup.rotation.y;
  const bounds = new THREE.Box3();
  for (const angle of [-.025, 0, .025]) {
    rig.bodyGroup.rotation.y = angle;
    rig.root.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(rig.bodyGroup));
  }
  rig.bodyGroup.rotation.y = yaw;
  rig.root.updateMatrixWorld(true);
  bounds.min.y = Math.max(bounds.min.y, bounds.max.y - 1.38);
  return bounds.expandByScalar(.075);
}

/** One WebGL canvas for the whole squad; scene changes reuse its context. */
export function LoadingCharacters3D({ characters, onReady, presentation = 'cast' }: { characters: readonly string[]; onReady: () => void; presentation?: LoadingPresentation }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const updateCast = useRef<((ids: readonly string[], mode: LoadingPresentation) => void) | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setUnavailable(true);
      readyRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#e3f1ff', '#718297', 1.2));
    const key = new THREE.DirectionalLight('#fff2df', 2.1); key.position.set(3, 5, 6); scene.add(key);
    const rim = new THREE.DirectionalLight('#77cfff', .9); rim.position.set(-4, 2, -3); scene.add(rim);
    const camera = new THREE.OrthographicCamera(-3, 3, 1.65, -1.65, .1, 30);
    camera.position.set(0, 1.25, 9); camera.lookAt(0, 1.25, 0);
    let castScene = new THREE.Scene(); scene.add(castScene);
    let cast: ReturnType<typeof createLoadingCast> = [];
    let castWidth = 5;
    let castHeight = 3.3;
    let mode: LoadingPresentation = 'cast';
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(effectivePixelRatio(width, height, window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      const aspect = width / height;
      const halfHeight = Math.max(castHeight / 2, castWidth / aspect / 2);
      camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
      camera.top = halfHeight; camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
    };
    updateCast.current = (ids, nextMode) => {
      disposeSceneGeometry(castScene); scene.remove(castScene);
      castScene = new THREE.Scene(); scene.add(castScene);
      mode = nextMode;
      const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      cast = mode === 'gun' ? [createLoadingGunHero(ids[0], anisotropy)] : createLoadingCast(ids, anisotropy);
      cast.forEach(rig => castScene.add(rig.root));
      const bounds = mode === 'gun' ? loadingGunFraming(cast[0]) : new THREE.Box3().setFromObject(castScene);
      castWidth = mode === 'gun' ? bounds.max.x - bounds.min.x : Math.max(ids.length * 1.65, bounds.max.x - bounds.min.x + .7);
      castHeight = mode === 'gun' ? bounds.max.y - bounds.min.y : 3.3;
      const center = mode === 'gun' ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 1.25, 0);
      camera.position.set(center.x, center.y, 9); camera.lookAt(center.x, center.y, 0);
      resize();
    };
    const observer = new ResizeObserver(resize); observer.observe(host);
    const recovery = bindWebGLRecovery(renderer, scene, {
      resume: () => { resize(); renderer.render(scene, camera); },
      lost: () => { setUnavailable(true); readyRef.current(); },
      restored: () => setUnavailable(false),
    });
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = 0, started = 0, ready = false;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || !recovery.ready() || now - last < 1000 / 30 || !cast.length) return;
      if (!started) started = now;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const elapsed = (now - started) / 1000;
      cast.forEach((rig, index) => {
        rig.root.position.y = 0;
        if (mode === 'gun') {
          // Keep both hands on the weapon; only a subtle breathing motion.
          rig.bodyGroup.rotation.y = motion.matches ? 0 : Math.sin(elapsed * .8) * .025;
          rig.headGroup.rotation.z = motion.matches ? 0 : Math.sin(elapsed * .9) * .012;
        } else {
          animateMenuEmote(rig, elapsed + 1.2 + index * 8, dt, motion.matches, 0);
          rig.bodyGroup.rotation.y = motion.matches ? 0 : Math.sin(elapsed * 1.1 + index) * .08;
        }
      });
      renderer.render(scene, camera);
      if (!ready) { ready = true; readyRef.current(); }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); updateCast.current = null; recovery.dispose();
      disposeSceneGeometry(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);
  useEffect(() => { updateCast.current?.(characters, presentation); }, [characters, presentation]);
  const names = characters.map(id => CRAYON_CHARACTERS.find(character => character.id === id)!.name).join(', ');
  return <div ref={hostRef} className="loader-characters-3d" role="img" aria-label={`${names}, animated 3D game characters${presentation === 'gun' ? ', close-up holding a gun' : ''}`}>
    {unavailable && <span className="loader-3d-fallback">Opening Bonk Up…</span>}
  </div>;
}
