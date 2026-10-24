import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { normalizeBackendOrigin } from './src/network/deploymentConfig.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = normalizeBackendOrigin(env.VITE_MULTIPLAYER_URL || '');
  return {
    plugins: [react(), tailwindcss()],
    define: { __SIXZUN_MULTIPLAYER_URL__: JSON.stringify(backend), __SIXZUN_PUBLIC_MQTT__: JSON.stringify(env.VITE_ENABLE_PUBLIC_MQTT === 'true') },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: false,
      ws: false as const,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
