import { createVercelMultiplayer } from '../server/vercelMultiplayer';

// Native Node HTTP/WebSocket server export, supported by Vercel Functions.
// Vercel owns the listener and connection lifetime; do not call listen() here.
export default createVercelMultiplayer();
