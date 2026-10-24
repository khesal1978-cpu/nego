import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Discover the API's source graph, then emit separate ESM files as Vercel does.
// Bundling would hide missing file extensions in Node's runtime imports.
const graph = await build({ entryPoints: ['api/multiplayer.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false, metafile: true });
const outdir = '.npm-cache/vercel-runtime-test';
await build({ entryPoints: Object.keys(graph.metafile.inputs), outbase: '.', outdir, bundle: false, platform: 'node', format: 'esm', target: 'node22' });
const entry = pathToFileURL(resolve(outdir, 'api/multiplayer.js')).href;
const probe = `
  import assert from 'node:assert/strict';
  import { once } from 'node:events';
  import { Server } from 'node:http';
  const { default: server } = await import(${JSON.stringify(entry)});
  assert(server instanceof Server, 'Vercel entry exports a native HTTP server');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + '/api/multiplayer?route=/api/health');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, 'setup_required');
    const room = await fetch(base + '/api/multiplayer?route=/api/mp/room/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: 'runtime-probe' }) });
    assert.equal(room.status, 503);
    assert.match((await room.json()).error, /MONGODB_URI/);
    console.log('PASS: unbundled Vercel ESM entry starts under Node and serves health/room setup responses.');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
`;
const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
  env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: '', MONGODB_DB: 'sixzun', ALLOWED_ORIGINS: '', CLOUDFLARE_TURN_KEY_ID: '', CLOUDFLARE_TURN_API_TOKEN: '' },
  encoding: 'utf8', timeout: 10000, windowsHide: true,
});
assert.ifError(result.error);
assert.equal(result.status, 0, result.stderr || result.stdout);
process.stdout.write(result.stdout);
