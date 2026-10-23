import * as THREE from 'three';

/** Original red hit feedback: bounded droplets, gravity and brief floor splatter. */
export function createBloodFeedback(scene: THREE.Scene) {
  const capacity = 144;
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = 'Pooled blood hit feedback'; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const matrix = new THREE.Object3D(), color = new THREE.Color();
  const colors = ['#c92243', '#ef5265', '#ff97a6'].map(hex => new THREE.Color(hex));
  const droplets = Array.from({ length: capacity }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 0, floor: 0, spin: 0 }));
  let cursor = 0;
  matrix.scale.setScalar(0); matrix.updateMatrix();
  for (let i = 0; i < capacity; i++) { mesh.setMatrixAt(i, matrix.matrix); mesh.setColorAt(i, color); }
  mesh.visible = false; scene.add(mesh);
  return {
    hit(x: number, y: number, z: number, floor: number, dx: number, dz: number, intensity = 1) {
      const length = Math.hypot(dx, dz) || 1; dx /= length; dz /= length;
      intensity = THREE.MathUtils.clamp(intensity, .5, 2);
      for (let i = 0; i < Math.min(18, Math.round(11 * intensity)); i++) {
        const index = cursor++ % capacity, particle = droplets[index];
        const angle = i * 2.399 + Math.random() * .35, spread = 1.4 + Math.random() * 2.4;
        Object.assign(particle, { x: x - dx * .18, y, z: z - dz * .18, vx: dx * 2.4 + Math.cos(angle) * spread, vy: .8 + Math.random() * 3, vz: dz * 2.4 + Math.sin(angle) * spread, life: .48 + Math.random() * .3, size: (.065 + Math.random() * .055) * Math.sqrt(intensity), floor: floor + .035, spin: angle });
        mesh.setColorAt(index, colors[i % 3]);
      }
      mesh.instanceColor!.needsUpdate = true;
    },
    update(delta: number) {
      const dt = Math.max(0, Math.min(delta, .1));
      let active = false;
      for (let i = 0; i < capacity; i++) {
        const p = droplets[i]; if (p.life <= 0) continue;
        active = true; p.life = Math.max(0, p.life - dt);
        if (p.life === 0) { matrix.scale.setScalar(0); matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix); continue; }
        p.vy -= 13 * dt;
        const drag = Math.exp(-3 * dt); p.vx *= drag; p.vz *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const landed = p.y <= p.floor;
        if (landed) { p.y = p.floor; p.vx *= Math.exp(-18 * dt); p.vz *= Math.exp(-18 * dt); p.vy = 0; }
        const scale = p.size * Math.min(1, p.life / .2);
        matrix.position.set(p.x, p.y, p.z); matrix.rotation.set(landed ? 0 : p.spin, p.spin, landed ? 0 : p.spin * 1.5);
        matrix.scale.set(scale * (landed ? 1.9 : .8), scale * (landed ? .12 : 1.2), scale);
        matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix);
      }
      if (active) mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = active;
    },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
