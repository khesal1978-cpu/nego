import http from 'node:http';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { createRoomEngine, type CustomRoomState, type RoomNotice } from './roomEngine.js';
import { executeRoomRequest } from './roomRoutes.js';
import { createMongoRoomStore, mongoEnvironment } from './mongoRooms.js';
import type { RoomCommit, RoomStore } from './roomStore.js';
import { createOriginPolicy } from './originPolicy.js';
import { createTurnCredentials } from './turnCredentials.js';
import { MAX_REALTIME_BUFFER } from '../src/network/transport.js';

export function createVercelMultiplayer(env = process.env, providedStore?: RoomStore) {
  const app = express(), server = http.createServer(app);
  const config = mongoEnvironment(env);
  const store = providedStore || (config ? createMongoRoomStore(config) : null);
  const turn = createTurnCredentials(env), allowed = createOriginPolicy(env.ALLOWED_ORIGINS, true);
  const instance = Math.random().toString(36).slice(2);
  const sockets = new Map<WebSocket, { playerId: string; turnAt: number; alive: boolean }>();
  let rooms = new Map<string, CustomRoomState>(), revision = 0, epoch = '';
  let subscription: AbortController | null = null, retry: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const setupError = 'Online rooms are not configured yet. Set MONGODB_URI for your MongoDB Atlas Free cluster in this Vercel project. Solo play is available.';
  const send = (socket: WebSocket, message: unknown, replaceable = false) => {
    if (socket.bufferedAmount > 2 * 1024 * 1024) { socket.close(1013, 'Connection is too slow; reconnecting'); return; }
    if (socket.readyState === WebSocket.OPEN && (!replaceable || socket.bufferedAmount < MAX_REALTIME_BUFFER)) socket.send(JSON.stringify(message));
  };
  const summaries = () => [...rooms.values()].filter(room => room.status === 'LOBBY').map(room => ({
    code: room.code, name: room.name, mode: room.mode, mapId: room.mapId, maxPlayers: room.maxPlayers,
    humanCount: room.slots.filter(slot => slot.occupiedBy === 'human').length, status: room.status,
  }));
  function notices(notice: RoomNotice) {
    const previous = notice.room ? rooms.get(notice.room.code) : notice.code ? rooms.get(notice.code) : undefined;
    if (notice.type === 'room:state' && notice.room) {
      const current = rooms.get(notice.room.code);
      if (current && (current.version || 0) > (notice.room.version || 0)) return;
      rooms.set(notice.room.code, notice.room);
    } else if (notice.type === 'room:deleted') rooms.delete(notice.code!);
    for (const [socket, context] of sockets) {
      if (notice.type === 'rooms:list') send(socket, notice);
      else if (notice.room?.slots.some(slot => slot.playerId === context.playerId && slot.occupiedBy === 'human')) send(socket, notice);
      else if (previous?.slots.some(slot => slot.playerId === context.playerId)) send(socket, { type: 'room:left' });
    }
  }
  let cacheQueue = Promise.resolve();
  function applyCommit(commit: RoomCommit) {
    // HTTP responses and pub/sub echoes can arrive in either order. A gap must
    // read authoritative state before accepting subsequent game packets.
    cacheQueue = cacheQueue.catch(() => {}).then(async () => {
      if (commit.epoch !== epoch) { await resync(); return; }
      if (commit.revision <= revision) return;
      if (commit.revision !== revision + 1) { await resync(); return; }
      revision = commit.revision;
      for (const notice of commit.notices) notices(notice);
    });
    return cacheQueue;
  }
  async function resync() {
    if (!store) return;
    const state = await store.read();
    if (state.epoch === epoch && state.revision < revision) return;
    const previous = rooms;
    epoch = state.epoch; revision = state.revision; rooms = new Map(state.snapshot.rooms.map(room => [room.code, room]));
    for (const [socket, context] of sockets) {
      send(socket, { type: 'rooms:list', rooms: summaries(), onlineCount: state.snapshot.clients.length });
      const room = [...rooms.values()].find(room => room.slots.some(slot => slot.playerId === context.playerId));
      if (room) send(socket, { type: 'room:state', room });
      else if ([...previous.values()].some(room => room.slots.some(slot => slot.playerId === context.playerId))) send(socket, { type: 'room:left' });
    }
  }
  async function incoming(message: any) {
    if (!message || typeof message !== 'object') return;
    if (message.kind === 'commit') { await applyCommit(message); return; }
    await cacheQueue;
    if (message.kind !== 'relay' || message.instance === instance || !Array.isArray(message.packets)) return;
    for (const item of message.packets) {
      const room = rooms.get(item.roomCode);
      if (!room?.slots.some(slot => slot.playerId === item.senderId && slot.occupiedBy === 'human')) continue;
      if (item.packet?.type?.startsWith('game:') && (room.status !== 'PLAYING' || item.packet.matchId !== room.matchId)) continue;
      for (const [socket, context] of sockets) {
        if (context.playerId === item.senderId || (item.targetId && context.playerId !== item.targetId)) continue;
        if (room.slots.some(slot => slot.playerId === context.playerId && slot.occupiedBy === 'human')) send(socket, item.packet, item.replaceable);
      }
    }
  }
  function ensureSubscription() {
    if (!store || subscription || disposed || !sockets.size) return;
    const controller = new AbortController(); subscription = controller;
    void store.subscribe(incoming, resync, controller.signal).catch(() => {
      if (!controller.signal.aborted) for (const socket of sockets.keys()) send(socket, { type: 'room:error', message: 'Room connection interrupted. Reconnecting…' });
    }).finally(() => {
      if (subscription === controller) subscription = null;
      if (!disposed && sockets.size) { retry = setTimeout(() => { retry = null; ensureSubscription(); }, 1500); retry.unref(); }
    });
  }
  async function update<T>(change: Parameters<RoomStore['update']>[0]) {
    if (!store) throw Error(setupError);
    const result = await store.update(change); await applyCommit(result.commit); return result.value as T;
  }

  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!allowed(req.headers.origin, req.headers.host)) { res.status(403).json({ error: 'This game origin is not allowed.' }); return; }
    if (req.headers.origin) { res.setHeader('Access-Control-Allow-Origin', req.headers.origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });
  // Game clients send plain JSON; reject compressed bodies before decompression.
  app.use(express.json({ limit: '32kb', inflate: false }));
  app.use(async (req, res) => {
    const path = typeof req.query.route === 'string' ? req.query.route : req.path;
    if (path === '/api/health') {
      if (!store) { res.status(503).json({ status: 'setup_required', error: setupError }); return; }
      try { await store.read(); res.json({ status: 'ok', storage: 'mongodb', instanceId: instance }); }
      catch { res.status(503).json({ status: 'unavailable', error: 'Check the MongoDB connection, database permissions and Atlas network access.' }); }
      return;
    }
    if (!path.startsWith('/api/mp/')) { res.status(404).json({ error: 'Not found' }); return; }
    if (!store) { res.status(503).json({ error: setupError }); return; }
    try {
      const query = Object.fromEntries(Object.entries(req.query).filter((pair): pair is [string, string] => typeof pair[1] === 'string'));
      if (req.method === 'GET') {
        const state = await store.read();
        // HTTP-only clients also stay present, with at most one touch per 25s.
        const client = state.snapshot.clients.find(client => client.playerId === query.playerId);
        if ((client && Date.now() - client.lastSeenAt > 25000) || state.snapshot.clients.some(client => Date.now() - client.lastSeenAt > 90000)) {
          const result = await update<ReturnType<typeof executeRoomRequest>>(engine => executeRoomRequest(engine, req.method, path, {}, query));
          res.status(result.status).json(result.body); return;
        }
        const result = executeRoomRequest(createRoomEngine(state.snapshot), req.method, path, {}, query);
        res.status(result.status).json(result.body); return;
      }
      if (req.method !== 'POST' || !validPlayer(req.body?.playerId)) { res.status(400).json({ error: 'Reload the game to reconnect.' }); return; }
      const result = await update<ReturnType<typeof executeRoomRequest>>(engine => executeRoomRequest(engine, req.method, path, req.body));
      res.status(result.status).json(result.body);
    } catch { res.status(503).json({ error: 'Room storage is unavailable or busy. Please try again shortly.' }); }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  server.on('connection', socket => socket.setNoDelay(true));
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (!['/ws', '/api/multiplayer'].includes(path) || !allowed(req.headers.origin, req.headers.host)) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  const relayQueue: any[] = []; let relayTimer: ReturnType<typeof setTimeout> | null = null;
  function publishRelay(item: any) {
    if (!store) return;
    if (item.replaceable) {
      const index = relayQueue.findIndex(previous => previous.replaceable && previous.roomCode === item.roomCode && previous.senderId === item.senderId && previous.targetId === item.targetId && previous.packet.type === item.packet.type && previous.packet.eventKind === item.packet.eventKind);
      if (index >= 0) { relayQueue[index] = item; return; }
    }
    if (relayQueue.length >= 128) {
      if (item.replaceable) return;
      // Reliable actions are never dropped behind replaceable position updates.
      void store.publish({ kind: 'relay', instance, packets: [item] }).catch(() => {}); return;
    }
    relayQueue.push(item);
    if (relayTimer) return;
    relayTimer = setTimeout(() => {
      relayTimer = null; const packets = relayQueue.splice(0);
      void store.publish({ kind: 'relay', instance, packets }).catch(() => {
        for (const socket of sockets.keys()) send(socket, { type: 'room:error', message: 'Match relay interrupted. Check your connection.' });
      });
    }, 50);
    relayTimer.unref();
  }
  wss.on('connection', socket => {
    const context = { playerId: '', turnAt: 0, alive: true }; sockets.set(socket, context); ensureSubscription();
    socket.on('pong', () => { context.alive = true; });
    let queue = Promise.resolve(), pending = 0;
    socket.on('message', raw => {
      let data: any; try { data = JSON.parse(raw.toString()); } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (pending >= 128) { socket.close(1013, 'Too many pending messages'); return; }
      pending++;
      queue = queue.then(async () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (!store) { send(socket, { type: 'room:error', message: setupError }); return; }
        if (data.type === 'player:identify') {
          if (!validPlayer(data.playerId) || (context.playerId && data.playerId !== context.playerId)) return;
          context.playerId = data.playerId;
          await update(engine => { engine.getOrUpdateClient({ ...data, ws: null }); });
          await resync(); return;
        }
        if (!context.playerId) return;
        const actions: Record<string, string> = { 'room:create': 'create', 'room:join': 'join', 'room:leave': 'leave', 'room:select_slot': 'select-slot', 'room:toggle_slot_bot': 'toggle-bot', 'room:update_settings': 'settings', 'room:start_match': 'start', 'room:return_lobby': 'return', 'room:update_player': 'player' };
        if (actions[data.type]) {
          const result = await update<ReturnType<typeof executeRoomRequest>>(engine => executeRoomRequest(engine, 'POST', '/api/mp/room/' + actions[data.type], { ...data, playerId: context.playerId }));
          if (result.status >= 400) send(socket, { type: 'room:error', message: result.body.error });
          else if (data.type === 'room:leave') send(socket, { type: 'room:left' });
          else if (result.body.room) send(socket, { type: 'room:state', room: result.body.room });
          return;
        }
        if (data.type === 'player:update_profile') {
          await update(engine => {
            const client = engine.getOrUpdateClient({ ...data, playerId: context.playerId, ws: null });
            const room = client.roomCode ? engine.rooms.get(client.roomCode) : null;
            if (room) { engine.applyPlayerUpdate(room, client, data); engine.broadcastRoomState(room.code); }
          }); return;
        }
        await cacheQueue;
        const room: CustomRoomState | undefined = (typeof data.roomCode === 'string' ? rooms.get(data.roomCode) : undefined) || [...rooms.values()].find(room => room.slots.some(slot => slot.playerId === context.playerId));
        if (!room || !room.slots.some(slot => slot.playerId === context.playerId && slot.occupiedBy === 'human')) return;
        if (data.type === 'rtc:request') {
          if (Date.now() - context.turnAt < 30000) return;
          context.turnAt = Date.now();
          void turn.get(context.playerId).then(config => send(socket, { type: 'rtc:config', ...config })); return;
        }
        if (!['voice:signal', 'voice:audio_chunk', 'game:player_state', 'game:event'].includes(data.type)) return;
        const isGame = data.type.startsWith('game:');
        if (isGame && (room.status !== 'PLAYING' || data.matchId !== room.matchId)) return;
        const targetId = data.type === 'voice:signal' ? String(data.targetId || '') : undefined;
        if (data.type === 'voice:signal' && (!targetId || targetId === context.playerId || !data.signal)) return;
        if (targetId && !room.slots.some(slot => slot.playerId === targetId && slot.occupiedBy === 'human')) return;
        const packet = targetId ? { type: 'voice:signal', fromId: context.playerId, signal: data.signal } : { ...data, roomCode: room.code, senderId: context.playerId };
        const replaceable = data.type === 'game:player_state' || data.type === 'voice:audio_chunk' || (data.type === 'game:event' && String(data.eventKind).endsWith(':state') && data.payload?.matchEnded !== true);
        const recipients = room.slots.filter(slot => slot.occupiedBy === 'human' && slot.playerId !== context.playerId && (!targetId || slot.playerId === targetId));
        const delivered = new Set<string>();
        for (const [other, peer] of sockets) if (other.readyState === WebSocket.OPEN && recipients.some(slot => slot.playerId === peer.playerId)) { send(other, packet, replaceable); delivered.add(peer.playerId); }
        if (recipients.some(slot => !delivered.has(slot.playerId!))) publishRelay({ roomCode: room.code, senderId: context.playerId, targetId, packet, replaceable });
      }).catch(() => send(socket, { type: 'room:error', message: 'Room connection is busy. Please try again shortly.' })).finally(() => { pending--; });
    });
    socket.on('close', () => {
      sockets.delete(socket);
      if (!sockets.size) { subscription?.abort(); if (retry) clearTimeout(retry); retry = null; }
    });
    socket.on('error', () => {});
  });
  // Presence is one batched write per active instance, never one write per frame.
  let presenceBusy = false;
  const heartbeat = setInterval(() => {
    for (const [socket, context] of sockets) {
      if (!context.alive) { socket.terminate(); continue; }
      context.alive = false; socket.ping();
    }
    if (!store || !sockets.size || presenceBusy) return;
    presenceBusy = true;
    void update(engine => {
      const now = Date.now();
      for (const context of sockets.values()) { const client = engine.clients.get(context.playerId); if (client) { client.lastSeenAt = now; if (client.roomCode) { const room = engine.rooms.get(client.roomCode); if (room) room.updatedAt = now; } } }
      for (const client of engine.clients.values()) if (now - client.lastSeenAt > 90000) { engine.removePlayerFromCurrentRoom(client); engine.clients.delete(client.playerId); }
    }).catch(() => {}).finally(() => { presenceBusy = false; });
  }, 25000);
  heartbeat.unref();
  server.once('close', () => { disposed = true; clearInterval(heartbeat); subscription?.abort(); if (retry) clearTimeout(retry); if (relayTimer) clearTimeout(relayTimer); for (const socket of sockets.keys()) socket.terminate(); });
  return server;
}

function validPlayer(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,80}$/.test(value); }
