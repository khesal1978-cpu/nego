// In-memory transport tests: no network listeners, external brokers, or real room cache.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const clone = value => JSON.parse(JSON.stringify(value));
const routes = new Map();
const intervals = [];
let clock = Date.now();
class TestDate extends Date { static now() { return clock; } }
const app = { use() {}, get(path, callback) { routes.set('GET ' + path, callback); }, post(path, callback) { routes.set('POST ' + path, callback); } };
const express = Object.assign(() => app, { json: () => () => {}, static: () => () => {} });
const listener = Object.assign(new EventEmitter(), { listen() { /* No OS socket is opened. */ }, address: () => ({ port: 0 }) });
let wss;
class ServerSocket extends EventEmitter {
  static OPEN = 1; readyState = 1;
  send(text) { this.peer?.onmessage?.({ data: text }); }
  ping() { this.emit('pong'); }
  terminate() { this.peer?.close(); }
}
class TestWebSocketServer extends EventEmitter { clients = new Set(); constructor() { super(); wss = this; } }
const mqtt = { connect: () => Object.assign(new EventEmitter(), { connected: false, subscribe() {}, unsubscribe() {}, publish() {} }) };
const memoryFs = { existsSync: () => false, writeFileSync() {}, readFileSync: () => '[]' };
function load(entry, mocks = {}, extra = {}, options = {}) {
  const output = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve(entry)).href) }, ...options }).outputFiles[0].text;
  const exports = {};
  const context = vm.createContext({ exports, module: { exports }, require: name => name in mocks ? mocks[name] : require(name), console, Buffer, URL, URLSearchParams, AbortSignal, structuredClone, Date: TestDate, setInterval: callback => { intervals.push(callback); return { unref() {} }; }, clearInterval() {}, setTimeout, clearTimeout, ...extra });
  vm.runInContext(output, context, { filename: entry });
  return { exports: context.module.exports, context };
}
load('server.ts', { express, fs: memoryFs, http: { createServer: () => listener }, mqtt, ws: { WebSocketServer: TestWebSocketServer, WebSocket: ServerSocket }, vite: { createServer: () => { throw new Error('Vite should not run in this test'); } } }, { process: { env: { NODE_ENV: 'production' }, exit: code => { throw new Error(`Unexpected server exit ${code}`); } } });
assert(wss, 'Server should register WebSocket handlers');

const requests = [];
async function dispatch(url, options = {}) {
  const parsed = new URL(url, 'http://test.invalid');
  const method = options.method ?? 'GET';
  const callback = routes.get(method + ' ' + parsed.pathname);
  assert(callback, `Missing ${method} ${parsed.pathname}`);
  const body = options.body ? JSON.parse(options.body) : {};
  requests.push({ path: parsed.pathname, body });
  let data, status = 200;
  const response = { status(value) { status = value; return this; }, json(value) { data = clone(value); return this; } };
  await callback({ body, query: Object.fromEntries(parsed.searchParams) }, response);
  return { ok: status < 400, status, json: async () => data };
}
class BrowserSocket {
  static OPEN = 1; static CONNECTING = 0;
  readyState = 0;
  constructor() {
    this.server = new ServerSocket(); this.server.peer = this;
    queueMicrotask(() => { wss.clients.add(this.server); wss.emit('connection', this.server); this.readyState = 1; this.onopen?.(); });
  }
  send(text) { this.server.emit('message', Buffer.from(text)); }
  close() { this.readyState = 3; this.server.readyState = 3; wss.clients.delete(this.server); this.server.emit('close'); this.onclose?.(); }
}
const browserWindow = { location: { protocol: 'http:', host: 'test.invalid' }, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} };
const clientModule = load('src/network/multiplayerClient.ts', { mqtt }, { fetch: dispatch, WebSocket: BrowserSocket, window: browserWindow, localStorage: { getItem: () => null, setItem() {} } });
const host = clientModule.exports.multiplayerClient;
const guest = new host.constructor();
assert.equal(host.connected, false);
host.playerName = 'Test host'; guest.playerName = 'Test guest';
host.connect(); guest.connect();
await new Promise(resolve => setImmediate(resolve));
assert(host.connected && guest.connected);
assert(await host.createCustomRoom({ mode: 'obstacle_rush', mapId: 'sky_carnival', maxPlayers: 5, winScore: 5, timerMinutes: 3, difficulty: 'breezy', fillWithBots: true }));
const code = host.currentRoom.code;
assert.equal(guest.publicRooms.find(room => room.code === code)?.humanCount, 1);
assert(await guest.joinCustomRoom(code.toLowerCase()));
assert.equal(host.currentRoom.slots.filter(slot => slot.occupiedBy === 'human').length, 2);
assert.equal(host.currentRoom.slots.find(slot => slot.playerId === guest.playerId).ready, false);
assert.equal(await host.startMatch(), false, 'Unready guests block the host');
assert.equal(await guest.startMatch(), false, 'Guests cannot start a match');
assert.equal(await guest.updateRoomSettings({ timerMinutes: 6 }), false);
assert.equal(await guest.toggleSlotBot(4), false);
guest.send({ type: 'room:start_match' });
assert.match(guest.lastError, /host/i, 'WebSocket obeys host permissions too');

