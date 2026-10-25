import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
function load(contents, globals = {}) {
  const source = buildSync({ stdin: { contents, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false }).outputFiles[0].text;
  const context = { module: { exports: {} }, require, console, ...globals };
  vm.runInNewContext(source, context);
  return context.module.exports;
}
const m = load(`export * from './src/components/nukeControls'; export * from './src/components/volleyballNetCollision'; export * from './src/components/volleyballMovement'; export * from './src/three/visualSettings'; export * from './src/network/customModes'; export * from './src/network/playerControl'; export * from './src/network/matchSync'; export * from './src/network/transport'; export * from './src/network/customCharacters'; export * from './src/three/frameBudget'; export { multiplayerClient } from './src/network/multiplayerClient';`);
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
for (const fps of [10, 20, 30, 60, 90, 120, 144]) for (const side of [1, -1]) for (const radius of [m.volleyballBallRadius(false), m.volleyballBallRadius(true)]) {
  const ball = { bx: 0, by: 1.8, bz: 2 * side, bvx: 0, bvy: 0, bvz: -60 * side };
  let hit = false;
  for (let frame = 0; frame < fps / 5; frame++) hit = m.stepVolleyballBall(ball, -14, 1 / fps, radius) || hit;
  assert(hit && ball.bz * side > 0 && ball.bvz * side > 0, `Net blocks ${fps} FPS on side ${side}, radius ${radius}`);
  const high = { bx: 0, by: 5, bz: 2 * side, bvx: 0, bvy: 0, bvz: -60 * side };
  for (let frame = 0; frame < fps / 5; frame++) assert(!m.stepVolleyballBall(high, -14, 1 / fps, radius), 'High shots clear the tape');
  assert(high.bz * side < 0);
}
const sideline = { bx: 5, by: 1.8, bz: 2, bvx: 0, bvy: 0, bvz: -60 };
assert(!m.stepVolleyballBall(sideline, -14, .05), 'Shots outside the net width do not hit an invisible barrier');
near(m.volleyballBallRadius(false), .44); near(m.volleyballBallRadius(true), .66);
for (const fps of [10, 20, 30, 60, 120, 144]) for (const big of [false, true]) {
  const radius = m.volleyballBallRadius(big);
  const falling = { bx: .2, by: 5, bz: 0, bvx: 0, bvy: -30, bvz: 0 };
  let hits = 0, impact = null;
  for (let i = 0; i < Math.ceil(fps * .12); i++) {
    if (m.stepVolleyballBall(falling, -14, 1 / fps, radius, undefined, (x, y, velocity) => { impact = { x, y, velocity }; })) hits++;
  }
  assert.equal(hits, 1, 'Descending ball rebounds off top tape once');
  assert(falling.by >= m.VOLLEYBALL_NET_TOP + radius && falling.bvy > 0);
  near(impact.x, .2); near(impact.y, m.VOLLEYBALL_NET_TOP);
  const missedCorner = { bx: 3.825 + radius * .8, by: m.VOLLEYBALL_NET_TOP + radius * .8, bz: 1, bvx: 0, bvy: 0, bvz: -30 };
  assert(!m.stepVolleyballBall(missedCorner, 0, .1, radius), 'Diagonal clearance uses a round sphere, not an expanded rectangle');
  const corner = { bx: 3.825 + radius * .55, by: m.VOLLEYBALL_NET_TOP + radius * .55, bz: 1, bvx: 0, bvy: 0, bvz: -30 };
  assert(m.stepVolleyballBall(corner, 0, .1, radius), 'Sphere contacts the rounded upper side corner');
  assert(corner.bvx > 0 && corner.bvy > 0, 'Corner normal deflects sideways and upward');
}
for (const side of [-1, 1]) {
  const outgoing = { bx: 0, by: 1.6, bz: side * .2, bvx: 0, bvy: 0, bvz: side * 3 };
  let impacts = 0;
  assert(!m.stepVolleyballBall(outgoing, 0, .05, .44, undefined, () => impacts++));
  assert(outgoing.bz * side >= .482 && outgoing.bvz * side > 0 && impacts === 0, 'Outgoing overlap separates without replaying net hit');
  const incoming = { ...outgoing, bz: side * .2, bvz: -side * 3 };
  assert(m.stepVolleyballBall(incoming, 0, .05, .44, undefined, () => impacts++));
  assert(incoming.bz * side >= .482 && incoming.bvz * side > 0 && impacts === 1);
}
for (const fps of [10, 20, 60, 144]) for (const big of [false, true]) {
  const radius = m.volleyballBallRadius(big);
  const tapeBall = { bx: 0, by: 3.5, bz: 0, bvx: 0, bvy: -8, bvz: 0 };
  for (let frame = 0; frame < fps * 2; frame++) m.stepVolleyballBall(tapeBall, -14, 1 / fps, radius);
  assert(Math.abs(tapeBall.bz) > radius + .04 && tapeBall.by < m.VOLLEYBALL_NET_TOP, 'Vertical top-tape shots fall into a court instead of getting stuck bouncing forever');
}
console.log('PASS: net top/rounded corners, actual big-ball size, contact-position feedback and incoming/outgoing overlaps at 10–144 FPS.');
const dive = { px: 0, pz: 1, pvx: 0, pvz: -30, pDiveTimer: .5 };
m.moveVolleyballPlayer(dive, 0, -1, 10, .1);
near(dive.pz, .85); near(dive.pvz, 0);
near(m.volleyballCourtZ(-9, 1), .85); near(m.volleyballCourtZ(9, -1), -.85);
for (const [width, height] of [[568, 320], [640, 280], [844, 390], [915, 412], [390, 844]]) {
  assert(m.effectivePixelRatio(width, height, 3, .7) >= 1, 'Phones retain at least CSS-pixel resolution under load');
  near(m.effectivePixelRatio(width, height, 3, 1.5), 1.5);
}
console.log('PASS: net collisions at 20–144 FPS on both sides, big balls, high clearance, sideline clearance, dive boundary and mobile resolution floor.');
const polish = load(`export * from './src/three/volleyballNetElasticity'; export * from './src/components/volleyballSwipe'; export * from './src/network/remoteMotion';`);
for (const side of [-1, 1]) {
  const spring = polish.createNetSpring();
  const ball = { bx: .2, by: 1.6, bz: side * 1, bvx: 0, bvy: 0, bvz: -side * 18 };
  assert(m.stepVolleyballBall(ball, 0, .05, .42, spring));
  spring.update(.08);
  assert(spring.displacement(.2, 1.6) * side < 0, 'Net flexes with impact direction');
  near(spring.displacement(-3.6, 1.6), 0); near(spring.displacement(3.6, 1.6), 0);
  spring.update(2); assert(!spring.active); near(spring.displacement(.2, 1.6), 0);
}
const tinyBall = { bx: 0, by: .2, bz: .8, bvx: 0, bvy: 0, bvz: -10 };
assert(!m.stepVolleyballBall(tinyBall, 0, .2, .1), 'Space below the visible net is open');
for (const [dx, dy] of [[100, 0], [-100, 0], [0, -100], [0, 100], [50, -100]]) {
  const direction = polish.volleyballSwipeDirection(dx, dy, { x: 1, z: 0 }, { x: 0, z: -1 });
  near(direction.x / (Math.hypot(dx, dy) ? dx / Math.hypot(dx, dy) || 1 : 1), dx === 0 ? 0 : 1);
  const target = polish.volleyballSwipeTarget(0, 3, direction);
  const vx = target.x, vz = target.z - 3;
  near(vx * direction.z - vz * direction.x, 0);
  assert(vx * direction.x + vz * direction.z > 0, 'Ball target lies along the swipe, including backward shots');
}
const turned = polish.volleyballSwipeDirection(100, 0, { x: 0, z: 1 }, { x: 1, z: 0 });
near(turned.z, 1); near(turned.x, 0);
assert.equal(polish.volleyballSwipeDirection(5, 5, { x: 1, z: 0 }, { x: 0, z: -1 }), null);
assert(!m.nukeHitAllowed(.1, 0) && !m.nukeHitAllowed(0, .1) && m.nukeHitAllowed(0, 0));
assert(m.NUKE_HIT_RADIUS < 1.1, 'Nuke collision is less generous than the old 1.32m hit cylinder');
for (const fps of [30, 60, 120]) {
  const visual = { x: 0, y: 0, z: 0 }, target = { x: 2, y: 1, z: 0 };
  for (let i = 0; i < fps; i++) polish.smoothRemotePosition(visual, target, 1 / fps);
  assert(Math.abs(visual.x - 2) < 1e-8, 'Remote smoothing is refresh independent');
}
assert(!polish.useHostMotion(1000, 1100)); assert(polish.useHostMotion(1000, 1300)); assert(polish.useHostMotion(1000, 1100, true));
console.log('PASS: elastic net response and pinned posts, camera-relative swipe rays, fair dodge windows and owner-priority remote smoothing.');
for (const refresh of [60, 90, 120]) {
  const budget = m.createFrameBudget();
  for (let i = 0; i < 5; i++) budget.sample(refresh);
  assert.equal(budget.targetFps, refresh);
  near(budget.scale, 1);
  for (let i = 0; i < 8; i++) budget.sample(60);
  near(budget.scale, 1); // 60 FPS must stay sharp even after observing 120 Hz.
  for (let i = 0; i < 4; i++) budget.sample(30);
  assert(budget.scale < 1, 'Sustained stalls can reduce cost within the clarity floor');
}
for (const fps of [30, 60, 120]) {
  const correction = m.nukeAimAssistStep(.06, -.03, 1.8, 55, 1 / fps);
  assert(correction.yaw < 0 && correction.pitch > 0);
  assert(Math.abs(correction.yaw) <= .45 / fps && Math.abs(correction.pitch) <= .45 / fps);
}
assert.equal(m.nukeAimAssistStep(.5, 0, 1.8, 55, 1 / 60).yaw, 0, 'Targets outside the small cone cannot pull the camera');

// A slightly off-centre throw now reaches the body, at both slow and fast refresh rates.
const forgivingAim = m.assistedNukeDirection(Math.sin(.11), -Math.cos(.11), 0, -1);
for (const fps of [20, 30, 60, 120]) {
  const origin = { x: 0, y: 1.12, z: 0 };
  const target = { x: forgivingAim.x * 18, y: 1.12, z: forgivingAim.z * 18 };
  const ball = { ...origin, ...Object.fromEntries(Object.entries(m.nukeThrowVelocity(origin, target, 32)).map(([axis, value]) => ['v' + axis, value])) };
  const duration = 18 / 32;
  for (let elapsed = 0; elapsed < duration;) {
    const dt = Math.min(1 / fps, duration - elapsed); m.advanceNukeThrow(ball, dt); elapsed += dt;
  }
  assert(Math.hypot(ball.x, ball.z + 18) < m.NUKE_HIT_RADIUS, 'Near-reticle throws connect without a perfect centre aim');
  assert(Math.abs(ball.y - 1.12) < 1e-8);
}
assert(m.nukeAimAssistStep(.12, 0, 1.8, 55, 1 / 60).yaw < 0, 'Near-edge targets receive gentle assistance');
assert.equal(m.nukeAimAssistStep(.3, 0, 1.8, 55, 1 / 60).yaw, 0, 'Off-reticle targets remain outside assistance');

// Aim along the actual reticle ray at several target depths, then integrate the
// game projectile through its full flight at different display refresh rates.
const camera = { x: .65, y: 3.4, z: 8.6 }, player = { x: 0, y: .02, z: 0 };
for (const target of [{ x: 0, y: 1.12, z: -4 }, { x: 6, y: 3.5, z: -12 }, { x: -8, y: .12, z: -28 }]) {
  const direction = { x: target.x - camera.x, y: target.y - camera.y, z: target.z - camera.z };
  const point = m.nukeAimPoint(camera, direction, player, target);
  for (const key of ['x', 'y', 'z']) near(point[key], target[key]);
  const distance = Math.hypot(point.x - player.x, point.z - player.z);
  const origin = { x: player.x + (point.x - player.x) / distance * .85, y: 1.14, z: player.z + (point.z - player.z) / distance * .85 };
  const velocity = m.nukeThrowVelocity(origin, point, 26);
  const duration = Math.hypot(point.x - origin.x, point.z - origin.z) / 26;
  for (const fps of [20, 30, 60, 120, 144]) {
    const ball = { ...origin, vx: velocity.x, vy: velocity.y, vz: velocity.z };
    for (let elapsed = 0; elapsed < duration;) {
      const dt = Math.min(1 / fps, duration - elapsed);
      m.advanceNukeThrow(ball, dt); elapsed += dt;
    }
    for (const key of ['x', 'y', 'z']) near(ball[key], target[key]);
  }
}
near(m.nukeAimPoint(camera, { x: 0, y: -.2, z: -1 }, player).y, .12);
for (const height of [240, 390, 720, 1080, 2160]) for (const touch of [false, true]) {
  const delta = m.nukeLookDelta(80, -40, height, touch);
  assert(delta.yaw < 0 && delta.pitch < 0 && Math.abs(delta.yaw) < .4);
}
for (let players = 2; players <= 5; players++) {
  for (let round = 1; round < players; round++) assert.equal(m.nukeRoundSurvivors(players, round), players - round);
}
assert(m.gunFireRequested(true, false, false, true), 'A press and release between frames still fires');
assert(!m.gunFireRequested(true, false, false, false), 'Custom players require manual fire even at visible targets');
assert(!m.gunFireRequested(true, false, false, false, false), 'No idle shots without a target');

// Host combat updates leave on this frame, then replicas reject late/duplicate
// snapshots and accept a new host's independent revision counter.
for (const mode of ['obstacle_rush', 'floor_is_lava', 'volleyball_1v1', 'volleyball_2v2']) {
  const room = { mode, hostId: 'host' }, sent = [];
  const client = { currentRoom: room, playerId: 'host', sendGameEvent: (kind, payload) => sent.push({ kind, payload }) };
  const host = m.createMatchSync(mode, true, client);
  const state = { hp: 100, deaths: 0 };
  host.publish(.016, () => ({ ...state })); assert.equal(sent.length, 0);
  state.hp = 0; state.deaths = 1; host.invalidate(); host.invalidate();
  host.publish(0, () => ({ ...state })); assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.hp, 0);
  host.publish(.016, () => ({ ...state })); assert.equal(sent.length, 1, 'Dirty updates coalesce');
  host.publish(.04, () => ({ ...state })); assert.equal(sent.length, 2);
  const guest = m.createMatchSync(mode, true, { ...client, playerId: 'guest' });
  const newest = sent[1];
  assert(!guest.receive('intruder', newest.kind, newest.payload));
  assert(guest.receive('host', newest.kind, newest.payload));
  assert(!guest.receive('host', sent[0].kind, sent[0].payload));
  assert(!guest.receive('host', newest.kind, newest.payload));
  guest.invalidate(); guest.publish(1, () => ({})); assert.equal(sent.length, 2);
  room.hostId = 'new-host';
  assert(guest.receive('new-host', newest.kind, { revision: 1 }));
}
const history = new Set();
assert(m.acceptEventSequence(history, 3) && m.acceptEventSequence(history, 1));
assert(!m.acceptEventSequence(history, 3));
assert(!m.acceptSequence(5, 4) && m.acceptSequence(5, 6));
near(m.voiceStartTime(10, 12), 10.015);
near(m.voiceStartTime(10, 10.08), 10.08);
const slots = Array.from({ length: 5 }, (_, i) => ({ occupiedBy: i ? 'bot' : 'human', charId: 'green_hoodie', outfitId: '', faceId: '', playerName: 'Player' }));
m.dealCustomCharacters(slots);
assert.equal(new Set(slots.map(slot => slot.charId)).size, 5);
const old = slots.map(slot => slot.charId); m.dealCustomCharacters(slots);
assert(slots.every((slot, index) => slot.charId !== old[index]), 'Each rematch deals a fresh character');

