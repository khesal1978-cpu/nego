import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import WebSocket from 'ws';

await build({ stdin: { contents: `export * from './server/mongoRooms'; export * from './server/vercelMultiplayer'; export * from './server/roomRoutes';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/vercel-test.mjs' });
const { createMongoRoomStore, mongoEnvironment, createVercelMultiplayer, executeRoomRequest } = await import('../.npm-cache/vercel-test.mjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check, description) {
  const until = Date.now() + 4000;
  while (Date.now() < until) { if (check()) return; await delay(10); }
  assert.fail('Timed out: ' + description);
}
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; }

// Exercise the actual Mongo adapter against an in-memory collection boundary.
// Real local HTTP/WS transports are used; no Atlas credentials are needed.
let conflicts = 0, fail = false;
const documents = new Map(), streams = new Set(), commits = [], commands = [];
const clone = value => structuredClone(value);
function emitDocument(document) {
  for (const stream of streams) if (stream.namespace === document.namespace) stream.push({ fullDocument: clone(document) });
}
const emit = message => emitDocument({ namespace: 'test', kind: message.kind === 'commit' ? 'state' : 'relay', commit: message, payload: message, expiresAt: new Date(Date.now() + 30000) });
class FakeStream {
  queue = []; closed = false; pending = null; opened = false;
  constructor(namespace) { this.namespace = namespace; }
  open() { if (!this.opened) { this.opened = true; streams.add(this); } }
  push(value) { if (this.pending) { const resolve = this.pending; this.pending = null; resolve({ value, done: false }); } else this.queue.push(value); }
  async tryNext() { this.open(); await delay(0); return this.queue.shift() || null; }
  async next() { this.open(); if (this.queue.length) return { value: this.queue.shift(), done: false }; if (this.closed) return { done: true }; return new Promise(resolve => { this.pending = resolve; }); }
  async close() { this.closed = true; streams.delete(this); this.pending?.({ done: true }); this.pending = null; }
  async return() { await this.close(); return { done: true }; }
  [Symbol.asyncIterator]() { return this; }
}
const collection = {
  async createIndex(keys, options) { assert.deepEqual(keys, { expiresAt: 1 }); assert.equal(options.expireAfterSeconds, 0); },
  async findOne(filter) { commands.push('findOne'); if (fail) throw Error('mongodb+srv://user:test-only-secret@private-host'); const snapshot = clone(documents.get(filter._id) || null); await delay(10); return snapshot; },
  async insertOne(document) {
    commands.push(document.kind === 'relay' ? 'relay' : 'insert');
    if (fail) throw Error('test-only-secret');
    if (documents.has(document._id)) { conflicts++; throw Object.assign(Error('duplicate key'), { code: 11000 }); }
    documents.set(document._id, clone(document)); if (document.commit) commits.push(clone(document.commit)); emitDocument(document);
    return { insertedId: document._id };
  },
  async replaceOne(filter, document) {
    commands.push('replace'); if (fail) throw Error('test-only-secret');
    const current = documents.get(filter._id);
    if (!current || current.record.epoch !== filter['record.epoch'] || current.record.revision !== filter['record.revision']) { conflicts++; return { matchedCount: 0 }; }
    documents.set(document._id, clone(document)); commits.push(clone(document.commit)); emitDocument(document); return { matchedCount: 1 };
  },
  watch(pipeline, options) { assert.equal(options.fullDocument, 'updateLookup'); return new FakeStream(pipeline[0].$match['fullDocument.namespace']); },
};
const database = { collection(name) { assert.equal(name, 'multiplayer_runtime'); return collection; } };
const config = { uri: 'mongodb+srv://user:test-only-secret@cluster.example', database: 'sixzun_test', namespace: 'test' };
const storeA = createMongoRoomStore(config, database), storeB = createMongoRoomStore(config, database);
const servers = [], sockets = [];
async function start(store) { const server = createVercelMultiplayer({}, store); servers.push(server); return listen(server); }
async function post(base, action, body) {
  const response = await fetch(base + '/api/mp/room/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function connect(base, playerId) {
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws'); sockets.push(ws);
  const messages = []; ws.on('message', raw => messages.push(JSON.parse(raw)));
  await once(ws, 'open'); ws.send(JSON.stringify({ type: 'player:identify', playerId, name: playerId }));
  await eventually(() => messages.some(m => m.type === 'rooms:list'), 'identity');
  return { ws, messages, send: message => ws.send(JSON.stringify(message)) };
}
try {
  assert.equal(mongoEnvironment({}), null);
  assert.equal(mongoEnvironment({ MONGODB_URI: config.uri }).database, 'sixzun');
  assert.equal(mongoEnvironment({ MONGODB_URI: config.uri, VERCEL_PROJECT_ID: 'one', VERCEL_ENV: 'production' }).namespace, 'sixzun:one:production');
  for (const uri of ['https://redis.example', 'file:///private', 'invalid']) assert.throws(() => mongoEnvironment({ MONGODB_URI: uri }));
  assert.throws(() => mongoEnvironment({ MONGODB_URI: config.uri, MONGODB_DB: 'invalid/db' }));
  const missing = await start();
  assert.equal((await fetch(missing + '/api/health')).status, 503);
  assert.equal((await post(missing, 'create', { playerId: 'host' })).status, 503);
  const a = await start(storeA), b = await start(storeB);
  assert.equal((await fetch(a + '/api/multiplayer?route=/api/health')).status, 200);
  assert.equal((await (await fetch(a + '/api/health')).json()).storage, 'mongodb');
  assert.equal((await fetch(a + '/api/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post(a, 'create', { playerId: {} })).status, 400);

  const compressed = gzipSync(JSON.stringify({ playerId: 'compressed-probe' }));
  for (const body of [compressed, Buffer.concat([compressed, Buffer.from('trailing garbage')])]) {
    const response = await fetch(a + '/api/mp/room/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body });
    assert.equal(response.status, 415, 'Compressed JSON is rejected before decompression');
    await response.text();
  }
  assert.equal((await fetch(a + '/api/health')).status, 200, 'Vercel endpoint survives malformed compressed bodies');

  assert.equal((await post(a, 'create', { playerId: 'host', name: 'Host', customCode: 'CROSS', mode: 'volleyball_2v2', fillWithBots: false })).status, 200, 'Plain JSON room requests still work after malformed compressed bodies');
  const joined = await Promise.all(['peerA', 'peerB', 'peerC'].map((playerId, i) => post(i % 2 ? a : b, 'join', { playerId, code: 'CROSS', preferredSlot: 1 })));
  assert(joined.every(result => result.status === 200)); assert(conflicts > 0, 'Concurrent writes must exercise a CAS retry');
  let state = await storeA.read(), room = state.snapshot.rooms[0];
  assert.equal(new Set(room.slots.map(slot => slot.playerId)).size, 4, 'All simultaneous joins survive');
  assert.equal((await post(b, 'join', { playerId: 'extra', code: 'CROSS' })).status, 400);
  assert.equal((await post(b, 'start', { playerId: 'peerA', roomCode: 'CROSS' })).status, 403);
  assert.equal((await post(a, 'start', { playerId: 'host', roomCode: 'CROSS' })).status, 403, 'Ready gate');

  const host = await connect(a, 'host'), peer = await connect(b, 'peerA');
  await eventually(() => streams.size === 2, 'Both instances subscribe');
  for (const playerId of ['peerA', 'peerB', 'peerC']) assert.equal((await post(b, 'player', { playerId, roomCode: 'CROSS', ready: true })).status, 200);
  const started = await post(a, 'start', { playerId: 'host', roomCode: 'CROSS' });
  assert.equal(started.body.room.status, 'PLAYING'); const matchId = started.body.room.matchId;
  await eventually(() => peer.messages.some(m => m.room?.matchId === matchId), 'Cross-instance match start');
  const event = { type: 'game:event', eventKind: 'volleyball:hit', roomCode: 'CROSS', matchId, payload: { label: 'a,b,c', value: 42 } };
  host.send(event);
  await eventually(() => peer.messages.some(m => m.type === 'game:event' && m.payload.value === 42), 'Cross-instance Mongo change-stream relay');
  assert.equal(peer.messages.find(m => m.type === 'game:event').senderId, 'host');
  const count = peer.messages.filter(m => m.type === 'game:event').length;
  emitDocument({ namespace: 'other-project', kind: 'relay', payload: { kind: 'relay', instance: 'other', packets: [{ roomCode: 'CROSS', senderId: 'host', packet: { ...event, payload: { value: 100 } } }] }, expiresAt: new Date(Date.now() + 30000) });
  emitDocument({ namespace: 'test', kind: 'relay', payload: { kind: 'relay', instance: 'other', packets: [{ roomCode: 'CROSS', senderId: 'host', packet: { ...event, payload: { value: 101 } } }] }, expiresAt: new Date(Date.now() - 1) });
  host.send({ ...event, matchId: 'old-match' });
  host.send({ type: 'voice:signal', signal: { type: 'offer' } });
  await delay(80);
  assert.equal(peer.messages.filter(m => m.type === 'game:event').length, count);
  const beforeBatch = commands.filter(command => command === 'relay').length;
  for (let i = 0; i < 10; i++) host.send({ type: 'game:player_state', roomCode: 'CROSS', matchId, position: { x: i }, sequence: i });
  await eventually(() => peer.messages.some(m => m.type === 'game:player_state' && m.sequence === 9), 'Latest replaceable state reaches the other instance');
  assert.equal(commands.filter(command => command === 'relay').length, beforeBatch + 1, 'A movement burst is one batched database write');
  assert.equal(peer.messages.filter(m => m.type === 'game:player_state').length, 1, 'Intermediate replaceable movement is coalesced');
  assert(!peer.messages.some(m => m.type === 'voice:signal'), 'Untargeted signaling is rejected');
  host.send({ type: 'voice:signal', targetId: 'peerA', signal: { type: 'offer', sdp: 'test,signal' } });
  await eventually(() => peer.messages.some(m => m.type === 'voice:signal'), 'Targeted signaling');

  // A socket moving to the other instance keeps its shared room and match.
  peer.ws.terminate(); const reconnected = await connect(a, 'peerA');
  await eventually(() => reconnected.messages.some(m => m.room?.matchId === matchId), 'Reconnect room recovery');
  const relayBefore = commands.filter(command => command === 'relay').length;
  host.send({ ...event, payload: { value: 43 } });
  await eventually(() => reconnected.messages.some(m => m.payload?.value === 43), 'Same-instance delivery');
  await eventually(() => commands.filter(command => command === 'relay').length === relayBefore + 1, 'Other room members without local sockets still require relay');
  reconnected.send({ type: 'room:return_lobby', roomCode: 'CROSS' });
  await eventually(() => reconnected.messages.some(m => m.type === 'room:error'), 'WS host permission gate');
  host.send({ type: 'room:return_lobby', roomCode: 'CROSS' });
  await eventually(() => reconnected.messages.some(m => m.room?.status === 'LOBBY' && m.room?.matchId === matchId), 'WS room control parity');

  // Duplicate and delayed commits cannot roll the room back or resurrect it.
  const oldCommit = commits.find(commit => commit.notices.some(notice => notice.room?.code === 'CROSS'));
  for (const playerId of ['host', 'peerB', 'peerC']) await post(b, 'leave', { playerId });
  state = await storeB.read(); assert.equal(state.snapshot.rooms[0].hostId, 'peerA', 'Host transfers on leave');
  await post(b, 'leave', { playerId: 'peerA' });
  emit(oldCommit); emit(oldCommit);
  await delay(80);
  reconnected.send({ type: 'rtc:request' }); await delay(30);
  assert(!reconnected.messages.some(m => m.type === 'rtc:config'), 'Deleted room cannot be resurrected by an old commit');
  assert(reconnected.messages.some(m => m.type === 'room:left'));

  // A missed pub/sub event is recovered when a later revision exposes the gap.
  for (const stream of [...streams]) await stream.close();
  await post(a, 'create', { playerId: 'host', customCode: 'AGAIN', mode: 'volleyball_1v1' });
  await eventually(() => streams.size >= 1, 'Subscription reconnect');
  await eventually(() => host.messages.some(m => m.room?.code === 'AGAIN'), 'Reconnect resync');

  // Cold HTTP instance persists fallback presence; expired clients are pruned.
  let record = clone(documents.get('state:test').record);
  record.snapshot.clients.find(client => client.playerId === 'host').lastSeenAt -= 30000;
  documents.get('state:test').record = clone(record);
  const cold = await start(createMongoRoomStore(config, database));
  await fetch(cold + '/api/multiplayer?route=/api/mp/state&playerId=host&roomCode=AGAIN');
  assert(Date.now() - (await storeB.read()).snapshot.clients.find(client => client.playerId === 'host').lastSeenAt < 2000);
  record = clone(documents.get('state:test').record); for (const client of record.snapshot.clients) client.lastSeenAt -= 100000; documents.get('state:test').record = clone(record);
  await storeA.update(engine => executeRoomRequest(engine, 'POST', '/api/mp/room/create', { playerId: 'fresh', customCode: 'FRESH' }));
  state = await storeA.read(); assert.equal(state.snapshot.rooms.length, 1); assert.equal(state.snapshot.rooms[0].code, 'FRESH');

  documents.get('state:test').expiresAt = new Date(Date.now() - 1); // TTL deletion can lag: the adapter must treat it as expired now.
  await post(b, 'create', { playerId: 'host', customCode: 'RESET' });
  emit(oldCommit);
  await eventually(() => host.messages.some(m => m.room?.code === 'RESET'), 'New storage epoch after expiration');

  fail = true;
  assert.equal((await fetch(a + '/api/health')).status, 503);
  const failure = await post(a, 'create', { playerId: 'host' });
  assert.equal(failure.status, 503); assert(!JSON.stringify(failure).includes('test-only-secret'));
  console.log('PASS: MongoDB adapter atomic concurrent joins, Vercel HTTP/WebSockets, change-stream contract, reconnect, host transfer, stale commits, HTTP presence, expiration and sanitized provider failures.');
} finally {
  for (const socket of sockets) socket.terminate();
  for (const stream of [...streams]) await stream.close();
  await delay(20);
  for (const server of servers) { server.closeAllConnections(); server.close(); }

}