assert(await host.toggleSlotBot(4));
assert.equal(host.currentRoom.slots[4].occupiedBy, 'empty');
assert.equal(guest.currentRoom.slots[4].occupiedBy, 'empty');
assert.equal(await guest.selectSlot(0), false, 'Occupied slots report an error');
assert.match(guest.lastError, /taken/);
assert.equal(requests.filter(request => request.path.endsWith('/toggle-bot') && request.body.playerId === host.playerId).length, 1, 'A bot toggle is sent once');
assert(await host.updateRoomSettings({ mapId: 'lava_foundry', timerMinutes: 5 }));
assert.equal(guest.currentRoom.mapId, 'lava_foundry');
assert.equal(guest.currentRoom.timerMinutes, 5);
assert.equal(guest.currentRoom.slots[4].occupiedBy, 'empty', 'Map changes preserve individual bot choices');
assert(await guest.selectSlot(4));
assert.equal(host.currentRoom.slots[4].playerId, guest.playerId);
assert(await host.updateRoomSettings({ maxPlayers: 2 }));
assert.equal(guest.currentRoom.slots.length, 2);
assert(guest.currentRoom.slots.some(slot => slot.playerId === guest.playerId), 'Shrinking moves high-slot humans safely');
assert(await guest.updateMyRoomPlayer({ ready: true, charId: 'viking_beard' }));
assert.equal(host.currentRoom.slots.find(slot => slot.playerId === guest.playerId).charId, 'viking_beard');
assert(await host.updateRoomSettings({ timerMinutes: 6 }));
assert.equal(guest.currentRoom.slots.find(slot => slot.playerId === guest.playerId).ready, false, 'Changed setup requires readiness again');
assert(await guest.updateMyRoomPlayer({ ready: true }));

let hostStarts = 0, guestStarts = 0, ticks = 0, events = 0;
host.onMatchStart(() => hostStarts++); guest.onMatchStart(() => guestStarts++);
guest.onRemoteTick(packet => { assert.equal(packet.x, 2.5); ticks++; });
guest.onRemoteEvent(packet => { assert.equal(packet.eventKind, 'test-hit'); events++; });
assert(await host.startMatch());
assert.equal(hostStarts, 1); assert.equal(guestStarts, 1, 'State + start notifications only start the game once');
assert(await host.startMatch());
assert.equal(hostStarts, 1); assert.equal(guestStarts, 1, 'Repeated start is idempotent');
host.sendPlayerTick({ slotIndex: 0, x: 2.5, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 });
host.sendGameEvent('test-hit', { hp: 75 });
assert.equal(ticks, 1); assert.equal(events, 1);
assert.equal(await host.updateRoomSettings({ mapId: 'sky_carnival' }), false, 'No setting changes mid-match');
assert.equal(await guest.joinCustomRoom(code), false, 'Joining an active match is explicit');
assert(await host.returnToLobby());
assert.equal(guest.currentRoom.status, 'LOBBY');
assert.equal(guest.currentRoom.slots.find(slot => slot.playerId === guest.playerId).ready, false);
assert.equal(await guest.returnToLobby(), false);

