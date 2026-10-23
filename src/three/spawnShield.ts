import * as THREE from 'three';

export const RESPAWN_SHIELD_SECONDS = 2;

/** Clear shell with a soft Fresnel rim, plus a low floor ring. */
export function createSpawnShield() {
  const group = new THREE.Group(); group.name = 'Respawn protection'; group.visible = false;
  const material = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 1 }, tint: { value: new THREE.Color('#9BDBE7') } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vNormal; varying vec3 vView; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = -p.xyz; gl_Position = projectionMatrix * p; }`,
    fragmentShader: `uniform float opacity; uniform vec3 tint; varying vec3 vNormal; varying vec3 vView;
      void main() {
        float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 2.4);
        gl_FragColor = vec4(tint, (.025 + rim * .4) * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  shell.position.y = .9; shell.scale.set(.83, 1.08, .78); group.add(shell);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.69, .75, 40), new THREE.MeshBasicMaterial({ color: '#ACDFE8', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .055; group.add(ring);
  return group;
}

export function updateSpawnShield(group: THREE.Group, remaining: number) {
  group.visible = remaining > 0;
  if (!group.visible) return;
  const entered = THREE.MathUtils.smoothstep(RESPAWN_SHIELD_SECONDS - remaining, 0, .16);
  const opacity = THREE.MathUtils.smoothstep(remaining, 0, .3) * entered;
  group.scale.setScalar(.97 + entered * .03);
  const shell = group.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  shell.material.uniforms.opacity.value = opacity;
  ((group.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = opacity * .45;
}
