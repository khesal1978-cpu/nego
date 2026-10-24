import { registerRoomRoutes } from './server/roomRoutes';
import { createRoomEngine, DEFAULT_BOT_CHARS, type CustomRoomState, type CustomSlotState, type ConnectedClient } from './server/roomEngine';
export type { CustomRoomState, CustomSlotState } from './server/roomEngine';
import { latestRoomSnapshot } from './src/network/roomSnapshot';
import { createTurnCredentials } from './server/turnCredentials';
import { createOriginPolicy } from './server/originPolicy';
import { dealCustomCharacters } from './src/network/customCharacters';
import { MAX_REALTIME_BUFFER } from './src/network/transport';
import { customPlayerCount, isVolleyballMode, type CustomMode } from './src/network/customModes';
import express from 'express';
import fs from 'fs';
import http from 'http';
import mqtt from 'mqtt';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOMS_CACHE_FILE = path.join(__dirname, '.mp-rooms-cache.json');
const SERVER_INSTANCE_ID = `srv_${Math.random().toString(36).slice(2, 9)}`;
const CLUSTER_TOPIC_PREFIX = 'sixgun_mp_v3_ba31eb5b';
const roomEngine = createRoomEngine(undefined, notice => {
  if (notice.type === 'room:state') { savePersistedRooms(); broadcastRoomStateLocal(notice.room!.code); publishRoomToCluster(notice.room!); }
  else if (notice.type === 'room:deleted') publishRoomDeleteToCluster(notice.code!);
  else if (notice.type === 'match:start') broadcastMatchStartLocal(notice.room!.code);
  else { savePersistedRooms(); for (const client of clients.values()) sendJson(client.ws, notice); }
});
const { rooms, clients, normalizeRoomCode, findMatchingRoom, generateRoomCode, buildInitialSlots, getOrUpdateClient, getPublicRoomSummaries, removePlayerFromCurrentRoom, handleCreateRoomForClient, handleJoinRoomForClient, roomActionError, applyRoomSettings, applyPlayerUpdate, startRoomMatch, returnRoomToLobby, broadcastRoomState, broadcastPublicRoomList } = roomEngine;






function loadPersistedRooms() {
  if (process.env.ROOM_CACHE_ENABLED === 'false') return;
  try {
    if (fs.existsSync(ROOMS_CACHE_FILE)) {
      const raw = fs.readFileSync(ROOMS_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        for (const r of parsed) {
          if (
            r &&
            typeof r.code === 'string' &&
            now - (r.updatedAt || r.createdAt || 0) < 7200_000
          ) {
            const norm = normalizeRoomCode(r.code);
            if (norm) {
              r.code = norm;
              rooms.set(norm, r);
            }
          }
        }
      }
    }
  } catch (_e) {
    // Ignore cache read errors
  }
}

function savePersistedRooms() {
  if (process.env.ROOM_CACHE_ENABLED === 'false') return;
  try {
    const list = Array.from(rooms.values());
    fs.writeFileSync(ROOMS_CACHE_FILE, JSON.stringify(list), 'utf-8');
  } catch (_e) {
    // Ignore cache write errors
  }
}

loadPersistedRooms();







export function mergeRoomStates(local: CustomRoomState | undefined, incoming: CustomRoomState): CustomRoomState {
  return latestRoomSnapshot(local, { ...incoming, code: normalizeRoomCode(incoming.code) });
}

// ============================================================================
// GLOBAL CROSS-INSTANCE MQTT CLUSTER BRIDGE (Connects ais-dev & ais-pre!)
// ============================================================================
let clusterMqtt: mqtt.MqttClient | null = null;

