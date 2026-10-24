import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:3001';
const download = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
const executable = path.join(root, '.npm-cache', 'cloudflared.exe');

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This launcher is for 64-bit Windows.');
  const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  const health = response?.ok ? await response.json().catch(() => null) : null;
  if (health?.status !== 'ok' || typeof health.instanceId !== 'string' || typeof health.activeRooms !== 'number') {
    throw new Error(`Start the SIXGUN game server on ${origin} first, then reopen this launcher.`);
  }
  // A production preview shares the same room backend without exposing Vite source files.
  const page = await fetch(origin, { signal: AbortSignal.timeout(5000) });
  if ((await page.text()).includes('/@vite/client')) {
    throw new Error('The server is in development mode. Build the game and run the server with NODE_ENV=production before sharing it.');
  }
  try { await fs.access(executable); }
  catch {
    console.log('Downloading the official Cloudflare tunnel client…');
    const client = await fetch(download, { signal: AbortSignal.timeout(120000) });
    if (!client.ok) throw new Error(`Cloudflare client download failed: HTTP ${client.status}`);
    const data = Buffer.from(await client.arrayBuffer());
    if (data.length < 1000000 || data[0] !== 0x4d || data[1] !== 0x5a) throw new Error('The download is not a Windows executable.');
    await fs.mkdir(path.dirname(executable), { recursive: true });
    const partial = `${executable}.download`;
    await fs.writeFile(partial, data);
    await fs.rename(partial, executable);
  }
  console.log('Open the https://…trycloudflare.com URL printed below on both devices.');
  console.log('Create/join the same room, enable the mic, and allow microphone access.');
  console.log('The public link works only while this window and the game server remain open. Press Ctrl+C to stop.');
  const tunnel = spawn(executable, ['tunnel', '--no-autoupdate', '--url', origin, '--protocol', 'http2'], { stdio: 'inherit', windowsHide: true });
  const stop = () => tunnel.kill();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  tunnel.once('error', error => { console.error(error.message); process.exitCode = 1; });
  tunnel.once('exit', code => {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    if (code) process.exitCode = code;
  });
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
