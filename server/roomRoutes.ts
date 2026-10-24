import { createRoomEngine, DEFAULT_BOT_CHARS, type CustomRoomState } from './roomEngine';
export function registerRoomRoutes(app: { get(path: string, handler: (req: any, res: any) => void): unknown; post(path: string, handler: (req: any, res: any) => void): unknown }, engine: ReturnType<typeof createRoomEngine>) {
  const { normalizeRoomCode, rooms, clients, findMatchingRoom, getPublicRoomSummaries, getOrUpdateClient, handleCreateRoomForClient, handleJoinRoomForClient, removePlayerFromCurrentRoom, roomActionError, broadcastRoomState, applyRoomSettings, broadcastPublicRoomList, startRoomMatch, returnRoomToLobby, applyPlayerUpdate } = engine;
  app.get('/api/mp/state', (req, res) => {
    const playerId = String(req.query.playerId || '');
    const roomCode = normalizeRoomCode(String(req.query.roomCode || ''));
    if (clients.has(playerId)) clients.get(playerId)!.lastSeenAt = Date.now();
    let room: CustomRoomState | null = null;
    if (roomCode) {
      room = findMatchingRoom(roomCode) || null;
    } else if (playerId && clients.has(playerId)) {
      const cl = clients.get(playerId)!;
      cl.lastSeenAt = Date.now();
      if (cl.roomCode) {
        room = rooms.get(normalizeRoomCode(cl.roomCode)) || null;
      }
    }
    res.json({
      room,
      rooms: getPublicRoomSummaries(),
      onlineCount: Math.max(1, clients.size),
    });
  });

  // Browsers send commands; they cannot replace authoritative room snapshots.
  app.post('/api/mp/room/sync', (_req, res) => res.status(409).json({ error: 'Use room controls to update the room.' }));

  app.post('/api/mp/room/create', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    const room = handleCreateRoomForClient(client, req.body || {});
    res.json({
      room,
      rooms: getPublicRoomSummaries(),
      onlineCount: Math.max(1, clients.size),
    });
  });

  app.post('/api/mp/room/join', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    const result = handleJoinRoomForClient(
      client,
      String(req.body?.code || ''),
      req.body?.preferredSlot,
      req.body,
      true
    );
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      room: result.room,
      rooms: getPublicRoomSummaries(),
      onlineCount: Math.max(1, clients.size),
    });
  });

  app.post('/api/mp/room/leave', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    removePlayerFromCurrentRoom(client);
    res.json({
      room: null,
      rooms: getPublicRoomSummaries(),
      onlineCount: Math.max(1, clients.size),
    });
  });

  app.post('/api/mp/room/select-slot', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    const code = normalizeRoomCode(req.body?.roomCode || client.roomCode || '');
    const room = findMatchingRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not active' });
      return;
    }
    const denied = roomActionError(room, client, 'select-slot');
    if (denied) { res.status(403).json({ error: denied }); return; }
    const targetIdx = Number(req.body?.slotIndex);
    if (!Number.isInteger(targetIdx) || !room.slots[targetIdx]) { res.status(400).json({ error: 'Choose a valid slot.' }); return; }
    if (room.slots[targetIdx].occupiedBy === 'human' && room.slots[targetIdx].playerId !== client.playerId) { res.status(409).json({ error: 'That slot was taken by another player. Choose an open slot.' }); return; }
    if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < room.slots.length) {
      const targetSlot = room.slots[targetIdx];
      if (
        targetSlot.occupiedBy !== 'human' ||
        targetSlot.playerId === client.playerId
      ) {
        const currentSlot = room.slots.find(
          (s) => s.playerId === client.playerId
        );
        if (currentSlot && currentSlot.slotIndex !== targetIdx) {
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
        }
      }
    }
    res.json({ room });
  });

  app.post('/api/mp/room/toggle-bot', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    const code = normalizeRoomCode(req.body?.roomCode || client.roomCode || '');
    const room = findMatchingRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not active' });
      return;
    }
    const denied = roomActionError(room, client, 'toggle-bot');
    if (denied) { res.status(403).json({ error: denied }); return; }
    const targetIdx = Number(req.body?.slotIndex);
    const targetSlot = room.slots[targetIdx];
    if (targetSlot && targetSlot.occupiedBy !== 'human') {
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
    }
    res.json({ room });
  });

  app.post('/api/mp/room/settings', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    const code = normalizeRoomCode(req.body?.roomCode || client.roomCode || '');
    const room = findMatchingRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not active' });
      return;
    }
    const denied = roomActionError(room, client, 'settings');
    if (denied) { res.status(403).json({ error: denied }); return; }
    const error = applyRoomSettings(room, req.body || {});
    if (error) { res.status(400).json({ error }); return; }
    broadcastRoomState(room.code, true);
    broadcastPublicRoomList(true);
    res.json({ room });
  });

  app.post('/api/mp/room/start', (req, res) => {
    const client = getOrUpdateClient(req.body || {});
    const code = normalizeRoomCode(req.body?.roomCode || client.roomCode || '');
    const room = findMatchingRoom(code);
    if (!room) {
      res.status(404).json({ error: 'Room not active' });
      return;
    }
    const denied = roomActionError(room, client, 'start');
    if (denied) { res.status(403).json({ error: denied }); return; }
    startRoomMatch(room);
    res.json({ room });
  });

  // =========================================================================
  // WEBSOCKET SERVER ON /ws (NO-SERVER UPGRADE SO VITE NEVER CONFLICTS)
  // =========================================================================
  for (const action of ['player', 'return']) {
    app.post('/api/mp/room/' + action, (req, res) => {
      const client = getOrUpdateClient(req.body || {});
      const room = findMatchingRoom(normalizeRoomCode(req.body?.roomCode || client.roomCode || ''));
      if (!room) { res.status(404).json({ error: 'Room not active' }); return; }
      const denied = roomActionError(room, client, action);
      if (denied) { res.status(403).json({ error: denied }); return; }
      if (action === 'return') returnRoomToLobby(room);
      else { applyPlayerUpdate(room, client, req.body || {}); broadcastRoomState(room.code, true); }
      res.json({ room });
    });
  }


}

export function executeRoomRequest(engine: ReturnType<typeof createRoomEngine>, method: string, path: string, body: Record<string, any>, query: Record<string, string> = {}) {
  const routes = new Map<string, (req: any, res: any) => void>();
  registerRoomRoutes({ get: (path, handler) => routes.set('GET ' + path, handler), post: (path, handler) => routes.set('POST ' + path, handler) }, engine);
  const handler = routes.get(method + ' ' + path);
  let status = handler ? 200 : 404, result: any = { error: 'Not found' };
  const response = { status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; } };
  handler?.({ body, query }, response);
  return { status, body: result };
}
