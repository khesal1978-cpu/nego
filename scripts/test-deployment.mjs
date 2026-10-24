import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import WebSocket from 'ws';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function clientConfig(origin) {
  const code = buildSync({ entryPoints: ['src/network/deploymentConfig.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, define: { __SIXZUN_MULTIPLAYER_URL__: JSON.stringify(origin), __SIXZUN_PUBLIC_MQTT__: 'false' } }).outputFiles[0].text;
  const context = { module: { exports: {} }, URL }; vm.runInNewContext(code, context); return context.module.exports;
}
const local = clientConfig(''), remote = clientConfig('https://example.onrender.com/');
assert.equal(local.multiplayerSocket({ protocol: 'http:', host: 'localhost:3001' }), 'ws://localhost:3001/ws');
assert.equal(remote.multiplayerSocket({ protocol: 'https:', host: 'game.vercel.app' }), 'wss://example.onrender.com/ws');
assert.equal(remote.multiplayerApi('/api/health'), 'https://example.onrender.com/api/health');
assert.equal(remote.PUBLIC_MQTT_ENABLED, false);
for (const value of ['http://public.example', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?q=1', 'javascript:alert(1)']) assert.throws(() => local.normalizeBackendOrigin(value));

buildSync({ stdin: { contents: `export * from './server/turnCredentials'; export * from './server/originPolicy'; export * from './src/network/iceRecovery'; export * from './src/components/GameInfo'; export * from './src/content/privacy';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outfile: '.npm-cache/deployment-test.mjs' });
const m = await import('../.npm-cache/deployment-test.mjs');
const origin = 'https://game.vercel.app', policy = m.createOriginPolicy(origin, true);
assert(policy(origin, 'backend.onrender.com')); assert(policy(undefined, 'backend.onrender.com'));
for (const value of ['https://bad.example', 'https://game.vercel.app.evil.test', 'null', 'https://game.vercel.app/path']) assert(!policy(value, 'backend.onrender.com'));
let now = 10000, calls = 0;
const provider = m.createTurnCredentials({ CLOUDFLARE_TURN_KEY_ID: 'test-id', CLOUDFLARE_TURN_API_TOKEN: 'backend-secret' }, async (url, init) => {
  calls++; assert(url.endsWith('/test-id/credentials/generate-ice-servers'));
  assert.equal(init.headers.Authorization, 'Bearer backend-secret'); assert.equal(JSON.parse(init.body).ttl, 3600);
  return { ok: true, json: async () => ({ iceServers: [{ urls: ['turn:relay.test:3478?transport=udp', 'turn:relay.test:53'], username: 'short-lived', credential: 'temporary-key' }] }) };
}, () => now);
const [first, second] = await Promise.all([provider.get('A'), provider.get('A')]);
assert(first.relay && second.relay); assert.equal(calls, 1, 'Concurrent credentials requests coalesce');
assert.equal(first.iceServers[0].urls.length, 1, 'Browser-incompatible port 53 is excluded');
assert(!JSON.stringify(first).includes('backend-secret'));
now += 100000; assert((await provider.get('A')).expiresIn < 3600); assert.equal(calls, 1);
now += 3400000; await provider.get('A'); assert.equal(calls, 2);
let failures = 0;
const failing = m.createTurnCredentials({ CLOUDFLARE_TURN_KEY_ID: 'id', CLOUDFLARE_TURN_API_TOKEN: 'token' }, () => { failures++; throw Error('provider down'); });
assert(!(await failing.get('A')).relay); assert(!(await failing.get('A')).relay); assert.equal(failures, 2, 'Failure cannot leave a stuck pending request');
assert(!(await m.createTurnCredentials({}).get('B')).relay);
const retryTasks = new Map(); let retryId = 0, restarts = 0, refreshes = 0;
const peer = { connectionState: 'connected', restartIce() { restarts++; } };
const stopRecovery = m.watchIceRecovery(peer, () => refreshes++, { set(callback, delay) { retryTasks.set(++retryId, { callback, delay }); return retryId; }, clear(id) { retryTasks.delete(id); } });
peer.connectionState = 'disconnected'; peer.onconnectionstatechange();
assert.equal([...retryTasks.values()][0].delay, 4000);
peer.connectionState = 'connected'; peer.onconnectionstatechange(); assert.equal(retryTasks.size, 0, 'A brief handover does not restart ICE');
for (let i = 0; i < 5; i++) {
  peer.connectionState = 'failed'; peer.onconnectionstatechange();
  for (const [id, task] of retryTasks) { retryTasks.delete(id); task.callback(); }
}
assert.equal(restarts, 2); assert.equal(refreshes, 2, 'Permanently blocked peers cannot create a retry storm');
peer.connectionState = 'connected'; peer.onconnectionstatechange();
peer.connectionState = 'disconnected'; peer.onconnectionstatechange(); stopRecovery();
assert.equal(retryTasks.size, 0, 'Leaving a room cancels pending recovery');
const html = renderToStaticMarkup(React.createElement(m.GameInfo));
assert(html.includes(`href="${m.CREATOR_URL}"`)); assert(html.includes('/privacy.html'));
const privacy = readFileSync('public/privacy.html', 'utf8');
for (const section of m.PRIVACY_SECTIONS) assert(privacy.includes(section.title));
assert(html.includes('Privacy Policy') && privacy.includes(m.PRIVACY_UPDATED));
console.log('PASS: split-origin URLs, allowlist, TURN credential cache/coalescing/expiry/failure and policy/credit rendering.');

// Exercise a disposable production backend, never the user's preview or a provider.
buildSync({ entryPoints: ['server.ts'], outfile: '.npm-cache/deployment-server-test.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
const child = spawn(process.execPath, ['.npm-cache/deployment-server-test.mjs'], { env: { ...process.env, NODE_ENV: 'production', PORT: '0', SERVE_FRONTEND: 'false', ROOM_CACHE_ENABLED: 'false', ENABLE_PUBLIC_MQTT: 'false', ALLOWED_ORIGINS: origin, CLOUDFLARE_TURN_KEY_ID: '', CLOUDFLARE_TURN_API_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let log = '', ws;
try {
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Backend startup timed out: ' + log)), 10000);
    child.on('exit', code => { clearTimeout(timeout); reject(Error('Backend exited: ' + code + ' ' + log)); });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.stderr.on('data', data => { log += data; });
    child.stdout.on('data', data => { log += data; const match = log.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
  });
  const health = await fetch(base + '/api/health', { headers: { Origin: origin } });
  assert.equal(health.status, 200); assert.equal(health.headers.get('access-control-allow-origin'), origin); assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal((await health.json()).status, 'ok');
  assert.equal((await fetch(base + '/api/health', { headers: { Origin: 'https://bad.example' } })).status, 403);
  assert.equal((await fetch(base + '/api/mp/state', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } })).status, 204);
  assert.equal((await fetch(base + '/missing')).status, 404, 'Backend never serves a game SPA in backend-only mode');
  const roomBody = JSON.stringify({ playerId: 'deployment-http-probe', name: 'Probe', customCode: 'SAFE' });
  const compressed = gzipSync(roomBody);
  for (const body of [compressed, Buffer.concat([compressed, Buffer.from('trailing garbage')])]) {
    const response = await fetch(base + '/api/mp/room/create', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body });
    assert.equal(response.status, 415, 'Compressed JSON is rejected before decompression');
    await response.text();
  }
  const plain = await fetch(base + '/api/mp/room/create', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: roomBody });
  assert.equal(plain.status, 200, 'Plain JSON room requests still work after malformed compressed bodies');
  assert.equal((await plain.json()).room.code, 'SAFE');
  assert.equal((await fetch(base + '/api/health', { headers: { Origin: origin } })).status, 200, 'Backend survives malformed compressed bodies');
  ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin });
  await once(ws, 'open');
  const identified = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('WebSocket identity response timed out')), 3000);
    ws.on('message', data => { const message = JSON.parse(data); if (message.type === 'rooms:list') { clearTimeout(timeout); resolve(message); } });
  });
  ws.send(JSON.stringify({ type: 'player:identify', playerId: 'deployment-probe', name: 'Probe' })); await identified;
  const rejected = new WebSocket(base.replace('http:', 'ws:') + '/ws', { origin: 'https://bad.example' });
  await new Promise((resolve, reject) => { rejected.once('error', error => { assert.match(error.message, /403/); resolve(); }); rejected.once('open', () => { rejected.close(); reject(Error('Disallowed WS origin connected')); }); });
  console.log('PASS: disposable production backend compressed-body rejection/recovery, HTTP health, CORS/preflight, WebSocket identity and rejected cross-origin upgrades.');
} finally {
  ws?.terminate(); child.kill(); await once(child, 'exit').catch(() => {});
}
