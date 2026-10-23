import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const saved = new Map(), timers = [];
const localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
function load(storage = localStorage) {
  const code = buildSync({ stdin: { contents: `export * from './src/playerPreferences'; export * from './src/components/gameTutorials'; export * from './src/audio/originalMusic';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false }).outputFiles[0].text;
  const context = { module: { exports: {} }, require, localStorage: storage, setTimeout: callback => timers.push(callback) };
  vm.runInNewContext(code, context); return context.module.exports;
}
let m = load();
const preferences = { ...m.DEFAULT_PLAYER_PREFERENCES, selectedCharId: 'smokey_jester', selectedOutfitId: 'street_leather', musicVol: 17, muted: true, cameraFov: 52 };
m.savePlayerPreferences(preferences); m.rememberTutorial('nuke');
saved.set('volley_rally_unlocked_level', '2');
m = load(); // A fresh module/browser visit, with the same storage.
assert.equal(JSON.stringify(m.readPlayerPreferences()), JSON.stringify(preferences));
assert.deepEqual([...m.readTutorialSeen()], ['nuke']); assert.equal(m.readTourProgress(), 2);
saved.set('volley_rally_unlocked_level', '999'); assert.equal(m.readTourProgress(), 3, 'Progress is bounded by the available tour levels');
assert.equal(m.readPlayerPreferences().musicVol, 17, 'Saved quiet mix survives reopening');
saved.set('sixzun-player-preferences-v1', '{broken json');
assert.equal(m.readPlayerPreferences().selectedCharId, 'green_hoodie');
const corrupt = m.normalizePlayerPreferences({ selectedCharId: 'missing', musicVol: 400, sfxVol: NaN, muted: 'false', cameraFov: -90 });
assert.equal(corrupt.selectedCharId, 'green_hoodie'); assert.equal(corrupt.musicVol, 100); assert.equal(corrupt.sfxVol, 80); assert.equal(corrupt.muted, false); assert.equal(corrupt.cameraFov, 30);
const restricted = load({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
assert.doesNotThrow(() => { restricted.readPlayerPreferences(); restricted.savePlayerPreferences(preferences); restricted.readTourProgress(); restricted.rememberTutorial('gun'); });
assert(restricted.readTutorialSeen().includes('gun'), 'In-memory tutorial fallback survives denied storage');
console.log('PASS: profile/settings restore, tutorial memory, tour progress, invalid data and storage-denied fallback.');

const length = Math.ceil(m.MUSIC_BEAT * 4 * m.MUSIC_BARS * m.MUSIC_SAMPLE_RATE);
const left = new Float32Array(length), right = new Float32Array(length);
for (let bar = 0; bar < m.MUSIC_BARS; bar++) m.writeMusicBar(left, right, bar);
let peak = 0, energy = 0, difference = 0;
for (let i = 0; i < length; i++) { assert(Number.isFinite(left[i]) && Number.isFinite(right[i])); peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); energy += left[i] ** 2; difference += Math.abs(left[i] - right[i]); }
const rms = Math.sqrt(energy / length);
assert(peak < .35 && rms > .008 && rms < .1, 'Music is audible but has plenty of mix headroom');
assert(difference > 1, 'Music has subtle stereo width');
assert(Math.abs(left[0] - left.at(-1)) < .004, 'Loop boundary stays smooth');
const sources = [], gains = [];
const ctx = {
  currentTime: 10, destination: {},
  createBuffer(channels, n) { const data = Array.from({ length: channels }, () => new Float32Array(n)); return { getChannelData: channel => data[channel] }; },
  createBufferSource() { const source = { connect() {}, disconnect() { this.disconnected = true; }, start() { this.started = true; }, stop() { this.stopped = true; } }; sources.push(source); return source; },
  createGain() { const node = { gain: { setValueAtTime() {}, setTargetAtTime(value) { node.value = value; } }, connect() {}, disconnect() { this.disconnected = true; } }; gains.push(node); return node; },
};
const music = m.createOriginalMusic(ctx);
music.set(true, .3); music.set(true, .3);
while (timers.length) timers.shift()();
assert.equal(sources.length, 1, 'One cached loop despite repeated starts'); assert(sources[0].loop);
for (let i = 0; i < 50; i++) music.set(true, .2);
assert.equal(sources.length, 1); assert(Math.abs(gains[0].value - .084) < 1e-9);
music.set(true, 0); assert(sources[0].stopped && sources[0].disconnected && gains[0].disconnected, 'Zero slider fully stops and disconnects music');
music.set(true, .3); assert.equal(sources.length, 2);
music.set(false, .3); assert(sources[1].stopped, 'Pause/mute stops music');
music.dispose(); music.set(true, .3); assert.equal(sources.length, 2);
const cancelled = m.createOriginalMusic(ctx); cancelled.set(true, .3); cancelled.dispose();
while (timers.length) timers.shift()();
assert.equal(sources.length, 2, 'Disposed loading music never starts late');
console.log(`PASS: original stereo loop, smooth seam, peak ${peak.toFixed(3)}, RMS ${rms.toFixed(3)}, single-loop lifecycle, volume, mute and cancellation.`);
