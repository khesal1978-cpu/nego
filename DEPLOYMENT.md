# Deploy SIXZUN

Use **Vercel for the game**, **one always-on Render server in Singapore for rooms/WebSockets**, and **Cloudflare TURN for WebRTC connections that need a relay**. The repository is prepared; no hosted service has been created or paid for.

Vercel Functions now support WebSockets, but connections have instance-duration limits and reconnects can reach a different instance. This game's room state lives in memory. A single persistent backend fits the current design without adding a shared database/pub/sub system. Direct WebRTC carries movement when available; the backend remains the fallback and room coordinator. TURN improves connectivity on restrictive networks, but does not guarantee low latency on every connection.

## 1. Create the relay credentials

In Cloudflare Realtime TURN, create a TURN key and its API token. Keep both for Render:

```text
CLOUDFLARE_TURN_KEY_ID=<your TURN key ID>
CLOUDFLARE_TURN_API_TOKEN=<your TURN API token>
```

These are backend secrets. Never place the API token in source control or any `VITE_` variable. The server supplies room participants with short-lived ICE credentials, caches them and refreshes them before expiry. Without valid credentials, rooms still use WebSocket fallback and direct STUN connectivity, but TURN is unavailable. Review Cloudflare's current usage/billing terms.

## 2. Deploy the multiplayer server

1. Push this project to your repository, excluding `.env`, `.npm-cache`, `node_modules`, `dist`, `build`, `.maintenance` and attachments. Review `.gitignore` first.
2. Create a Render Blueprint from the repository and select `render.yaml`.
3. The blueprint selects **Singapore, Starter, one instance**. Starter is paid; review Render's displayed price before creating the service. A sleeping free instance is unsuitable for reliable live rooms.
4. Set the two Cloudflare variables above. Set `ALLOWED_ORIGINS` to your intended Vercel production origin, for example `https://sixzun-example.vercel.app`. Use the actual domain assigned to your project.
5. The blueprint builds with `npm ci --legacy-peer-deps && npm run build:server` and starts with `npm run start:server`. It disables frontend serving, disk room caching and the legacy public MQTT broker. Render supplies `PORT`; Node 22 is declared in `package.json`.
6. Copy the server's HTTPS origin, such as `https://sixzun-multiplayer-example.onrender.com`. Visit `/api/health` there and confirm `status: "ok"`.

## 3. Deploy the game on Vercel

1. Import the same repository. Framework: **Vite**. Root: the project root. Node: **22.x**.
2. Set `VITE_MULTIPLAYER_URL` to the Render HTTPS origin, with no `/ws`, API path, credentials, query or fragment. Set it for Production and any Preview environments you will use.
3. Leave `VITE_ENABLE_PUBLIC_MQTT=false`. No Cloudflare API token belongs on Vercel's client environment.
4. Deploy. `vercel.json` selects `npm ci --legacy-peer-deps`, `npm run build`, and output directory `dist`. A Vercel build without `VITE_MULTIPLAYER_URL` fails with an explicit setup message.
5. Update Render's `ALLOWED_ORIGINS` to the exact final Vercel origin. Multiple origins are comma-separated. Add custom domains or individual preview origins explicitly; do not use a wildcard. Changing backend origins requires a fresh Vercel build.

The game is at `/`; the standalone policy is at `/privacy.html`. **Settings → About** contains the policy and the ArsDev YouTube credit. Saved profiles/tutorial progress remain tied to the browser and stable website origin. They cannot migrate automatically from a temporary tunnel domain.

## 4. Verify before sharing

- Open the Vercel link on two devices, ideally one Wi-Fi and one mobile-data connection. Both players should reload the same release.
- Create and join a custom room, ready/start, move/hit, finish, return to the room and start again. Check both volleyball formats plus Gun Fight and Nuke.
- Try opt-in voice and a Wi-Fi/mobile-data switch. Network delay, packet loss, browser suspension and relay distance still affect matches; actual phones must be tested.
- Confirm the browser connects to the Render `/ws` URL, with no CORS/mixed-content errors. A 403 usually means the exact frontend origin is absent from `ALLOWED_ORIGINS`.
- Verify Settings → About, `/privacy.html`, saved appearance/tutorials after reopening, and iPhone Share → Add to Home Screen behavior. The iPhone browser cannot guarantee native fullscreen on every OS version.

Local checks: `npm run lint`, `npm run test:deployment`, `npm run test:multiplayer`, `npm run test:custom-volleyball`, `npm run test:low-end`, `npm run build:server`, `npm run build`. The deployment tests exercise local HTTP/CORS/WebSocket behavior and mocked TURN; they do not use live provider credentials or measure mobile GPU FPS.

## Operational limits

Keep **one backend instance**. Restarting/redeploying it clears in-memory rooms; disconnected clients reconnect, but an old room may need recreating. Browser saves stay intact. Horizontal scaling requires shared room state/routing first. Room members use temporary player IDs rather than authenticated accounts; this is a casual-game deployment, not an anti-cheat or abuse-proof service. Monitor server resource use and TURN usage before broad promotion.

## Provider references

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets)
- [Render WebSockets](https://render.com/docs/websocket) and [regions](https://render.com/docs/regions)
- [Cloudflare TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