// Switching duel/team formats preserves people and rebuilds opposing teams.
assert(await host.updateRoomSettings({ mode: 'volleyball_1v1', fillWithBots: false }));
assert.equal(host.currentRoom.slots.length, 2);
assert.deepEqual(host.currentRoom.slots.map(slot => slot.team), ['blue', 'red']);
assert(guest.currentRoom.slots.some(slot => slot.playerId === guest.playerId));
assert(await host.updateRoomSettings({ mode: 'volleyball_2v2', fillWithBots: true }));
assert.equal(host.currentRoom.slots.length, 4);
assert(await guest.selectSlot(2));
assert(await host.updateRoomSettings({ mode: 'volleyball_1v1', fillWithBots: false }));
assert.equal(guest.currentRoom.slots.find(slot => slot.playerId === guest.playerId).team, 'red');
assert(await guest.updateMyRoomPlayer({ ready: true }));
assert(await host.startMatch(), 'Two ready humans can start a duel without bots');
assert(await host.returnToLobby());
const oldRoom = clone(host.currentRoom);
assert(await guest.leaveCustomRoom());
assert.equal(host.currentRoom.slots.filter(slot => slot.occupiedBy === 'human').length, 1);
const merge = clientModule.exports.mergeClientRooms;
assert.equal(merge(host.currentRoom, { ...oldRoom, updatedAt: Date.now() + 100000 }).slots.filter(slot => slot.occupiedBy === 'human').length, 1, 'Old versions cannot resurrect a departed player even with a newer timestamp');
assert.equal(guest.currentRoom, null);
assert(await guest.joinCustomRoom(code));
assert(await host.leaveCustomRoom());
assert.equal(guest.currentRoom.hostId, guest.playerId);
assert.equal(guest.currentRoom.slots.filter(slot => slot.isHost).length, 1);
guest.ws.close();
assert.equal(guest.connected, false, 'UI becomes disconnected when WebSocket closes');
guest.connect();
await new Promise(resolve => setImmediate(resolve));
assert(guest.connected && guest.currentRoom.code === code, 'Reconnect keeps the player and room');
guest.ws.close();
clock += 50000;
for (const callback of intervals) callback();
const afterTimeout = await (await dispatch('/api/mp/state')).json();
assert(!afterTimeout.rooms.some(room => room.code === code), 'Abandoned rooms disappear after disconnect grace');
await guest.refreshStateHttp();
assert.equal(guest.currentRoom, null, 'Polling clears a room that is no longer present');

host.connect();
await new Promise(resolve => setImmediate(resolve));
assert.equal(await host.joinCustomRoom('ZZZZZZ'), false);
assert.match(host.lastError, /not found/i);
assert.equal(host.currentRoom, null, 'Invalid join never creates a room');
assert(await host.createCustomRoom({ mode: 'volleyball_2v2', mapId: 'pirate_cove', maxPlayers: 4, winScore: 5, timerMinutes: 3, difficulty: 'breezy', fillWithBots: false }));
assert.equal(await host.startMatch(), false, 'Volleyball requires both complete teams');
assert(await host.updateRoomSettings({ fillWithBots: true }));
assert(await host.startMatch());
assert(await host.leaveCustomRoom());
assert(await host.createCustomRoom({ mode: 'volleyball_1v1', mapId: 'pirate_cove', maxPlayers: 5, winScore: 10, timerMinutes: 3, difficulty: 'breezy', fillWithBots: false }));
assert.equal(host.currentRoom.maxPlayers, 2, 'Duel mode always has two slots');
assert.equal(await host.startMatch(), false, 'An empty rival slot cannot start');
assert(await host.updateRoomSettings({ fillWithBots: true }));
assert(await host.startMatch(), 'A solo host can play a duel against one bot');
assert(await host.leaveCustomRoom());
console.log('PASS: in-memory two-client create/join, ready, permissions, settings, slots, single bot toggle, start deduplication, movement/events, return, host transfer, reconnect and cleanup.');

