import { buildSync } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('.npm-cache', { recursive: true });
buildSync({
  entryPoints: ['src/components/gunFightCombat.test.ts'],
  outfile: '.npm-cache/gun-combat-tests.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const result = spawnSync(process.execPath, ['--test', '.npm-cache/gun-combat-tests.cjs'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
