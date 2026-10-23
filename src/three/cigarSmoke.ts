import * as THREE from 'three';

/** Ten soft, camera-facing wisps in one draw; no per-frame particle allocation. */
export function createCigarSmoke() {
  const base = new THREE.PlaneGeometry(0, 0);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(base.index!.clone());
  for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute.clone());
  geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(Float32Array.from({ length: 10 }, (_, i) => i / 10), 1));
  geometry.instanceCount = 10;
  base.dispose();
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `attribute float phase; uniform float time; varying vec2 vUv; varying float life;
      void main() {
        vUv = uv; life = fract(phase + time * .24);
        vec3 drift = vec3(life * .24 + sin(life * 7. + phase * 8.) * life * .065, life * .68, life * .06);
        vec4 center = modelViewMatrix * vec4(position + drift, 1.);
        float worldScale = length(modelMatrix[0].xyz);
        float size = .055 + life * .25;
        center.xy += (uv - .5) * vec2(size, size * 1.55) * worldScale;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: `uniform float time; varying vec2 vUv; varying float life;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float curl = sin(p.y * 7. + life * 9. - time * .6) * .2;
        float body = exp(-4. * dot(vec2(p.x + curl, p.y), vec2(p.x + curl, p.y)));
        float wisps = .65 + .35 * sin(p.y * 12. + p.x * 5. + life * 11.);
        float alpha = body * wisps * smoothstep(0., .12, life) * (1. - smoothstep(.4, 1., life)) * .32;
        if (alpha < .003) discard;
        gl_FragColor = vec4(mix(vec3(.48, .51, .52), vec3(.73, .76, .77), life), alpha);
      }`,
  });
  const smoke = new THREE.Mesh(geometry, material);
  smoke.name = 'Cigar drifting smoke';
  smoke.frustumCulled = false;
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  smoke.onBeforeRender = () => { material.uniforms.time.value = reducedMotion ? 1 : performance.now() / 1000; };
  return smoke;
}