// A connected data peer is not necessarily carrying audio yet.
const client = m.multiplayerClient;
const track = { kind: 'audio', readyState: 'live', muted: true };
const transceiver = { sender: { track }, receiver: { track }, currentDirection: 'sendrecv' };
client.peerConnections.set('peer', { connectionState: 'connected', getTransceivers: () => [transceiver] });
assert(!client.hasDirectAudio('peer', 'receive'), 'Keep voice relay until a real track is audible');
track.muted = false; assert(client.hasDirectAudio('peer', 'receive'));
transceiver.currentDirection = 'recvonly'; assert(!client.hasDirectAudio('peer', 'send'));

// Mock only the audio device: all engine loading/scheduling code runs unchanged.
const requests = [], started = [], contexts = [], listeners = new Map();
const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
class AudioContextMock {
  constructor(options) { this.options = options; this.currentTime = 20; this.sampleRate = 8000; this.state = 'running'; this.destination = {}; this.decoded = 0; contexts.push(this); }
  createBuffer(channels, length, sampleRate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { sampleRate, getChannelData: i => data[i] }; }
  decodeAudioData() { this.decoded++; return Promise.resolve(this.createBuffer(1, 20, 8000)); }
  createBufferSource() { return { playbackRate: param(), connect() {}, disconnect() {}, stop() {}, start(at) { started.push({ at, buffer: this.buffer }); } }; }
  createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
  createBiquadFilter() { return { frequency: param(), Q: param(), gain: param(), connect() {} }; }
  createDynamicsCompressor() { return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {} }; }
  resume() { return Promise.resolve(); }
}
const audio = load(`export { crayonAudio } from './src/audio/crayonAudio';`, {
  window: { AudioContext: AudioContextMock, addEventListener: (name, callback) => listeners.set(name, callback) },
  fetch: url => { requests.push(url); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) }); },
}).crayonAudio;
listeners.get('pointerdown')();
audio.playGunShot(); audio.playShotgunBlast();
assert.equal(started.length, 2, 'Cold shots play without waiting for fetch/decode');
assert(started.every(source => source.at === 20));
assert.equal(contexts[0].options.latencyHint, 'interactive');
await new Promise(resolve => setImmediate(resolve));
assert.equal(requests.length, new Set(requests).size, 'One fetch per sound');
assert.equal(contexts[0].decoded, requests.length, 'One decode per sound');
const before = started.length;
for (let death = 0; death < 5; death++) { contexts[0].currentTime += 2; audio.playDeathSound(true, false, 'green_hoodie'); }
assert.equal(started.length, before + 5, 'Every local death plays immediately');
console.log('PASS: reticle targeting, projectile accuracy at 20–144 FPS, input taps, 2–5 player rounds, immediate combat state, stale packet rejection, random characters, voice fallback and cold/decoded audio scheduling.');

