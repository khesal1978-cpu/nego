import * as THREE from 'three';
import type { StylizedPostPipeline } from './postProcessing';
import { disposeSceneGeometry } from './scenePerformance';

/** A thumbnail uses the game's finished scene and post-processing, then releases its renderer. */
export function renderMapPreview(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, pipeline: StylizedPostPipeline, onReady: (image: string) => void, court = false): () => void {
  camera.aspect = 16 / 9;
  camera.position.set(court ? 7 : 10, court ? 9 : 23, court ? 15 : 32);
  camera.lookAt(0, court ? 0.8 : 2, court ? 0 : -5);
  camera.updateProjectionMatrix();
  const frame = requestAnimationFrame(() => {
    pipeline.render();
    onReady(renderer.domElement.toDataURL('image/webp', 0.9));
  });
  return () => {
    cancelAnimationFrame(frame);
    pipeline.dispose();
    disposeSceneGeometry(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
