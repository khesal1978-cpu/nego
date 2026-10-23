import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSync } from 'esbuild';

fs.mkdirSync('.npm-cache', { recursive: true });
buildSync({ stdin: { contents: `export * from './src/three/visualSettings'; export * from './src/three/nukeStadium'; export * from './src/components/GunFightHud'; export { MeshBasicMaterial, Box3, Vector3 } from 'three';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: '.npm-cache/live-look-test.mjs', packages: 'external', loader: { '.css': 'empty' } });
const mod = await import('../.npm-cache/live-look-test.mjs');

// Bad persisted data must never create NaN colours or unbounded framebuffers.
assert.deepEqual(mod.normalizeVisualSettings(null), mod.DEFAULT_VISUAL_SETTINGS);
const safe = mod.normalizeVisualSettings({ exposure: NaN, contrast: Infinity, saturation: 900, pixelRatio: -8, msaa: 16, shadowSize: 8192, toneMapping: 'unknown', hud: 'true' });
assert.equal(safe.exposure, mod.DEFAULT_VISUAL_SETTINGS.exposure);
assert.equal(safe.saturation, 1.8);
assert.equal(safe.pixelRatio, .75);
assert.equal(safe.msaa, mod.DEFAULT_VISUAL_SETTINGS.msaa);
assert.equal(safe.shadowSize, mod.DEFAULT_VISUAL_SETTINGS.shadowSize);
for (const [width, height, dpr] of [[390, 844, 3], [1920, 1080, 2], [3840, 2160, 2]]) {
  const ratio = mod.effectivePixelRatio(width, height, dpr, 2);
  assert(width * height * ratio * ratio <= 3_000_001);
  assert(ratio <= dpr);
}
let notifications = 0;
const unsubscribe = mod.subscribeVisualSettings(() => notifications++);
mod.updateVisualSettings({ warmth: .32, exposure: 1.18, shadowSize: 512 });
const exported = JSON.parse(mod.visualSettingsExport('Nuke / Coastal'));
assert.equal(exported.context, 'Nuke / Coastal');
assert.equal(exported.settings.warmth, .32);
assert.deepEqual(mod.normalizeVisualSettings(exported.settings), mod.getVisualSettings());
assert.equal(notifications, 1);
mod.setVisualCompare(true);
assert(mod.getVisualCompare());
assert.equal(mod.getVisualSettings().exposure, 1.18, 'Compare must not overwrite the chosen look');
mod.setVisualCompare(false);
mod.resetVisualSettings();
assert.deepEqual(mod.getVisualSettings(), mod.DEFAULT_VISUAL_SETTINGS);
unsubscribe();

// Curved scenery stays outside the playable disc and has a low skyline.
for (const jungle of [false, true]) {
  const materials = Object.fromEntries(['wall', 'trim', 'dark', 'deck', 'accent', 'foliage'].map(key => [key, new mod.MeshBasicMaterial()]));
  const stadium = mod.createNukeStadium(materials, jungle);
  assert(stadium.children.length <= 12, 'Static stadium should use a small set of batched draw calls');
  const bounds = new mod.Box3().setFromObject(stadium);
  assert(bounds.max.y < 6.6, 'No tall keep or cone towers remain');
  stadium.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position;
    const normal = mesh.geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      assert(Math.hypot(x, z) >= 17.6, 'Architecture must not enter the round court');
      assert(Number.isFinite(normal.getX(i)) && Number.isFinite(normal.getY(i)) && Number.isFinite(normal.getZ(i)));
    }
    mesh.geometry.dispose();
  });
  Object.values(materials).forEach(material => material.dispose());
}

assert.equal(mod.GunFightHealth, undefined, 'Health belongs over the character, not in a separate DOM HUD');
console.log('PASS: bounded render settings, live subscriptions/export/reset, framebuffer budget, round Nuke clearance and no separate health HUD.');