for (const team of ['blue', 'red']) {
 const slots = [{ playerId: 'me', team, slotIndex: 0, occupiedBy: 'human' }, { playerId: 'rival', team: team === 'blue' ? 'red' : 'blue', slotIndex: 1, occupiedBy: 'human' }];
 assert.equal(m.volleyballActorPrefix('volleyball_1v1', slots[1], 'me', team), 'a1', 'Duel opponent never maps to an absent second actor');
 assert.deepEqual({ ...m.volleyballControl({ mode: 'volleyball_1v1', status: 'PLAYING', slots }, 'me') }, { custom: true, partnerBot: false, rival1Bot: false, rival2Bot: false });
}
const stalledBudget = m.createFrameBudget();
for (let i = 0; i < 20; i++) stalledBudget.sample(8);
near(stalledBudget.scale, .85);
console.log('PASS: 1v1 actor/control mapping on either team and adaptive recovery below 10 FPS.');

const spring = load(`export * from './src/three/characterSpring';`).stepCharacterSpring;
for (const [stiffness, damping] of [[210, 11.5], [195, 10.5], [190, 10.5], [185, 10.2], [160, 9.5], [155, 9.2]]) {
  const expected = spring(.1, 1, stiffness, damping, 1, 1);
  for (const fps of [10, 20, 30, 60, 90, 120, 144]) {
    let state = { position: .1, velocity: 1 };
    for (let i = 0; i < fps; i++) state = spring(state.position, state.velocity, stiffness, damping, 1 / fps, 1);
    near(state.position, expected.position); near(state.velocity, expected.velocity);
    let bounce = { position: .2, velocity: 6 };
    for (let i = 0; i < fps * 3; i++) bounce = spring(bounce.position, bounce.velocity, stiffness, damping, 2.5 / fps, .32);
    assert(Math.abs(bounce.position) < .00001 && Math.abs(bounce.velocity) < .00001, 'Slow frames at high game speed settle without body flicker');
  }
}
near(m.gameplayPixelRatio(1.5, 1, true), 1.5);
near(m.gameplayPixelRatio(2, 1, true), 2);
near(m.gameplayPixelRatio(2, .1, true), 1.7);
for (const [width, height] of [[568, 320], [844, 390], [915, 412]]) {
  near(m.effectivePixelRatio(width, height, 3, m.gameplayPixelRatio(2, .85, true)), 1.7);
}
near(m.gameplayPixelRatio(1, 1, true), 1);
near(m.gameplayPixelRatio(1.25, 1, false), 1.25);
console.log('PASS: stable character springs at 10–144 FPS, accelerated game speed and mobile quality presets.');
for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.4, -.3], [0, 0]]) {
  const direction = m.nukeDodgeDirection(x, z, Math.PI / 2);
  near(Math.hypot(direction.x, direction.z), 1);
  for (const heldBallId of [null, 0]) {
    const athlete = { dodgeCooldown: 0, dodgeActiveTimer: 0, catchWindowTimer: 0, grounded: true, knockVx: 0, knockVz: 0, heldBallId };
    assert(m.beginNukeDodge(athlete, direction));
    near(Math.hypot(athlete.knockVx, athlete.knockVz), 10.5);
    assert(!m.nukeHitAllowed(athlete.dodgeActiveTimer, 0));
    assert.equal(athlete.heldBallId, heldBallId, 'Dodge keeps the held ball');
    assert(!m.beginNukeDodge(athlete, direction), 'Repeated input cannot consume a second dodge');
  }
}
console.log('PASS: Nuke directional dodge, held-ball preservation, invulnerability and cooldown.');
