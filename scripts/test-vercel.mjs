import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { buildSync } from 'esbuild';
import WebSocket from 'ws';

buildSync({ stdin: { contents: `export * from './server/redisRooms'; export * from './server/vercelMultiplayer'; export * from './server/roomRoutes';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: '.npm-cache/vercel-test.mjs' });
const { createRedisRoomStore, redisEnvironment, createVercelMultiplayer, executeRoomRequest, COMMIT_ROOMS } = await import('../.npm-cache/vercel-test.mjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check, description) {
  const until = Date.now() + 4000;
  while (Date.now() < until) { if (check()) return; await delay(10); }
  assert.fail('Timed out: ' + description);
}
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; }

// A disposable REST/SSE Redis emulator exercises real fetch and WS transports.
// It implements the CAS contract atomically; no provider credentials are used.
let rawState = null, conflicts = 0, fail = false;
const streams = new Set(), commits = [], commands = [];
const emit = message => {
  const text = `data: message,test:events,${JSON.stringify(message)}\r\n\r\n`;
  for (const res of streams) { res.write(text.slice(0, 23)); res.write(text.slice(23, 53)); res.write(text.slice(53)); }
};
const redis = http.createServer(async (req, res) => {
  assert.equal(req.headers.authorization, 'Bearer test-only-secret');
  if (req.url.startsWith('/subscribe/')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: subscribe,test:events,1\n\n'); streams.add(res);
    req.on('close', () => streams.delete(res)); return;
  }
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const args = JSON.parse(Buffer.concat(chunks).toString()); commands.push(args[0]);
  res.setHeader('Content-Type', 'application/json');
  if (fail) { res.statusCode = 503; res.end('{}'); return; }
  if (args[0] === 'GET') { res.end(JSON.stringify({ result: rawState })); return; }
  if (args[0] === 'EVAL') {
    assert.equal(args[1], COMMIT_ROOMS); assert.equal(args[2], 2);
    if ((rawState || '') !== args[5]) { conflicts++; res.end('{"result":0}'); return; }
    rawState = args[6]; const commit = JSON.parse(args[7]); commits.push(commit); emit(commit);
    res.end('{"result":1}'); return;
  }
  if (args[0] === 'PUBLISH') { emit(JSON.parse(args[2])); res.end('{"result":1}'); return; }
  assert.fail('Unexpected Redis command ' + args[0]);
});
const redisUrl = await listen(redis);
const config = { url: redisUrl, token: 'test-only-secret', namespace: 'test' };
const storeA = createRedisRoomStore(config), storeB = createRedisRoomStore(config);
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
  assert.equal(redisEnvironment({}), null);
  assert.equal(redisEnvironment({ KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'secret' }).token, 'secret');
  for (const url of ['http://redis.example', 'https://u:p@redis.example', 'https://redis.example/path']) assert.throws(() => redisEnvironment({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: 'x' }));
  const missing = await start();
  assert.equal((await fetch(missing + '/api/health')).status, 503);
  assert.equal((await post(missing, 'create', { playerId: 'host' })).status, 503);
  const a = await start(storeA), b = await start(storeB);
  assert.equal((await fetch(a + '/api/multiplayer?route=/api/health')).status, 200);
  assert.equal((await fetch(a + '/api/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post(a, 'create', { playerId: {} })).status, 400);

  await post(a, 'create', { playerId: 'host', name: 'Host', customCode: 'CROSS', mode: 'volleyball_2v2', fillWithBots: false });
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
  await eventually(() => peer.messages.some(m => m.type === 'game:event' && m.payload.value === 42), 'Cross-instance relay and comma-safe SSE');
  assert.equal(peer.messages.find(m => m.type === 'game:event').senderId, 'host');
  const count = peer.messages.filter(m => m.type === 'game:event').length;
  host.send({ ...event, matchId: 'old-match' });
  host.send({ type: 'voice:signal', signal: { type: 'offer' } });
  await delay(80);
  assert.equal(peer.messages.filter(m => m.type === 'game:event').length, count);
  assert(!peer.messages.some(m => m.type === 'voice:signal'), 'Untargeted signaling is rejected');
  host.send({ type: 'voice:signal', targetId: 'peerA', signal: { type: 'offer', sdp: 'test,signal' } });
  await eventually(() => peer.messages.some(m => m.type === 'voice:signal'), 'Targeted signaling');

  // A socket moving to the other instance keeps its shared room and match.
  peer.ws.terminate(); const reconnected = await connect(a, 'peerA');
  await eventually(() => reconnected.messages.some(m => m.room?.matchId === matchId), 'Reconnect room recovery');
  const relayBefore = commands.filter(command => command === 'PUBLISH').length;
  host.send({ ...event, payload: { value: 43 } });
  await eventually(() => reconnected.messages.some(m => m.payload?.value === 43), 'Same-instance delivery');
  await eventually(() => commands.filter(command => command === 'PUBLISH').length === relayBefore + 1, 'Other room members without local sockets still require relay');
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
  for (const stream of streams) stream.end();
  await post(a, 'create', { playerId: 'host', customCode: 'AGAIN', mode: 'volleyball_1v1' });
  await eventually(() => streams.size >= 1, 'Subscription reconnect');
  await eventually(() => host.messages.some(m => m.room?.code === 'AGAIN'), 'Reconnect resync');

  // Cold HTTP instance persists fallback presence; expired clients are pruned.
  let record = JSON.parse(rawState);
  record.snapshot.clients.find(client => client.playerId === 'host').lastSeenAt -= 30000;
  rawState = JSON.stringify(record);
  const cold = await start(createRedisRoomStore(config));
  await fetch(cold + '/api/multiplayer?route=/api/mp/state&playerId=host&roomCode=AGAIN');
  assert(Date.now() - (await storeB.read()).snapshot.clients.find(client => client.playerId === 'host').lastSeenAt < 2000);
  record = JSON.parse(rawState); for (const client of record.snapshot.clients) client.lastSeenAt -= 100000; rawState = JSON.stringify(record);
  await storeA.update(engine => executeRoomRequest(engine, 'POST', '/api/mp/room/create', { playerId: 'fresh', customCode: 'FRESH' }));
  state = await storeA.read(); assert.equal(state.snapshot.rooms.length, 1); assert.equal(state.snapshot.rooms[0].code, 'FRESH');

  rawState = null; // The TTL elapsed while all instances were idle.
  await post(b, 'create', { playerId: 'host', customCode: 'RESET' });
  emit(oldCommit);
  await eventually(() => host.messages.some(m => m.room?.code === 'RESET'), 'New storage epoch after expiration');

  fail = true;
  assert.equal((await fetch(a + '/api/health')).status, 503);
  const failure = await post(a, 'create', { playerId: 'host' });
  assert.equal(failure.status, 503); assert(!JSON.stringify(failure).includes('test-only-secret'));
  console.log('PASS: Vercel API, Redis CAS concurrent joins, permissions, real cross-instance WebSockets/SSE, reconnect, host transfer, stale commits, HTTP presence, expiration and provider failures.');
} finally {
  for (const socket of sockets) socket.terminate();
  for (const stream of streams) stream.end();
  await delay(20);
  for (const server of servers) { server.closeAllConnections(); server.close(); }
  redis.closeAllConnections(); redis.close();
}
