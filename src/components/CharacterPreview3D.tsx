import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CharacterConfig } from '../types/game';
import { createCrayonCharacter } from '../three/crayonModels';
import { disposeSceneGeometry } from '../three/scenePerformance';
import { effectivePixelRatio } from '../three/visualSettings';
import { animateMainMenuIdle } from '../three/menuEmotes';
import { characterPreviewBounds, characterPreviewDistance } from '../three/characterPreviewFraming';
import { bindWebGLRecovery } from '../three/webglRecovery';
import { characterSceneKey } from '../three/characterSceneKey';

export function CharacterPreview3D({ character, animated = false }: { character: CharacterConfig; animated?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const sceneKey = characterSceneKey(character);
  useEffect(() => {
    const host = container.current!;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-label', `${character.name} live 3D preview`);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#e3f1ff', '#718297', 1.2));
    const key = new THREE.DirectionalLight('#fff2df', 2.1); key.position.set(3, 5, 6); scene.add(key);
    const rim = new THREE.DirectionalLight('#77cfff', .9); rim.position.set(-4, 2, -3); scene.add(rim);
    const rig = createCrayonCharacter(character, Math.min(4, renderer.capabilities.getMaxAnisotropy()), 1);
    scene.add(rig.root); rig.shadowMesh.visible = false;
    rig.leftArm.rotation.set(-.08, 0, .08); rig.rightArm.rotation.set(-.08, 0, -.08);
    const bounds = characterPreviewBounds(rig, animated, animated ? 'menu' : 'turntable');
    const center = bounds.getCenter(new THREE.Vector3());
    rig.root.position.sub(center);
    const baseline = rig.root.position.clone();
    const size = bounds.getSize(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
    const resize = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(effectivePixelRatio(width, height, window.devicePixelRatio, 2));
      renderer.setSize(width, height); camera.aspect = width / height;
      camera.position.set(0, 0, characterPreviewDistance(size, camera.aspect, camera.fov, 1.045));
      camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const recovery = bindWebGLRecovery(renderer, scene, { resume: () => { resize(); renderer.render(scene, camera); } });
    let yaw = 0, pointer: number | null = null, lastX = 0, frame = 0, lastFrame = 0;
    const down = (event: PointerEvent) => { if (animated) return; pointer = event.pointerId; lastX = event.clientX; host.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (event.pointerId === pointer) { yaw += (event.clientX - lastX) * .012; lastX = event.clientX; } };
    const up = () => { pointer = null; };
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up); host.addEventListener('lostpointercapture', up);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let started: number | null = null;
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden || !recovery.ready() || time - lastFrame < 1000 / 30) return;
      const dt = Math.min(.1, (time - lastFrame) / 1000); lastFrame = time;
      started ??= time;
      const elapsed = (time - started) / 1000;
      // Every frame starts from the centred baseline, never the last frame.
      rig.root.position.copy(baseline);
      rig.bodyGroup.rotation.y = yaw + (reduce ? 0 : Math.sin(elapsed * .45) * .12);
      if (animated) animateMainMenuIdle(rig, elapsed, dt, reduce, baseline.y);
      else rig.headGroup.rotation.z = reduce ? 0 : Math.sin(elapsed * 1.5) * .025;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); recovery.dispose();
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up); host.removeEventListener('lostpointercapture', up);
      disposeSceneGeometry(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [sceneKey, animated]);
  return <div ref={container} className="profile-character-3d" role="img" aria-label={`${character.name}, live 3D character.${animated ? '' : ' Drag to rotate.'}`} />;
}
