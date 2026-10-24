# Deploy SIXGUN on Vercel with MongoDB Atlas

The game and multiplayer endpoint run in **one Vercel project**, with **MongoDB Atlas Free** for temporary room state and cross-instance events. Leave `VITE_MULTIPLAYER_URL` empty. Redis and a separate Render service are not required.

The repository contains the Atlas integration. A real cluster, its Vercel connection and the hosted deployment still need to be configured. Building succeeds without database credentials; solo play works, while online room actions show a setup message until Atlas is connected.

## Create and connect a free cluster

1. Install dependencies locally with `npm ci`, then push the updated source and **both package.json and package-lock.json** to the existing GitHub repository. Include `api/`, `server/`, `src/`, `scripts/`, `public/` and the root configuration files. Keep `.env`, caches, `node_modules`, `dist`, `build` and `.maintenance` excluded.
2. Open the existing game project in Vercel. Use **Vite**, the repository root, **Node 22.x**, and **Fluid compute**. `vercel.json` supplies the install/build commands, `dist` output, Mumbai (`bom1`) region and a 300-second multiplayer function duration.
3. In Vercel Marketplace/Storage, search for **MongoDB Atlas** and install its native integration. Choose the **Free cluster ($0, 512 MB)** and **Free installation plan ($0)**. Choose Mumbai if available, or the nearest listed region. Name the resource `sixzun` and create it. Free and paid cluster choices are distinct; verify both selections before submitting.
4. Connect the new resource to the game project and its **Production** environment. The integration supplies the server-only **MONGODB_URI**. Set **MONGODB_DB=sixzun** in Project Settings > Environment Variables to choose the application database explicitly.
5. Remove any previous external `VITE_MULTIPLAYER_URL` value and keep `VITE_ENABLE_PUBLIC_MQTT=false`. Old Redis variables are unused by this version. Same-origin requests work automatically; `ALLOWED_ORIGINS` is only needed for additional exact frontend origins.
6. Redeploy after connecting the database or changing variables. Open `/api/health` on the deployment and confirm HTTP 200 with `status: "ok"` and `storage: "mongodb"`. A 503 with `setup_required` means MONGODB_URI is absent; `unavailable` means the cluster, network access or database permissions need checking.