const ui = load('src/components/CustomLobby.tsx', { mqtt }).exports;
const noop = () => {};
const props = { client: { playerId: 'host' }, connected: true, room: null, rooms: [], error: null, playerName: 'Player', selectedCharacter: 'green_hoodie', mic: false, listen: true, speaking: false, fullscreen: false, maps: Object.fromEntries(['obstacle_rush', 'volleyball_1v1', 'volleyball_2v2', 'floor_is_lava'].map(mode => [mode, [{ id: 'map', name: 'Arena', preview: null }]])), renderPortrait: () => null, onCharacter: noop, onName: noop, onBack: noop, onFullscreen: noop, onDismissError: noop, onResume: noop };
const render = patch => renderToStaticMarkup(React.createElement(ui.CustomLobby, { ...props, ...patch }));
assert.match(render({}), /Create a room/);
assert.match(render({}), /Volleyball 1v1/);
assert.match(render({ connected: false }), /Reconnecting/);
const fixture = { ...oldRoom, hostId: 'host', status: 'LOBBY', slots: [{ ...oldRoom.slots[0], playerId: 'host', isHost: true }, { ...oldRoom.slots[1], playerId: 'guest', isHost: false, ready: false }] };
const guestUi = render({ room: fixture, client: { playerId: 'guest' } });
assert.match(guestUi, /Ready to play/); assert(!guestUi.includes('Start match'));
assert.match(guestUi, /The host manages/);
assert.match(guestUi, /Not ready/);
const hostUi = render({ room: fixture });
assert.match(hostUi, /disabled="">Start match/);
assert(!/bg-gradient|animate-pulse|shadow-\[/.test(hostUi));
const studio = load('src/components/CharacterStudio.tsx').exports;
const studioHtml = renderToStaticMarkup(React.createElement(studio.CharacterStudio, { character: { id: 'green_hoodie', name: 'Athlete', title: 'Ready to play', speed: 4, floatiness: 3, reach: 5 }, selectedCharacter: 'green_hoodie', outfit: 'crown_hoodie', face: 'happy_laugh', head: 'round', name: 'Player', fullscreen: false, wide: true, onCharacter: noop, onOutfit: noop, onFace: noop, onHead: noop, onName: noop, onBack: noop, onFullscreen: noop, portrait: () => null, outfitPreview: () => null }));
assert.match(studioHtml, /Live 3D character preview/);
assert.match(studioHtml, /aria-selected="true"/);
assert.match(studioHtml, /Changes apply instantly/);
console.log('PASS: custom lobby connection/ready/host UI states and accessible character studio markup.');

// Replaceable match snapshots use the unordered movement route, keeping shots reliable.
const receivedRoutes = [];
const fakeChannel = route => ({ readyState: 'open', bufferedAmount: 0, send: value => receivedRoutes.push({ route, message: JSON.parse(value) }) });
host.currentRoom = { ...oldRoom, status: 'PLAYING', slots: [{ ...oldRoom.slots[0], playerId: host.playerId, occupiedBy: 'human' }, { ...oldRoom.slots[1], playerId: 'peer_route', occupiedBy: 'human' }] };
host.movementChannels.set('peer_route', fakeChannel('movement'));
host.actionChannels.set('peer_route', fakeChannel('actions'));
host.sendGameEvent('obstacle_rush:state', { revision: 1 });
host.sendGameEvent('gun:fire', { shot: 1 });
assert.equal(receivedRoutes[0].route, 'movement'); assert.equal(receivedRoutes[1].route, 'actions');
host.movementChannels.get('peer_route').bufferedAmount = 40000;
host.sendGameEvent('obstacle_rush:state', { revision: 2 });
assert.equal(receivedRoutes.length, 2, 'Congested replaceable snapshots are dropped, not queued');
host.sendGameEvent('gun:fire', { shot: 2 });
assert.equal(receivedRoutes.length, 3, 'Shot actions remain deliverable when movement is congested');
console.log('PASS: replaceable snapshots use bounded movement channels; combat actions retain reliable delivery.');

// A slow/unavailable peer cannot take away another peer's direct route.
host.currentRoom.slots.push({ ...oldRoom.slots[1], playerId: 'relay_only', occupiedBy: 'human' });
host.movementChannels.get('peer_route').bufferedAmount = 0;
let relays = 0;
const originalSend = host.send;
host.send = () => relays++;
host.sendGameEvent('obstacle_rush:state', { revision: 3 });
assert.equal(receivedRoutes.at(-1).route, 'movement');
assert.equal(relays, 1, 'Fallback still reaches the unavailable peer');
host.send = originalSend;
console.log('PASS: duel room lifecycle, team switching and mixed direct/relay peer delivery.');

// The final snapshot has no later frame to replace it after the canvas unmounts.
host.actionChannels.get('peer_route').bufferedAmount = 40000;
host.sendGameEvent('obstacle_rush:state', { revision: 4, matchEnded: true });
assert.equal(receivedRoutes.at(-1).route, 'actions');
assert.equal(receivedRoutes.at(-1).message.payload.matchEnded, true, 'Results survive congested movement and action channels');
console.log('PASS: final results use reliable delivery instead of the replaceable movement queue.');

let iceConfig, restarts = 0;
const peer = { connectionState: 'connecting', getConfiguration: () => ({}), setConfiguration(value) { iceConfig = value; }, restartIce() { restarts++; }, close() {} };
host.peerConnections.set('peer_route', peer);
host.handleMessage({ type: 'rtc:config', relay: true, expiresIn: 3600, iceServers: [{ urls: 'turn:relay.test:3478', username: 'temporary', credential: 'temporary-key' }] });
assert.equal(iceConfig.iceServers[0].username, 'temporary'); assert.equal(restarts, 1);
peer.connectionState = 'connected';
host.handleMessage({ type: 'rtc:config', relay: true, expiresIn: 3600, iceServers: [{ urls: 'turn:relay.test:3478', username: 'refreshed', credential: 'new-key' }] });
assert.equal(iceConfig.iceServers[0].username, 'refreshed'); assert.equal(restarts, 1, 'Refreshing credentials preserves connected peers');
host.cleanupVoicePeers();
assert.equal(host.iceRefreshTimer, null); assert.equal(host.peerConnections.size, 0);
console.log('PASS: live ICE configuration, connecting-peer restart, connected-peer refresh and room cleanup.');

const idle = new host.constructor();
const beforeIdle = requests.length;
idle.syncProfile('Solo', 'green_hoodie', 'crown_hoodie', 'happy_laugh');
await idle.refreshStateHttp();
assert.equal(requests.length, beforeIdle, 'Solo profile and refresh do not contact multiplayer');
assert.equal(idle.ws, null); assert.equal(idle.pendingWsQueue.length, 0);
idle.connect(); await new Promise(resolve => setTimeout(resolve, 10));
assert(idle.connected, 'Entering multiplayer opens the connection');
idle.currentRoom = { code: 'KEEP' }; idle.disconnectWhenIdle();
assert(idle.connected, 'Match and lobby membership keep the connection');
idle.currentRoom = null; idle.disconnectWhenIdle();
assert.equal(idle.ws, null); assert.equal(idle.pollTimer, null); assert.equal(idle.reconnectTimer, null);
const afterDisconnect = requests.length;
await idle.refreshStateHttp(); assert.equal(requests.length, afterDisconnect);
console.log('PASS: solo stays offline; multiplayer opens on demand and stops polling/reconnecting after leaving.');
