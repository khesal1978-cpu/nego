import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';

const timers = [], sources = [], nodes = [], pendingAssets = new Map(), events = new Map();
const document = { hidden: false, addEventListener: (name, callback) => events.set(name, callback) };
const param = () => ({ value: 0, setValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { this.value = value; } });
const node = kind => { const n = { kind, connections: [], connect(to) { this.connections.push(to); }, disconnect() { this.disconnected = true; } }; nodes.push(n); return n; };
let ctx;
class AudioContextMock {
  constructor() { ctx = this; this.currentTime = 20; this.sampleRate = 44100; this.state = 'running'; this.destination = node('destination'); }
  createBuffer(channels, length, sampleRate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { length, sampleRate, getChannelData: i => data[i] }; }
  decodeAudioData(bytes) { return Promise.resolve({ asset: new TextDecoder().decode(bytes) }); }
  createBufferSource() { const n = Object.assign(node('sample'), { playbackRate: param(), start() { this.started = true; sources.push(this); }, stop() { this.stopped = true; } }); return n; }
  createMediaElementSource(track) {
    const n = Object.assign(node('media'), { buffer: { asset: track.src }, loop: true });
    Object.defineProperty(n, 'stopped', { get: () => track.paused });
    sources.push(n); return n;
  }
  createGain() { return Object.assign(node('gain'), { gain: param() }); }
  createBiquadFilter() { return Object.assign(node('filter'), { frequency: param(), Q: param(), gain: param() }); }
  createDynamicsCompressor() { return Object.assign(node('compressor'), { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
  createOscillator() { return Object.assign(node('oscillator'), { frequency: param(), start() {}, stop() {} }); }
  resume() { return Promise.resolve(); }
}
let menuTrack;
class AudioMock {
  constructor(src) { menuTrack = this; this.src = src; this.paused = true; this.playCount = 0; this.currentTime = 0; }
  play() { this.paused = false; this.playCount++; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() {}
  load() {}
}
const code = buildSync({ stdin: { contents: `export { crayonAudio } from './src/audio/crayonAudio'; export * from './src/audio/audioScene';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text;
const context = { module: { exports: {} }, document, Audio: AudioMock, window: { AudioContext: AudioContextMock, addEventListener: (name, callback) => events.set(name, callback) }, setTimeout: callback => timers.push(callback), fetch: url => new Promise(resolve => pendingAssets.set(url, () => resolve({ ok: true, arrayBuffer: () => Promise.resolve(new TextEncoder().encode(url).buffer) }))) };
vm.runInNewContext(code, context);
const { crayonAudio: audio, backgroundAudioScene: scene } = context.module.exports;
const flush = () => { while (timers.length) timers.shift()(); };
const loops = () => sources.filter(s => s.loop && !s.stopped);
const nature = () => loops().find(s => s.buffer.asset?.includes('birds_forest_nature'));
const menuScreens = ['TITLE_MENU', 'SETTINGS', 'MODE_SELECT', 'CHARACTER_SELECT', 'PROFILE', 'TOUR_MAP', 'CUSTOM_LOBBY'];
audio.setAudioScene(scene('TITLE_MENU', true));
assert.equal(sources.length, 0, 'Music waits for user-gesture unlock');
events.get('pointerdown')(); flush();
await Promise.resolve();
const menu = loops()[0];
assert(menu && loops().length === 1);
assert.equal(menu.buffer.asset, '/music/ship-wrek-pain.mp3', 'Menu streams the supplied Ship Wrek recording');
assert.equal(menu.connections[0].gain.value, .075, 'Default menu mix is quiet');
menuTrack.currentTime = 42;
for (let i = 0; i < 3; i++) for (const screen of menuScreens) {
  audio.setAudioScene(scene(screen, true)); audio.playMenuClick();
  assert.equal(loops()[0], menu, `Menu music keeps its source/position in ${screen}`);
}
assert.equal(menuTrack.playCount, 1, 'Screen navigation never restarts the track');
assert.equal(menuTrack.currentTime, 42, 'Screen navigation preserves song position');
audio.musicVolume = 1; audio.syncBackgroundMusic(); assert.equal(menu.connections[0].gain.value, .2, 'Menu gain stays capped');
audio.musicVolume = .3;
audio.setAudioScene(scene('PLAYING', true));
assert(menu.stopped && !loops().length, 'Menu music stops immediately when a match starts, even before forest fetch completes');
audio.setAudioScene('menu');
await Promise.resolve();
for (const resolve of pendingAssets.values()) resolve();
await new Promise(resolve => setImmediate(resolve));
assert.equal(loops().length, 1); assert(!nature(), 'A late forest decode never starts in a menu');
audio.setAudioScene(scene('PLAYING', true));
assert.equal(loops().length, 1); assert(nature(), 'Game plays only the original forest WAV');
const firstForest = nature();
for (const volume of [.3, .65, 1]) { audio.musicVolume = volume; audio.syncVolleyballNatureAmbienceVolume(); assert.equal(nature(), firstForest); assert.equal(nature().connections[0].gain.value, .05, 'Forest is capped at 5%'); }
audio.musicVolume = .15; audio.syncVolleyballNatureAmbienceVolume(); assert.equal(nature().connections[0].gain.value, .025);
audio.musicVolume = 0; audio.syncVolleyballNatureAmbienceVolume(); assert.equal(loops().length, 0);
audio.musicVolume = .3; audio.syncVolleyballNatureAmbienceVolume(); assert(nature());
document.hidden = true; events.get('visibilitychange')(); assert.equal(loops().length, 0);
document.hidden = false; events.get('visibilitychange')(); assert(nature() && loops().length === 1);
audio.muted = true; audio.syncVolleyballNatureAmbienceVolume(); assert.equal(loops().length, 0);
audio.muted = false; audio.syncVolleyballNatureAmbienceVolume(); assert(nature());
audio.setAudioScene(scene('PAUSED', true)); assert.equal(loops().length, 0);
audio.setAudioScene(scene('GAME_OVER', true)); assert.equal(loops().length, 0);
assert.equal(scene('TITLE_MENU', false), 'silent');
audio.setAudioScene('game');

// Check actual effect routes, including voices and synthesized cues, without an audio device.
const destination = ctx.destination;
const route = n => { const result = []; while (n && n !== destination) { result.push(n); n = n.connections[0]; } assert.equal(n, destination, 'Every sound has a connected output'); return result; };
const before = sources.length;
audio.playGunShot(); audio.playShotgunBlast(); audio.playDodgeballHit('green_hoodie', true, true);
audio.playDeathSound(true, false, 'green_hoodie'); audio.playCountdownBeep(true); audio.playServeWhistle(); audio.playJump(); audio.playFootstep(); audio.playFlamethrowerWhoosh();
const effects = sources.slice(before);
assert(effects.length >= 6);
for (const source of effects) {
  const path = route(source);
  assert(path.some(n => n.kind === 'compressor'), 'Overlapping combat effects use the shared compressor');
  assert(path.some(n => n.kind === 'filter' && n.type === 'peaking' && n.gain.value < 0), 'Effects tame harsh presence frequencies');
}
for (const osc of nodes.filter(n => n.kind === 'oscillator')) assert(route(osc).some(n => n.kind === 'compressor'), 'Synthesized cues use the same mix');
const effectOutput = route(effects[0]).at(-1);
audio.sfxVolume = .4; audio.syncVolleyballNatureAmbienceVolume(); assert(Math.abs(effectOutput.gain.value - .312) < 1e-8, 'Slider changes already-playing voices/effects');
audio.muted = true; audio.syncVolleyballNatureAmbienceVolume(); assert.equal(effectOutput.gain.value, 0);
audio.muted = false; audio.sfxVolume = 0; audio.syncVolleyballNatureAmbienceVolume();
const silentCount = sources.length; audio.playGunShot(); audio.playDodgeballHit(); assert.equal(sources.length, silentCount);
assert(!route(nature()).some(n => n.kind === 'compressor'), 'Forest retains its original recording and 5% gain');
console.log('PASS: uninterrupted menu navigation; exclusive forest/menu loops; delayed assets; 5% cap; pause, visibility, mute and sliders; shared combat/voice/cue mix.');