The native integration uses a database user and allows incoming database connections from any IP because Vercel uses dynamic outbound addresses. Authentication is still required. Review the integration's account/network access settings when installing it. These account changes are not performed by this repository. [MongoDB's Vercel integration guide](https://www.mongodb.com/docs/atlas/reference/partner-integrations/vercel/).

The default room namespace isolates the Vercel project and Production/Preview/Development environments. Set `MONGODB_NAMESPACE` only when deliberately choosing a shared namespace. Preview deployments in the same environment can share rooms, so reload all test players onto the same release.

If you already have an Atlas cluster, add its **Connect > Drivers > Node.js** connection string as MONGODB_URI instead of creating another cluster. Use a database user with read/write and index-creation access to `sixzun`, replace the password placeholder with the actual URL-encoded database password, and configure Atlas Network Access for the deployment. Do not paste the URI into chat, client variables or source control.

## Free-plan limits and multiplayer behavior

Atlas Free is **$0** with **512 MB storage including indexes**, **100 read/write operations per second**, **500 database connections**, and **10 GB inbound plus 10 GB outbound transfer per rolling seven days**, checked 24 October 2026. It has throughput and network limits rather than Upstash Free's 500,000-command monthly allowance. These numbers are database limits, not player-count guarantees. Vercel usage limits are separate. [Atlas pricing](https://www.mongodb.com/pricing) and [Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

Solo/bot matches and ordinary menus do not open multiplayer connections. Online room controls use an atomic version-and-epoch check; concurrent joins retry against fresh state instead of overwriting each other. The state and its notification commit are stored in one document. MongoDB change streams notify active Vercel instances, and reconnects reload authoritative room state.

Direct WebRTC carries gameplay where available. Cross-instance fallback stores short-lived relay batches, coalescing intermediate replaceable positions over 50ms while retaining reliable match actions/results. This adds batching delay to fallback delivery; it does not make Atlas a faster game relay than a direct peer connection. Presence writes are batched per active instance every 25 seconds. Each warm instance reuses a MongoDB client with a pool of at most five application connections; driver monitoring connections also count toward Atlas limits.

No 500–1,000 simultaneous-player capacity has been tested. The shared lobby document has defensive bounds of 150 rooms and 750 client records, which are implementation bounds rather than supported capacity. Change-stream reads, cross-instance fallback and many active function instances can reach free-plan throughput/connection limits. Measure actual Atlas/Vercel usage and phone latency before broadly sharing the game.

## Optional connection relay

Direct peers use STUN by default. For networks needing TURN, configure these optional Cloudflare Realtime TURN secrets on the Vercel server:

```text
CLOUDFLARE_TURN_KEY_ID=<TURN key ID>
CLOUDFLARE_TURN_API_TOKEN=<TURN API token>
```

Room participants receive cached, short-lived ICE credentials. Without TURN, the WebSocket/database fallback remains available. TURN has separate provider usage/billing terms and no TURN service is provisioned automatically.

## Verify before sharing

1. Open the same release on two devices, preferably Wi-Fi and mobile data. Check `/api/health`, then create/join the same custom room.
2. Test Volleyball 1v1/2v2, Gun Fight and Nuke: ready/start, movement/actions, results, Back to room and a second match. Check host and guest.
3. Keep a match open beyond five minutes. Vercel closes sockets at the configured function-duration limit; check that the client reconnects and room membership is restored.
4. Try voice opt-in and a Wi-Fi/mobile-data switch. Inspect `/ws` on the game domain and check for connection/storage errors.
5. Check Settings > About, `/privacy.html`, saves after reopening, and iPhone Share > Add to Home Screen.

Local checks: `npm run lint`, `npm run test:vercel`, `npm run test:deployment`, `npm run test:multiplayer`, `npm run test:custom-volleyball`, `npm run build:server`, and `npm run build`. The Vercel test uses the real Atlas adapter with an in-memory MongoDB collection/change-stream boundary plus actual local HTTP/WebSockets. It covers atomic conflicts, room/event delivery, reconnect, host transfer, namespace isolation, expiration and sanitized failures. It does not connect to a real Atlas cluster or measure load capacity/physical-device performance.

The game is at `/`, its standalone policy is at `/privacy.html`, and Settings > About contains the policy and ArsDev YouTube credit. Browser saves remain tied to the browser and website origin.

The Vercel suite also runs `scripts/test-vercel-runtime.mjs`, which emits the API and its source dependencies as separate ESM files and imports the real entry under Node. It checks startup and HTTP setup responses without Atlas credentials. Keep explicit `.js` extensions on relative imports in the API's dependency graph: TypeScript resolves the source files, while Node resolves the emitted JavaScript files.

## Expiration and operational limits

Abandoned clients expire after 90 seconds and are removed during the next state update. The room document expires after two hours without a write. Relay packets expire after 30 seconds; the Atlas TTL index cleans up expired documents asynchronously, and the adapter immediately ignores expired records/packets even before physical deletion. TTL is temporary cleanup, not a game replay/archive feature.

Active rooms survive function restarts while their database state remains valid. Scores remain host-owned; a disconnected match host can interrupt play even while room membership survives. Atlas may pause an unused Free cluster after 30 days without connections. Player IDs are temporary, not authenticated accounts, and this is a casual-game setup rather than an anti-cheat service.

`server.ts` and `render.yaml` remain available for local development and optional standalone hosting. Only that alternate setup uses an external VITE_MULTIPLAYER_URL and an always-on server.

## References

- [Vercel WebSockets and reconnect behavior](https://vercel.com/docs/functions/websockets)
- [Create an Atlas Free cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
- [Atlas Vercel integration](https://www.mongodb.com/docs/atlas/reference/partner-integrations/vercel/)
- [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
- [Cloudflare TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
