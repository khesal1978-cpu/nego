import * as THREE from 'three';

/** A soft veil over scenery outside the court, using the existing fog colour
 * and live density slider. No extra meshes, particles or render passes. */
export function applyExteriorFog(root: THREE.Object3D, bounds: THREE.Vector4, radius = 0) {
  const seen = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (seen.has(material) || !('fog' in material) || !material.fog) continue;
      seen.add(material);
      const previousCompile = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey;
      material.customProgramCacheKey = function () { return `${previousKey.call(this)}:exterior-fog-v1`; };
      material.onBeforeCompile = function (shader, renderer) {
        previousCompile.call(this, shader, renderer);
        shader.uniforms.exteriorFogBounds = { value: bounds };
        shader.uniforms.exteriorFogRadius = { value: radius };
        shader.vertexShader = shader.vertexShader
          .replace('#include <fog_pars_vertex>', `#include <fog_pars_vertex>
            #ifdef USE_FOG
              varying vec3 vExteriorFogPosition;
            #endif`)
          .replace('#include <project_vertex>', `#include <project_vertex>
            #ifdef USE_FOG
              vec4 exteriorPosition = vec4(transformed, 1.0);
              #ifdef USE_BATCHING
                exteriorPosition = batchingMatrix * exteriorPosition;
              #endif
              #ifdef USE_INSTANCING
                exteriorPosition = instanceMatrix * exteriorPosition;
              #endif
              vExteriorFogPosition = (modelMatrix * exteriorPosition).xyz;
            #endif`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>
            #ifdef USE_FOG
              varying vec3 vExteriorFogPosition;
              uniform vec4 exteriorFogBounds;
              uniform float exteriorFogRadius;
            #endif`)
          .replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace(
            'gl_FragColor.rgb = mix(', `
            #ifdef FOG_EXP2
              vec2 outsideCourt = max(max(exteriorFogBounds.xy - vExteriorFogPosition.xz,
                vExteriorFogPosition.xz - exteriorFogBounds.zw), vec2(0.0));
              float exteriorDistance = exteriorFogRadius > 0.0
                ? max(length(vExteriorFogPosition.xz) - exteriorFogRadius, 0.0)
                : length(outsideCourt);
              float shoreHaze = 1.0 - exp(-pow(exteriorDistance * fogDensity * 8.0, 1.35));
              float heightFade = mix(1.0, 0.35, smoothstep(8.0, 34.0, vExteriorFogPosition.y));
              fogFactor = max(fogFactor, shoreHaze * heightFade * 0.62);
            #endif
            gl_FragColor.rgb = mix(`));
      };
      material.needsUpdate = true;
    }
  });
}
