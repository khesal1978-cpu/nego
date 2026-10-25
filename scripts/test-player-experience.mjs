import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync } from 'esbuild';
import * as THREE from 'three';

const saved = new Map([['sixzun_weather', 'rain']]);
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
fs.mkdirSync('.npm-cache', { recursive: true });
buildSync({ stdin: { contents: `export * from './src/components/matchStats'; export * from './src/components/MatchPanels'; export * from './src/components/ProfilePanel'; export * from './src/components/CharacterStudio'; export * from './src/components/CharacterPortrait'; export * from './src/components/WeatherControl'; export * from './src/three/weather'; export * from './src/network/playerControl'; export * from './src/three/combatFeedback'; export * from './src/types/game';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/player-experience.mjs' });
const m = await import('../.npm-cache/player-experience.mjs');
const stats = { playerScore: 5, aiScore: 3, targetWinScore: 5, currentRally: 0, bestRally: 4, perfectSpikes: 2, partnerSets: 1, bonusHits: 0, superCharge: 12, servingSide: 'player', lastPointWinner: 'player', lastPointReason: '', raceTimeSec: 87 };
const ordinary = m.recordRally(stats, 7, false, 15, false, false);
assert.equal(ordinary.bestRally, 7); assert.equal(ordinary.perfectSpikes, 2); assert.equal(ordinary.partnerSets, 1);
const perfect = m.recordRally(ordinary, 8, true, 90, false, true);
assert.equal(perfect.perfectSpikes, 3); assert.equal(perfect.partnerSets, 2); assert.equal(perfect.superCharge, 100);
const finished = { ...perfect, matchWinner: 'player' };
assert.equal(m.recordRally(finished, 20, true, 30, true, true), finished, 'Stats freeze at the final point');
const clock = m.createMatchClock();
clock.resume(1000); clock.resume(1500); assert.equal(clock.seconds(3000), 2);
clock.pause(4000); assert.equal(clock.seconds(14000), 3, 'Pauses do not count');
clock.resume(15000); assert.equal(clock.seconds(17000), 5); clock.reset(); assert.equal(clock.seconds(30000), 0);
for (const mode of ['duo_2v2', 'survival', 'hoop_volley', 'tour', 'obstacle_rush', 'floor_is_lava']) {
  const recorded = { ...finished, arenaStandings: [{ id: 'me', name: 'Me', kills: 9, deaths: 2, isPlayer: true, charId: 'green_hoodie' }, { id: 'rival', name: 'Actual rival', kills: 4, deaths: 7, isPlayer: false, charId: 'purple_shades' }], nukeStandings: [{ id: 'me', name: 'Me', roundWins: 3, kills: 2, hits: 6, catches: 1, hp: 70, alive: true, isPlayer: true, charId: 'green_hoodie' }, { id: 'rival', name: 'Actual rival', roundWins: 2, kills: 1, hits: 4, catches: 0, hp: 0, alive: false, isPlayer: false, charId: 'purple_shades' }] };
  const html = renderToStaticMarkup(React.createElement(m.MatchResults, { stats: recorded, mode, playerName: 'Me', opponentName: 'Actual rival', playerPortrait: React.createElement('span', null, 'Player portrait'), opponentPortrait: React.createElement('span', null, 'Rival portrait'), onRestart() {}, onMenu() {} }));
  assert(html.includes('Rival portrait') && html.includes('Actual rival') && html.includes('Opponent result'));
  assert(html.includes('1:27') && html.includes('Your match statistics'));
  assert.equal((html.match(/<button/g) || []).length, 2);
  if (mode === 'duo_2v2') assert(html.includes('Perfect spikes') && html.includes('Partner sets'));
}
const profile = renderToStaticMarkup(React.createElement(m.ProfilePanel, { name: 'Me', characterName: 'Leo', characterTitle: 'Athlete', character: m.CRAYON_CHARACTERS[0], onName() {}, onBack() {} }));
for (const value of ['live 3D character', 'PLAYER NAME', 'SAVE NAME', 'DONE']) assert(profile.includes(value));
assert(!profile.includes('Hit effects') && !profile.includes('Choose hit effect'));
assert(!profile.includes('Head shape') && !profile.includes('Choose your athlete'));
for (const char of m.CRAYON_CHARACTERS) {
 const avatar = renderToStaticMarkup(React.createElement(m.CharacterPortrait, { char }));
 assert(avatar.includes('viewBox="0 0 100 108"') && avatar.includes(char.name));
 assert(!avatar.includes('NaN') && avatar.includes('<linearGradient'));
}
const studio = renderToStaticMarkup(React.createElement(m.CharacterStudio, { character: m.CRAYON_CHARACTERS[0], selectedCharacter: 'green_hoodie', outfit: 'crown_hoodie', face: 'happy_laugh', head: 'round', wide: true, onCharacter() {}, onOutfit() {}, onFace() {}, onHead() {}, onBack() {}, portrait() {}, outfitPreview() {} }));
assert(studio.includes('Customize') && studio.includes('Outfits') && studio.includes('Faces'));
assert(!studio.includes('<input') && !studio.includes('Your character'), 'Name editing belongs to Profile');
const hitScene = new THREE.Scene(); const hits = m.createBloodFeedback(hitScene);
hits.hit(0, 1, 0, 0, 1, 0); hits.update(.016); assert(hitScene.getObjectByName('Pooled blood hit feedback').visible);
assert.equal(hitScene.children.length, 1, 'Only original red hit feedback remains');
for(let i=0;i<80;i++) hits.update(.016); assert(!hitScene.children[0].visible); hits.dispose(); assert.equal(hitScene.children.length, 0);
assert.deepEqual(m.remoteMovement('human', 1000, 9000, 4, 3, 8), { x: 0, z: 0 }, 'Disconnected humans never move or become bots');
assert.deepEqual(m.remoteMovement('human', 1000, 1100, 4, 3, 8), { x: .5, z: .375 });
assert.equal(m.remoteMovement(null, 0, 0, 0, 0, 8), null);
assert.deepEqual(m.remoteMovement('human', undefined, 9000, 4, 3, 8), { x: 0, z: 0 }, 'Human waits for the first network packet');
assert.deepEqual(m.remoteMovement('human', 1000, 1500, 4, 3, 8), { x: 0, z: 0 }, 'Stale movement stops at the timeout');
assert.deepEqual(m.remoteMovement('human', 2000, 1100, 4, 3, 8), { x: 0, z: 0 });
assert.deepEqual(m.remoteMovement('human', 9000, 9100, -4, 0, 8), { x: -.5, z: 0 }, 'Reconnected human resumes from their own packet');
for (const held of [false, undefined]) for (const keyboard of [false, undefined]) {
  assert(!m.gunFireRequested(true, held, keyboard), 'Seeing a target never fires without player input');
  assert(!m.gunFireRequested(true, held, keyboard, false, false), 'No blind auto-fire without a target');
}
assert(m.gunFireRequested(true, true, false), 'Pointer fires');
assert(m.gunFireRequested(true, false, true), 'Keyboard fires');
assert(!m.gunFireRequested(false, false, false), 'Solo play also requires manual fire');
const room = { mode: 'volleyball_2v2', status: 'PLAYING', slots: [{ playerId: 'me', team: 'blue', occupiedBy: 'human' }, { playerId: 'friend', team: 'blue', occupiedBy: 'human' }, { playerId: 'rival', team: 'red', occupiedBy: 'human' }, { playerId: null, team: 'red', occupiedBy: 'bot' }] };
assert.deepEqual(m.volleyballControl(room, 'me'), { custom: true, partnerBot: false, rival1Bot: false, rival2Bot: true });
const swappedRoom = { ...room, slots: room.slots.map(slot => ({ ...slot, team: slot.team === 'blue' ? 'red' : 'blue' })) };
assert.deepEqual(m.volleyballControl(swappedRoom, 'me'), m.volleyballControl(room, 'me'), 'Control follows human identity on either team');
const allHumanRoom = { ...room, slots: room.slots.map((slot, index) => ({ ...slot, occupiedBy: 'human', playerId: slot.playerId || `human_${index}` })) };
assert.deepEqual(m.volleyballControl(allHumanRoom, 'me'), { custom: true, partnerBot: false, rival1Bot: false, rival2Bot: false }, 'An all-human match has no AI controlled actors');
assert.deepEqual(m.volleyballControl(null, 'me'), { custom: false, partnerBot: true, rival1Bot: true, rival2Bot: true }, 'Solo mode keeps its bots');
assert.equal(m.getWeather(), 'auto');
const weatherToggle = renderToStaticMarkup(React.createElement(m.WeatherControl));
assert.equal((weatherToggle.match(/<button/g) || []).length, 1);
assert(weatherToggle.includes('aria-pressed="true"') && !weatherToggle.includes('Choose weather') && !weatherToggle.includes('<select'));
 assert.equal(m.normalizeWeather('broken'), 'normal');
let changes = 0; const unsub = m.subscribeWeather(() => changes++);
m.setWeather('snow'); assert.equal(changes, 1); assert.equal(saved.get('sixzun_weather'), 'snow'); unsub();
assert.equal(m.weatherAtTime('auto', 0), 'normal'); assert.equal(m.weatherAtTime('auto', 65), 'rain'); assert.equal(m.weatherAtTime('auto', 195), 'snow'); assert.equal(m.weatherAtTime('auto', 260), 'cold');
const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 6, 10);
const weather = m.createWeather(scene); const group = scene.getObjectByName('Optional light weather');
assert.equal(group.children.length, 2, 'Weather uses only two batched draws');
const [rain, snow] = group.children;
for (const choice of ['rain', 'snow', 'cold', 'normal']) {
  m.setWeather(choice); for (let i = 0; i < 300; i++) weather.update(1 / 60, camera);
  if (choice === 'rain') assert(rain.visible && rain.material.opacity <= .221);
  if (choice === 'snow' || choice === 'cold') assert(snow.visible && snow.material.uniforms.opacity.value <= .481);
  if (choice === 'normal') assert(!rain.visible && !snow.visible);
  group.traverse(mesh => { if (mesh.geometry) for (const value of mesh.geometry.attributes.position.array) assert(Number.isFinite(value)); });
}
m.setWeather('rain'); for (let i = 0; i < 300; i++) weather.update(1 / 60, camera, false); assert(!rain.visible && !snow.visible, 'Previews can disable weather');
weather.dispose(); assert.equal(scene.children.length, 0);
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(app.slice(app.indexOf('Top-Left Player Profile Card'), app.indexOf('Audio and settings;')).includes("setGameState('PROFILE')"));
assert(!app.includes('matchTransition.type') && !app.includes('VIEW MATCH STATISTICS'));
for (const file of ['VolleyballCanvas', 'FloorIsLavaCanvas', 'ObstacleRushCanvas']) { const source = fs.readFileSync(`src/components/${file}.tsx`, 'utf8'); assert(source.includes('weather.update(') && source.includes('weather.dispose()')); }
console.log('PASS: recorded stats and final freeze, pause/resume timer, actual rival in every mode, Profile/Customize separation, original hit feedback, reference SVG portraits, human control, bounded optional weather and scene cleanup.');

buildSync({ entryPoints: ['src/components/LoadingScreen.tsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/loading-test.mjs' });
const loading = await import('../.npm-cache/loading-test.mjs');
assert.equal(loading.LOADING_SCENES.length, 5);
for (const [index, scene] of loading.LOADING_SCENES.entries()) {
  for (const id of scene.characters) assert(m.CRAYON_CHARACTERS.some(character => character.id === id), `Real game character required: ${id}`);
  const html = renderToStaticMarkup(React.createElement(loading.LoadingScreen, { progress: 65, initialScene: index, onReady() {} }));
  assert(html.includes(scene.title[0]) && html.includes(scene.title[1]));
  assert(!html.includes('<img') && !html.includes('<svg'), 'Loading scenes do not substitute images or SVG portraits for the game models');
  assert(html.includes('animated 3D game characters') && html.includes('OPENING AUTOMATICALLY'));
  assert(html.includes('aria-valuenow="65"') && html.includes('Loading designs'));
  assert.equal((html.match(/<button/g) || []).length, loading.LOADING_SCENES.length, 'Only scene selectors remain; entry into the game needs no click');
  assert(html.includes(' / 05'), 'Scene counter includes the gun showcase');
  if (scene.id === 'gun') assert(html.includes('close-up holding a gun') && html.includes('loader-smoke'), 'Gun scene combines the live hero with smoke');
}
globalThis.sessionStorage = { getItem: () => 'invalid', setItem() {} };
const safeLoading = renderToStaticMarkup(React.createElement(loading.LoadingScreen, { progress: NaN, initialScene: NaN, onReady() {} }));
assert(safeLoading.includes('SMALL SQUAD.') && safeLoading.includes('aria-valuenow="0"'));
console.log('PASS: five loading designs including gun close-up and smoke, real characters, progress bounds and safe invalid stored preferences.');
buildSync({ stdin: { contents: `export * from './src/components/gameTutorials'; export * from './src/components/GameTutorial';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/tutorial-tests.mjs' });
const tutorial = await import('../.npm-cache/tutorial-tests.mjs');
assert.deepEqual(tutorial.readTutorialSeen(), []);
assert.deepEqual(tutorial.rememberTutorial('nuke'), ['nuke']);
assert.deepEqual(tutorial.rememberTutorial('nuke'), ['nuke'], 'Skipped and completed controls are remembered once');
assert(JSON.parse(saved.get('sixzun-controls-learned-v1')).includes('nuke'));
saved.set('sixzun-controls-learned-v1', '{broken');
assert(tutorial.readTutorialSeen().includes('nuke'), 'Storage failures retain the current session completion');
for (const mode of ['quick', 'duo_2v2', 'tour', 'hoop_volley', 'bomb_potato', 'crab_target', 'survival']) assert.equal(tutorial.tutorialFamily(mode), 'volleyball', 'Shared volleyball controls only need learning once');
assert.equal(tutorial.tutorialFamily('obstacle_rush'), 'gun');
globalThis.window = { matchMedia: () => ({ matches: true }) };
for (const mode of ['obstacle_rush', 'floor_is_lava', 'quick']) {
  const html = renderToStaticMarkup(React.createElement(tutorial.GameTutorial, { mode, onClose() {} }));
  assert(html.includes('role="dialog"') && html.includes('Skip') && html.includes('Next'));
  assert(html.includes(tutorial.GAME_TUTORIALS[tutorial.tutorialFamily(mode)].name));
}
console.log('PASS: first-play controls per game family, persistent skip/completion, storage fallback and accessible mobile tutorial.');
