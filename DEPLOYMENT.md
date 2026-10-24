# Deploy SIXZUN on Vercel

The game and multiplayer endpoint run in **one Vercel project**, with **Upstash Redis** for temporary room state and events shared between function instances. Leave `VITE_MULTIPLAYER_URL` empty. This setup does not require a Render service.

The repository contains the integration. A real Redis database, its Vercel connection and the hosted deployment still need to be configured. Building succeeds without Redis; solo play works, while online room actions show a setup message until storage is connected.

## Connect the project and free storage

1. Push the updated source to the repository already configured as `origin`. Include `api/`, `server/`, `src/`, `scripts/`, `public/` and the root configuration files. Exclude `.env`, caches, `node_modules`, `dist`, `build` and `.maintenance` as specified in `.gitignore`.
2. Import or open that repository in Vercel. Use **Vite**, the repository root, **Node 22.x**, and **Fluid compute**. `vercel.json` supplies the install/build commands, `dist` output, Mumbai (`bom1`) region and a 300-second multiplayer function duration.
3. In the project's **Storage** area, connect **Upstash Redis** through the Marketplace. Select the **Free / $0** plan and a nearby available primary region. Review the displayed plan before creating the database; do not select a paid upgrade.
4. Connect the database to the intended Vercel environments. The backend accepts either `UPSTASH_REDIS_REST_URL` with `UPSTASH_REDIS_REST_TOKEN`, or the Marketplace's `KV_REST_API_URL` with `KV_REST_API_TOKEN`. These must be server environment variables, never `VITE_` variables or committed files. A read-only token cannot update rooms.
5. Remove any old `VITE_MULTIPLAYER_URL` value pointing to an external backend. Keep `VITE_ENABLE_PUBLIC_MQTT=false`. Same-origin requests work automatically; `ALLOWED_ORIGINS` is optional for additional exact origins, comma-separated. No wildcard is needed.
6. Redeploy after attaching storage or changing variables. Open `/api/health` on the deployment and confirm HTTP 200 with `status: "ok"` and `storage: "redis"`. A 503 with `setup_required` means credentials are absent; `unavailable` means Redis cannot be reached or its limits were reached.

The default Redis namespace isolates the Vercel project and Production/Preview/Development environments. Set `REDIS_NAMESPACE` only when deliberately choosing a shared namespace; avoid pointing a test deployment at production room data. Preview deployments within the same environment can share rooms, so reload all test players onto the same release.

The game is at `/`, its standalone policy is at `/privacy.html`, and **Settings → About** contains the policy and ArsDev YouTube credit. Browser saves remain tied to the browser and website origin.

## What uses the free quota

Upstash's published Free plan is **$0**, with **250 MB storage, 500,000 commands/month and 10 GB monthly bandwidth**, checked 24 October 2026. Vercel has its own usage limits. Verify the plan shown in the dashboard; adding a card or selecting another plan may change billing. [Upstash pricing](https://upstash.com/pricing/redis).

Solo/bot matches and ordinary menus do not open multiplayer connections. Online room controls persist authoritative state with an atomic compare-and-set, so simultaneous joins cannot overwrite each other. Presence writes are batched per active instance every 25 seconds. Direct WebRTC carries gameplay when available; fallback to players on another instance uses batched Redis pub/sub and can consume quota much faster. HTTP polling also consumes reads when WebSockets are unavailable.

The command quota measures operations across the month, **not total users or simultaneous players**. No 500–1,000 concurrent-player capacity has been measured. The current shared lobby document has defensive bounds of 150 rooms and 750 client records, which are implementation limits rather than tested capacity. Load testing and dashboard usage measurements are required before increasing these bounds or advertising a player count.

## Optional connection relay

Direct peer connections use STUN by default. For networks that require TURN, configure Cloudflare Realtime TURN on the Vercel server:

```text
CLOUDFLARE_TURN_KEY_ID=<TURN key ID>
CLOUDFLARE_TURN_API_TOKEN=<TURN API token>
```

Keep both secrets server-side. Room participants receive cached, short-lived ICE credentials. Without TURN the WebSocket fallback remains available, but cross-instance fallback uses Redis quota. TURN has separate provider usage/billing terms and is optional; no TURN service is provisioned by the code.

## Verify before sharing

1. Open the same release on two devices, preferably Wi-Fi and mobile data. Check `/api/health` and create/join the same custom room.
2. Test Volleyball 1v1 and 2v2, Gun Fight and Nuke: ready/start, movement/actions, results, Back to room and a second match. Check both host and guest.
3. Keep a match open beyond five minutes. Vercel closes sockets at the configured function-duration limit; the client reconnects and shared storage restores room membership. Confirm play recovers on the hosted deployment.
4. Try voice opt-in and a Wi-Fi/mobile-data switch. Check `/ws` on the game domain and watch for CORS, connection and storage errors.
5. Check Settings → About, `/privacy.html`, saves after reopening, and iPhone Share → Add to Home Screen. Measure real phone FPS/latency and Redis/Vercel usage before broad sharing.

Local verification: `npm run lint`, `npm run test:vercel`, `npm run test:deployment`, `npm run test:multiplayer`, `npm run test:custom-volleyball`, `npm run build:server`, and `npm run build`. The Vercel tests use actual local HTTP, WebSockets and streaming fetch against a disposable Redis emulator; they do not prove hosted routing, provider credentials, load capacity or physical-device performance.

## Operational behavior

Abandoned clients expire after 90 seconds and are removed during the next state update. The shared room document expires after two hours without a write. Redis keeps active rooms across function restarts; it does not preserve a room after storage expires. Gameplay scores remain host-owned, so a disconnected match host can interrupt the match even while membership survives. Player IDs are temporary, not authenticated accounts, and this casual-game setup is not an anti-cheat service.

`server.ts` and the existing `render.yaml` remain available for optional standalone hosting and local development. Only that alternate setup uses `VITE_MULTIPLAYER_URL`, exact-origin allowlisting, and an always-on server. It is not part of the Vercel + Redis setup above.

## References

- [Vercel WebSockets, server exports and reconnect behavior](https://vercel.com/docs/functions/websockets)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Cloudflare TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
