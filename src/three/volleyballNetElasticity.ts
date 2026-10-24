import type { Group, Mesh, BufferGeometry } from 'three';
import { BufferAttribute, DynamicDrawUsage } from 'three';

type Pulse = { x: number; y: number; strength: number; age: number; weights: WeakMap<Float32Array, Float32Array> };
/** Damped spring waves; posts stay pinned and repeated impacts have a fixed budget. */
export function createNetSpring() {
  const pulses: Pulse[] = [];
  const response = (age: number) => Math.exp(-3.4 * age) * Math.sin(14 * age) / 14;
  const shape = (x: number, y: number, hit: Pulse) => Math.max(0, 1 - (x / 3.6) ** 2) * Math.exp(-(((x - hit.x) / 1.35) ** 2) - ((y - hit.y) / .8) ** 2);
  const displacement = (x: number, y: number, ahead = 0) => Math.max(-.42, Math.min(.42,
    pulses.reduce((sum, hit) => sum + hit.strength * response(hit.age + ahead) * shape(x, y, hit), 0)));
  return {
    impact(x: number, y: number, velocity: number) {
      if (![x, y, velocity].every(Number.isFinite)) return;
      if (pulses.length >= 4) pulses.shift();
      pulses.push({ x, y, age: 0, strength: Math.max(-9, Math.min(9, velocity * .38)), weights: new WeakMap() });
    },
    update(dt: number) {
      for (const hit of pulses) hit.age += Math.max(0, dt);
      for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].age >= 1.8) pulses.splice(i, 1);
    },
    displacement,
    sampleVertices(rest: Float32Array, output: Float32Array) {
      output.fill(0);
      for (const hit of pulses) {
        let weights = hit.weights.get(rest);
        if (!weights) {
          weights = new Float32Array(output.length);
          for (let i = 0; i < weights.length; i++) weights[i] = shape(rest[i * 3], rest[i * 3 + 1], hit);
          hit.weights.set(rest, weights);
        }
        // The spatial envelope is fixed for this impact. Compute its temporal
        // spring response once, instead of exp/sin for every vertex every frame.
        const strength = hit.strength * response(hit.age);
        for (let i = 0; i < output.length; i++) output[i] += weights[i] * strength;
      }
      for (let i = 0; i < output.length; i++) output[i] = Math.max(-.42, Math.min(.42, output[i]));
    },
    velocity(x: number, y: number) { return (displacement(x, y, .001) - displacement(x, y)) / .001; },
    get active() { return pulses.length > 0; },
    reset() { pulses.length = 0; },
  };
}

export function createElasticNetVisual(net: Group) {
  const spring = createNetSpring();
  const surfaces: { geometry: BufferGeometry; rest: Float32Array; displacement: Float32Array }[] = [];
  net.traverse(object => {
    if (!object.userData.elasticNet) return;
    const mesh = object as Mesh;
    surfaces.push({ geometry: mesh.geometry, rest: new Float32Array(mesh.geometry.attributes.position.array), displacement: new Float32Array(mesh.geometry.attributes.position.count) });
    const positions = mesh.geometry.attributes.position;
    if (positions instanceof BufferAttribute) positions.setUsage(DynamicDrawUsage);
    mesh.geometry.computeBoundingSphere();
    if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius += .42;
  });
  let wasActive = false;
  return {
    spring,
    update(dt: number) {
      spring.update(dt);
      if (!spring.active && !wasActive) return;
      wasActive = spring.active;
      for (const { geometry, rest, displacement } of surfaces) {
        const positions = geometry.attributes.position;
        spring.sampleVertices(rest, displacement);
        for (let i = 0; i < positions.count; i++) positions.setZ(i, rest[i * 3 + 2] + displacement[i]);
        positions.needsUpdate = true;
      }
    },
    reset() { spring.reset(); wasActive = true; this.update(0); },
  };
}