function initClusterBridge() {
  if (process.env.ENABLE_PUBLIC_MQTT !== 'true') return;
  try {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: `sixgun_srv_${SERVER_INSTANCE_ID}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
    });
    clusterMqtt = client;

    client.on('connect', () => {
      client.subscribe(`${CLUSTER_TOPIC_PREFIX}/rooms/+`, { qos: 1 });
      client.subscribe(`${CLUSTER_TOPIC_PREFIX}/events`, { qos: 0 });
    });

    client.on('message', (topic, payloadBuf) => {
      try {
        if (!payloadBuf || payloadBuf.length === 0) return;
        const data = JSON.parse(payloadBuf.toString());
        if (!data || data.instanceId === SERVER_INSTANCE_ID) return;

        if (topic.startsWith(`${CLUSTER_TOPIC_PREFIX}/rooms/`)) {
          if (data.deleted && data.code) {
            const norm = normalizeRoomCode(data.code);
            if (rooms.has(norm)) {
              rooms.delete(norm);
              savePersistedRooms();
              broadcastPublicRoomList(false);
            }
            return;
          }
          if (data.room && data.room.code) {
            const incoming = data.room as CustomRoomState;
            const norm = normalizeRoomCode(incoming.code);
            const prevStatus = rooms.get(norm)?.status;
            const merged = mergeRoomStates(rooms.get(norm), incoming);
            rooms.set(norm, merged);
            savePersistedRooms();
            broadcastRoomStateLocal(norm);
            if (prevStatus !== 'PLAYING' && merged.status === 'PLAYING') {
              broadcastMatchStartLocal(norm);
            }
            broadcastPublicRoomList(false);
          }
          return;
        }

        if (topic === `${CLUSTER_TOPIC_PREFIX}/events`) {
          handleClusterEvent(data);
        }
      } catch (_err) {
        // Ignore malformed packet
      }
    });

    client.on('error', () => {
      // Handled by auto-reconnect
    });
  } catch (_e) {
    // Ignore init error
  }
}

initClusterBridge();

function publishRoomToCluster(room: CustomRoomState) {
  if (!clusterMqtt || !clusterMqtt.connected) return;
  try {
    const norm = normalizeRoomCode(room.code);
    clusterMqtt.publish(
      `${CLUSTER_TOPIC_PREFIX}/rooms/${norm}`,
      JSON.stringify({
        instanceId: SERVER_INSTANCE_ID,
        room,
        ts: Date.now(),
      }),
      { qos: 1, retain: true }
    );
  } catch (_e) {
    // Ignore publish error
  }
}

function publishRoomDeleteToCluster(code: string) {
  if (!clusterMqtt || !clusterMqtt.connected) return;
  try {
    const norm = normalizeRoomCode(code);
    clusterMqtt.publish(
      `${CLUSTER_TOPIC_PREFIX}/rooms/${norm}`,
      JSON.stringify({
        instanceId: SERVER_INSTANCE_ID,
        deleted: true,
        code: norm,
        ts: Date.now(),
      }),
      { qos: 1, retain: true }
    );
  } catch (_e) {
    // Ignore
  }
}

function publishClusterEvent(eventPayload: Record<string, any>) {
  if (!clusterMqtt || !clusterMqtt.connected) return;
  try {
    clusterMqtt.publish(
      `${CLUSTER_TOPIC_PREFIX}/events`,
      JSON.stringify({
        ...eventPayload,
        instanceId: SERVER_INSTANCE_ID,
      }),
      { qos: 0 }
    );
  } catch (_e) {
    // Ignore
  }
}

function handleClusterEvent(data: Record<string, any>) {
  const evtType = data.type as string;
  const roomCode = normalizeRoomCode(data.roomCode || '');

  if (evtType === 'cluster:join_request' && roomCode && data.client) {
    const room = rooms.get(roomCode);
    if (room) {
      const dummyClient = getOrUpdateClient(data.client);
      handleJoinRoomForClient(dummyClient, roomCode, data.preferredSlot, {}, false);
    }
    return;
  }

  if (
    (evtType === 'game:player_state' ||
      evtType === 'game:event' ||
      evtType === 'voice:audio_chunk') &&
    roomCode
  ) {
    const outMsg = JSON.stringify(data.packet);
    for (const c of clients.values()) {
      if (
        c.roomCode === roomCode &&
        c.playerId !== data.senderId &&
        c.ws &&
        c.ws.readyState === WebSocket.OPEN
      ) {
        c.ws.send(outMsg);
      }
    }
    return;
  }

  if (evtType === 'voice:signal' && roomCode) {
    const targetId = String(data.targetId || '');
    const targetClient = clients.get(targetId);
    if (
      targetClient &&
      targetClient.roomCode === roomCode &&
      targetClient.ws &&
      targetClient.ws.readyState === WebSocket.OPEN
    ) {
      sendJson(targetClient.ws, {
        type: 'voice:signal',
        fromId: data.fromId,
        signal: data.signal,
      });
    }
  }
}




function sendJson(ws: WebSocket | null, payload: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomStateLocal(roomCode: string) {
  const norm = normalizeRoomCode(roomCode);
  const room = rooms.get(norm);
  if (!room) return;

  const msg = JSON.stringify({
    type: 'room:state',
    room,
  });
  for (const client of clients.values()) {
    const inSlots = room.slots.some(
      (s) => s.occupiedBy === 'human' && s.playerId === client.playerId
    );
    if (inSlots) {
      client.roomCode = norm;
    }
    if (
      (client.roomCode === norm || inSlots) &&
      client.ws &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(msg);
    }
  }
}

function broadcastMatchStartLocal(roomCode: string) {
  const norm = normalizeRoomCode(roomCode);
  const room = rooms.get(norm);
  if (!room) return;
  const startMsg = JSON.stringify({
    type: 'match:start',
    room,
  });
  for (const c of clients.values()) {
    const inSlots = room.slots.some(
      (s) => s.occupiedBy === 'human' && s.playerId === c.playerId
    );
    if (
      (c.roomCode === norm || inSlots) &&
      c.ws &&
      c.ws.readyState === WebSocket.OPEN
    ) {
      c.ws.send(startMsg);
    }
  }
}





















async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const originAllowed = createOriginPolicy(process.env.ALLOWED_ORIGINS, process.env.NODE_ENV === 'production');
  const turn = createTurnCredentials(process.env);
  let port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }
  const canTryNextPort = process.env.NODE_ENV !== 'production' && process.env.PORT === undefined;
  const lastPreviewPort = port + 10;

  // Disable Nagle's algorithm for ultra-low latency real-time packets & voice chat
  server.on('connection', (socket) => {
    socket.setNoDelay(true);
  });

  // Frontend and multiplayer service can live on separate, explicitly allowed origins.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin, req.headers.host)) { res.status(403).json({ error: 'This game origin is not allowed.' }); return; }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      instanceId: SERVER_INSTANCE_ID,
      onlinePlayers: Math.max(1, clients.size),
      activeRooms: rooms.size,
    });
  });

  // =========================================================================
  // HTTP REST ENDPOINTS FOR GUARANTEED ROOM CREATION, JOINING & STATE SYNC
  // =========================================================================
  registerRoomRoutes(app, roomEngine);

  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  const alive = new WeakSet<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) { socket.terminate(); continue; }
      alive.delete(socket); socket.ping();
    }
  }, 25000);
  heartbeat.unref();

  const staleClientTimer = setInterval(() => {
    for (const client of clients.values()) {
      if ((!client.ws || client.ws.readyState !== WebSocket.OPEN) && Date.now() - client.lastSeenAt > 45000) {
        removePlayerFromCurrentRoom(client);
        clients.delete(client.playerId);
      }
    }
  }, 10000);
  staleClientTimer.unref();

  server.on('upgrade', (request, socket, head) => {
    if (!originAllowed(request.headers.origin, request.headers.host)) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let currentPlayerId: string | null = null;
    let lastTurnRequest = -Infinity;
    alive.add(ws); ws.on('pong', () => alive.add(ws));

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const type = data.type as string;

        if (type === 'player:identify') {
          const clientObj = getOrUpdateClient({
            playerId: data.playerId,
            name: data.name,
            charId: data.charId,
            outfitId: data.outfitId,
            faceId: data.faceId,
            ws,
          });
          currentPlayerId = clientObj.playerId;

          const roomCode = normalizeRoomCode(
            data.roomCode || clientObj.roomCode || ''
          );
          if (roomCode) {
            const room = findMatchingRoom(roomCode);
            if (room) {
              clientObj.roomCode = room.code;
              const slot = room.slots.find(
                (s) => s.playerId === clientObj.playerId
              );
              if (slot) {
                slot.playerName = clientObj.name;
                if (room.status === 'LOBBY') {
                  slot.charId = clientObj.charId;
                  slot.outfitId = clientObj.outfitId;
                  slot.faceId = clientObj.faceId;
                }
              }
              sendJson(ws, { type: 'room:state', room });
            }
          }

          broadcastPublicRoomList(false);
          return;
        }

        const pid = currentPlayerId || String(data.playerId || '');
        if (!pid) return;
        const client = getOrUpdateClient({
          playerId: pid,
          name: data.name,
          charId: data.charId,
          outfitId: data.outfitId,
          faceId: data.faceId,
          ws,
        });
        currentPlayerId = client.playerId;

        if (type === 'rtc:request') {
          const room = client.roomCode ? rooms.get(client.roomCode) : undefined;
          if (!room || !room.slots.some(slot => slot.playerId === client.playerId && slot.occupiedBy === 'human') || Date.now() - lastTurnRequest < 30000) return;
          lastTurnRequest = Date.now();
          void turn.get(client.playerId).then(config => {
            if (client.roomCode === room.code && ws.readyState === WebSocket.OPEN) sendJson(ws, { type: 'rtc:config', ...config });
          });
          return;
        }

        if (type === 'player:update_profile') {
          if (client.roomCode && rooms.has(client.roomCode)) {
            const room = rooms.get(client.roomCode)!;
            const slot = room.slots.find((s) => s.playerId === client.playerId);
            if (slot) {
              slot.playerName = client.name;
              if (room.status === 'LOBBY') {
                slot.charId = client.charId;
                slot.outfitId = client.outfitId;
                slot.faceId = client.faceId;
              }
              broadcastRoomState(room.code, true);
            }
          }
          return;
        }

        if (type === 'room:create') {
          handleCreateRoomForClient(client, data);
          return;
        }

        if (type === 'room:join') {
          const res = handleJoinRoomForClient(
            client,
            String(data.code || ''),
            data.preferredSlot,
            data,
            true
          );
          if (res.error) {
            sendJson(ws, {
              type: 'room:error',
              message: res.error,
            });
          }
          return;
        }

        if (type === 'room:leave') {
          removePlayerFromCurrentRoom(client);
          sendJson(ws, { type: 'room:left' });
          return;
        }

        const normCode = normalizeRoomCode(
          data.roomCode || client.roomCode || ''
        );
        if (!normCode || !rooms.has(normCode)) return;
        const room = rooms.get(normCode)!;
        const actions: Record<string, string> = { 'room:select_slot': 'select-slot', 'room:toggle_slot_bot': 'toggle-bot', 'room:update_settings': 'settings', 'room:start_match': 'start', 'room:return_lobby': 'return', 'room:update_player': 'player' };
        const denied = roomActionError(room, client, actions[type] || 'member');
        if (denied) { sendJson(ws, { type: 'room:error', message: denied }); return; }

        if (type === 'room:select_slot') {
          const targetIdx = Number(data.slotIndex);
          if (
            isNaN(targetIdx) ||
            targetIdx < 0 ||
            targetIdx >= room.slots.length
          ) {
            return;
          }
          const targetSlot = room.slots[targetIdx];
          if (
            targetSlot.occupiedBy === 'human' &&
            targetSlot.playerId !== client.playerId
          ) {
            sendJson(ws, {
              type: 'room:error',
              message: 'That slot is already taken by another player!',
            });
            return;
          }

          const currentSlot = room.slots.find(
            (s) => s.playerId === client.playerId
          );
          if (!currentSlot || currentSlot.slotIndex === targetIdx) return;

          const prevMic = currentSlot.micOn;
          const prevListen = currentSlot.listenOn;
          const prevReady = currentSlot.ready;
          const prevHost = currentSlot.isHost;

          const botDef =
            DEFAULT_BOT_CHARS[currentSlot.slotIndex % DEFAULT_BOT_CHARS.length];
          currentSlot.occupiedBy = room.fillWithBots ? 'bot' : 'empty';
          currentSlot.playerId = null;
          currentSlot.playerName = room.fillWithBots ? botDef.name : 'OPEN SLOT';
          currentSlot.charId = botDef.charId;
          currentSlot.outfitId = botDef.outfitId;
          currentSlot.faceId = botDef.faceId;
          currentSlot.ready = true;
          currentSlot.isHost = false;
          currentSlot.micOn = false;
          currentSlot.speaking = false;

          targetSlot.occupiedBy = 'human';
          targetSlot.playerId = client.playerId;
          targetSlot.playerName = client.name;
          targetSlot.charId = client.charId;
          targetSlot.outfitId = client.outfitId;
          targetSlot.faceId = client.faceId;
          targetSlot.ready = prevReady;
          targetSlot.isHost = prevHost;
          targetSlot.micOn = prevMic;
          targetSlot.listenOn = prevListen;
          targetSlot.speaking = false;

          broadcastRoomState(room.code, true);
          return;
        }

        if (type === 'room:toggle_slot_bot') {
          const targetIdx = Number(data.slotIndex);
          const targetSlot = room.slots[targetIdx];
          if (!targetSlot || targetSlot.occupiedBy === 'human') return;

          const botDef = DEFAULT_BOT_CHARS[targetIdx % DEFAULT_BOT_CHARS.length];
          if (targetSlot.occupiedBy === 'bot') {
            targetSlot.occupiedBy = 'empty';
            targetSlot.playerName = 'OPEN SLOT';
          } else {
            targetSlot.occupiedBy = 'bot';
            targetSlot.playerName = botDef.name;
            targetSlot.charId = botDef.charId;
            targetSlot.outfitId = botDef.outfitId;
            targetSlot.faceId = botDef.faceId;
          }
          broadcastRoomState(room.code, true);
          return;
        }

        if (type === 'room:update_player') {
          applyPlayerUpdate(room, client, data);
          broadcastRoomState(room.code, true);
          return;
        }
        if (type === 'room:update_settings') {
          const error = applyRoomSettings(room, data);
          if (error) { sendJson(ws, { type: 'room:error', message: error }); return; }
          broadcastRoomState(room.code, true);
          broadcastPublicRoomList(true);
          return;
        }
        if (type === 'room:start_match') { startRoomMatch(room); return; }
        if (type === 'room:return_lobby') { returnRoomToLobby(room); return; }

        // Ultra-Low-Latency Real-Time Game State & Voice Relays (Local + Cross-Instance Cluster)
        if (
          type === 'game:player_state' ||
          type === 'game:event' ||
          type === 'voice:audio_chunk'
        ) {
          if (type !== 'voice:audio_chunk' && (room.status !== 'PLAYING' || data.matchId !== room.matchId)) return;
          const outPacket = {
            ...data,
            senderId: client.playerId,
          };
          const outMsg = JSON.stringify(outPacket);
          for (const c of clients.values()) {
            if (
              c.roomCode === room.code &&
              c.playerId !== client.playerId &&
              c.ws &&
              c.ws.readyState === WebSocket.OPEN
            ) {
              const replaceable = type === 'game:player_state' || type === 'voice:audio_chunk' || (type === 'game:event' && String(data.eventKind).endsWith(':state') && data.payload?.matchEnded !== true);
              if (!replaceable || (c.ws.bufferedAmount || 0) < MAX_REALTIME_BUFFER) c.ws.send(outMsg);
            }
          }
          publishClusterEvent({
            type,
            roomCode: room.code,
            senderId: client.playerId,
            packet: outPacket,
          });
          return;
        }

        // Targeted WebRTC Peer-to-Peer Voice Signaling (Offer / Answer / ICE)
        if (type === 'voice:signal') {
          const targetId = String(data.targetId || '');
          const targetClient = clients.get(targetId);
          if (
            targetClient &&
            targetClient.roomCode === room.code &&
            targetClient.ws &&
            targetClient.ws.readyState === WebSocket.OPEN
          ) {
            sendJson(targetClient.ws, {
              type: 'voice:signal',
              fromId: client.playerId,
              signal: data.signal,
            });
          } else {
            publishClusterEvent({
              type: 'voice:signal',
              roomCode: room.code,
              fromId: client.playerId,
              targetId,
              signal: data.signal,
            });
          }
          return;
        }
      } catch (_err) {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      if (currentPlayerId && clients.has(currentPlayerId)) {
        const cl = clients.get(currentPlayerId)!;
        if (cl.ws === ws) {
          cl.ws = null;
          cl.lastSeenAt = Date.now();
        }
      }
    });
  });

  if (process.env.SERVE_FRONTEND === 'false') {
    app.get('/', (_req, res) => res.json({ service: 'SIXZUN multiplayer', status: 'ok' }));
    app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  } else if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && canTryNextPort && port < lastPreviewPort) {
      console.log(`Port ${port} is already in use; trying ${port + 1}.`);
      port += 1;
      server.listen(port, '0.0.0.0');
      return;
    }
    console.error(`Could not start the game on port ${port}: ${error.message}`);
    process.exit(1);
  });
  server.on('listening', () => {
    const address = server.address();
    const activePort = address && typeof address !== 'string' ? address.port : port;
    console.log(`Game preview ready: http://127.0.0.1:${activePort}/`);
  });
  server.listen(port, '0.0.0.0');
}

startServer().catch((error) => {
  console.error(`Could not start the game: ${error.message}`);
  process.exit(1);
});
