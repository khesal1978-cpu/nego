import { build } from 'esbuild';
await build({
  entryPoints: ['server.ts'], outfile: 'build/server.mjs', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external',
});
console.log('Multiplayer backend ready: build/server.mjs');
