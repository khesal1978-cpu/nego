import type { WebSocket } from 'ws';
import { dealCustomCharacters } from '../src/network/customCharacters.js';
import { customPlayerCount, isVolleyballMode, type CustomMode } from '../src/network/customModes.js';

export interface CustomSlotState {
  slotIndex: number;
  team: 'blue' | 'red' | 'solo';
  occupiedBy: 'human' | 'bot' | 'empty';
  playerId: string | null;
  playerName: string;
  charId: string;
  outfitId: string;
  faceId: string;
  ready: boolean;
  isHost: boolean;
  micOn: boolean;
  listenOn: boolean;
  speaking: boolean;
}

export interface CustomRoomState {
  code: string;
  name: string;
  hostId: string;
  mode: CustomMode;
  mapId: string;
  maxPlayers: number; // 2 for volleyball_1v1, 4 for volleyball_2v2, otherwise 2..5
  winScore: number;
  timerMinutes: 3 | 5 | 6;
  difficulty: string;
  fillWithBots: boolean;
  status: 'LOBBY' | 'PLAYING';
  matchId?: string;
  createdAt: number;
  updatedAt?: number;
  version?: number;
  slots: CustomSlotState[];
}

export interface ConnectedClient {
  ws: WebSocket | null;
  playerId: string;
  name: string;
  charId: string;
  outfitId: string;
  faceId: string;
  roomCode: string | null;
  lastSeenAt: number;
}


export const DEFAULT_BOT_CHARS = [
  { name: 'BOT BJORN', charId: 'viking_beard', outfitId: 'viking_tunic', faceId: 'viking_beard' },
  { name: 'BOT BERRY', charId: 'strawberry_kid', outfitId: 'strawberry_suit', faceId: 'kawaii_blush' },
  { name: 'BOT PINE', charId: 'pineapple_king', outfitId: 'pineapple_suit', faceId: 'cool_shades' },
  { name: 'BOT BURGER', charId: 'burger_chef', outfitId: 'burger_suit', faceId: 'chef_beard' },
  { name: 'BOT MAYA', charId: 'purple_shades', outfitId: 'cat_hoodie', faceId: 'kawaii_blush' },
];

export interface RoomSnapshot { rooms: CustomRoomState[]; clients: Omit<ConnectedClient, 'ws'>[] }
export type RoomNotice = { type: 'room:state' | 'room:deleted' | 'rooms:list' | 'match:start'; room?: CustomRoomState; code?: string; rooms?: Array<{ code: string; name: string; mode: CustomMode; mapId: string; maxPlayers: number; humanCount: number; status: 'LOBBY' | 'PLAYING' }>; onlineCount?: number };

export function createRoomEngine(initial: RoomSnapshot = { rooms: [], clients: [] }, notify: (notice: RoomNotice) => void = () => {}) {
  const rooms = new Map(initial.rooms.map(room => [room.code, structuredClone(room)]));
  const clients = new Map<string, ConnectedClient>(initial.clients.map(client => [client.playerId, { ...client, ws: null }]));
  const publishRoomDeleteToCluster = (code: string) => notify({ type: 'room:deleted', code });
  const broadcastMatchStartLocal = (code: string) => { const room = rooms.get(code); if (room) notify({ type: 'match:start', room: structuredClone(room) }); };
  function broadcastRoomState(code: string, _sync = true) {
    const room = rooms.get(normalizeRoomCode(code)); if (!room) return;
    room.updatedAt = Date.now(); room.version = (room.version || 0) + 1;
    notify({ type: 'room:state', room: structuredClone(room) });
  }
  function broadcastPublicRoomList(_sync = true) { notify({ type: 'rooms:list', rooms: getPublicRoomSummaries(), onlineCount: Math.max(1, clients.size) }); }

  function normalizeRoomCode(raw: string): string {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .slice(0, 6);
  }

  function findMatchingRoom(rawCode: string): CustomRoomState | undefined {
    const clean = normalizeRoomCode(rawCode);
    if (!clean) return undefined;
    return rooms.get(clean);
  }

  function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const norm = normalizeRoomCode(code);
    return rooms.has(norm) ? generateRoomCode() : norm;
  }

  function buildInitialSlots(
    mode: CustomRoomState['mode'],
    maxPlayers: number,
    fillWithBots: boolean,
    existingSlots?: CustomSlotState[]
  ): CustomSlotState[] {
    const count = customPlayerCount(mode, maxPlayers);
    const result: CustomSlotState[] = [];
  
    for (let i = 0; i < count; i++) {
      const team: CustomSlotState['team'] =
        isVolleyballMode(mode) ? (i < count / 2 ? 'blue' : 'red') : 'solo';
      const humans = existingSlots?.filter(slot => slot.occupiedBy === 'human') ?? [];
      const compact = humans.some(slot => slot.slotIndex >= count);
      const prev = compact ? humans[i] : existingSlots?.find(slot => slot.slotIndex === i);
  
      if (prev && prev.occupiedBy === 'human' && prev.playerId) {
        result.push({
          ...prev,
          slotIndex: i,
          team,
        });
      } else {
        const botDef = DEFAULT_BOT_CHARS[i % DEFAULT_BOT_CHARS.length];
        result.push({
          slotIndex: i,
          team,
          occupiedBy: fillWithBots ? 'bot' : 'empty',
          playerId: null,
          playerName: fillWithBots ? botDef.name : 'OPEN SLOT',
          charId: botDef.charId,
          outfitId: botDef.outfitId,
          faceId: botDef.faceId,
          ready: true,
          isHost: false,
          micOn: false,
          listenOn: true,
          speaking: false,
        });
      }
    }
    return result;
  }

  function getOrUpdateClient(data: {
    playerId?: string;
    name?: string;
    charId?: string;
    outfitId?: string;
    faceId?: string;
    ws?: WebSocket | null;
  }): ConnectedClient {
    const playerId = String(
      data.playerId || `p_${Math.random().toString(36).slice(2, 9)}`
    );
    const existing = clients.get(playerId);
    const client: ConnectedClient = {
      ws: data.ws !== undefined ? data.ws : existing?.ws || null,
      playerId,
      name:
        String(data.name || existing?.name || 'Athlete')
          .trim()
          .slice(0, 16) || 'Athlete',
      charId: String(data.charId || existing?.charId || 'green_hoodie'),
      outfitId: String(data.outfitId || existing?.outfitId || 'crown_hoodie'),
      faceId: String(data.faceId || existing?.faceId || 'happy_laugh'),
      roomCode: existing?.roomCode || null,
      lastSeenAt: Date.now(),
    };
    clients.set(playerId, client);
    return client;
  }

  function getPublicRoomSummaries() {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (now - (room.updatedAt || room.createdAt || 0) > 7200_000) {
        rooms.delete(code);
      }
    }
    return Array.from(rooms.values())
      .filter((r) => r.status === 'LOBBY')
      .map((r) => ({
        code: r.code,
        name: r.name,
        mode: r.mode,
        mapId: r.mapId,
        maxPlayers: r.maxPlayers,
        humanCount: Math.max(
          1,
          r.slots.filter((s) => s.occupiedBy === 'human').length
        ),
        status: r.status,
      }));
  }

  function removePlayerFromCurrentRoom(client: ConnectedClient) {
    const code = client.roomCode ? normalizeRoomCode(client.roomCode) : null;
    if (!code) return;
    client.roomCode = null;
  
    const room = rooms.get(code);
    if (!room) return;
  
    const slot = room.slots.find((s) => s.playerId === client.playerId);
    if (slot) {
      const botDef = DEFAULT_BOT_CHARS[slot.slotIndex % DEFAULT_BOT_CHARS.length];
      slot.occupiedBy = room.fillWithBots ? 'bot' : 'empty';
      slot.playerId = null;
      slot.playerName = room.fillWithBots ? botDef.name : 'OPEN SLOT';
      slot.charId = botDef.charId;
      slot.outfitId = botDef.outfitId;
      slot.faceId = botDef.faceId;
      slot.ready = true;
      slot.isHost = false;
      slot.micOn = false;
      slot.speaking = false;
    }
  
    const remainingHumans = room.slots.filter((s) => s.occupiedBy === 'human');
    if (remainingHumans.length === 0) {
      rooms.delete(code);
      publishRoomDeleteToCluster(code);
    } else {
      if (room.hostId === client.playerId) {
        const nextHost = remainingHumans[0];
        room.hostId = nextHost.playerId!;
        nextHost.isHost = true;
      }
      broadcastRoomState(code, true);
    }
    broadcastPublicRoomList(true);
  }

  function handleCreateRoomForClient(
    client: ConnectedClient,
    data: Record<string, any>,
    forcedCode?: string
  ): CustomRoomState {
    const requestedCode = normalizeRoomCode(forcedCode || data.customCode || '');
  
    // CRITICAL FIX: If a room with this requestedCode ALREADY exists, DO NOT create a separate lobby!
    // Instead, join the existing room so two players using the same code ALWAYS enter the SAME lobby!
    if (requestedCode.length >= 3 && rooms.has(requestedCode)) {
      const joinRes = handleJoinRoomForClient(client, requestedCode, undefined, data);
      if (joinRes.room) {
        return joinRes.room;
      }
    }
  
    if (client.roomCode && (!requestedCode || client.roomCode !== requestedCode)) {
      removePlayerFromCurrentRoom(client);
    }
  
    const mode: CustomRoomState['mode'] =
      isVolleyballMode(data.mode) ||
      data.mode === 'obstacle_rush' ||
      data.mode === 'floor_is_lava'
        ? data.mode
        : 'obstacle_rush';
    const maxPlayers = customPlayerCount(mode, Number(data.maxPlayers) || 5);
    const fillWithBots = data.fillWithBots !== false;
    const code =
      requestedCode.length >= 3 && !rooms.has(requestedCode)
        ? requestedCode
        : generateRoomCode();
  
    const slots = buildInitialSlots(mode, maxPlayers, fillWithBots);
    slots[0] = {
      slotIndex: 0,
      team: isVolleyballMode(mode) ? 'blue' : 'solo',
      occupiedBy: 'human',
      playerId: client.playerId,
      playerName: client.name,
      charId: client.charId,
      outfitId: client.outfitId,
      faceId: client.faceId,
      ready: true,
      isHost: true,
      micOn: false,
      listenOn: true,
      speaking: false,
    };
  
    const room: CustomRoomState = {
      code,
      name: `${client.name}'s Room`,
      hostId: client.playerId,
      mode,
      mapId: String(
        data.mapId ||
          (isVolleyballMode(mode)
            ? 'pirate_cove'
            : mode === 'floor_is_lava'
              ? 'volcano_summit'
              : 'sky_carnival')
      ),
      maxPlayers,
      winScore: Number(data.winScore) || 5,
      timerMinutes: (data.timerMinutes === 5 || data.timerMinutes === 6
        ? data.timerMinutes
        : 3) as 3 | 5 | 6,
      difficulty: String(data.difficulty || 'breezy'),
      fillWithBots,
      status: 'LOBBY',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      slots,
    };
  
    rooms.set(code, room);
    client.roomCode = code;
    broadcastRoomState(code, true);
    broadcastPublicRoomList(true);
    return room;
  }

  function handleJoinRoomForClient(
    client: ConnectedClient,
    rawCode: string,
    preferredSlot?: number,
    fallbackOptions?: Record<string, any>,
    notifyClusterJoin: boolean = true
  ): { room?: CustomRoomState; error?: string } {
    const cleanCode = normalizeRoomCode(rawCode);
    if (!cleanCode) {
      return { error: 'Please enter a valid Room Code!' };
    }
  
    const room = findMatchingRoom(cleanCode);
  
    if (!room) return { error: 'Room not found. Check the code with your friend.' };
    if (room.status !== 'LOBBY') return { error: 'This match has already started. Try again when the lobby opens.' };
  
    // Check if player is already in a slot in this room
    let mySlot = room.slots.find((s) => s.playerId === client.playerId);
    if (!mySlot) {
      const prefIdx = typeof preferredSlot === 'number' ? preferredSlot : -1;
      if (
        prefIdx >= 0 &&
        prefIdx < room.slots.length &&
        room.slots[prefIdx].occupiedBy !== 'human'
      ) {
        mySlot = room.slots[prefIdx];
      } else {
        mySlot = room.slots.find((s) => s.occupiedBy !== 'human');
      }
  
      if (!mySlot) {
        return {
          error: `Room "${room.code}" is full (${room.maxPlayers}/${room.maxPlayers} players)!`,
        };
      }
  
      mySlot.occupiedBy = 'human';
      mySlot.playerId = client.playerId;
      mySlot.playerName = client.name;
      mySlot.charId = client.charId;
      mySlot.outfitId = client.outfitId;
      mySlot.faceId = client.faceId;
      mySlot.ready = false;
      mySlot.isHost = room.hostId === client.playerId;
      mySlot.micOn = false;
      mySlot.listenOn = true;
      mySlot.speaking = false;
    } else {
      mySlot.playerName = client.name;
      mySlot.charId = client.charId;
      mySlot.outfitId = client.outfitId;
      mySlot.faceId = client.faceId;
    }
  
    if (client.roomCode && client.roomCode !== room.code) removePlayerFromCurrentRoom(client);
    client.roomCode = room.code;
    broadcastRoomState(room.code, true);
    broadcastPublicRoomList(true);
    return { room };
  }

  function roomActionError(room: CustomRoomState, client: ConnectedClient, action: string): string | null {
    if (!room.slots.some(slot => slot.playerId === client.playerId && slot.occupiedBy === 'human')) return 'Join this room first.';
    if (['settings', 'toggle-bot', 'start', 'return'].includes(action) && room.hostId !== client.playerId) return 'Only the host can do that.';
    if (['settings', 'toggle-bot', 'select-slot'].includes(action) && room.status !== 'LOBBY') return 'Wait until the match ends to change the room.';
    if (action === 'start' && room.status !== 'PLAYING') {
      if (room.slots.some(slot => slot.occupiedBy === 'human' && !slot.isHost && !slot.ready)) return 'Wait for every player to get ready.';
      const occupied = room.slots.filter(slot => slot.occupiedBy !== 'empty').length;
      if (occupied < 2) return 'Invite a friend or add a bot before starting.';
      if (room.mode === 'volleyball_2v2' && occupied !== 4) return 'Fill all four slots for team volleyball.';
      if (room.mode === 'volleyball_1v1' && occupied !== 2) return 'Fill both slots for 1v1 volleyball.';
    }
    return null;
  }

  function applyRoomSettings(room: CustomRoomState, data: Record<string, any>): string | null {
    const mode = ['volleyball_1v1', 'volleyball_2v2', 'obstacle_rush', 'floor_is_lava'].includes(data.mode) ? data.mode as CustomRoomState['mode'] : room.mode;
    const count = customPlayerCount(mode, Number.isFinite(data.maxPlayers) ? data.maxPlayers : room.maxPlayers);
    if (count < room.slots.filter(slot => slot.occupiedBy === 'human').length) return 'There are more players in the room than available slots.';
    const rebuild = mode !== room.mode || count !== room.maxPlayers || (typeof data.fillWithBots === 'boolean' && data.fillWithBots !== room.fillWithBots);
    const changed = ['mode', 'mapId', 'maxPlayers', 'winScore', 'timerMinutes', 'difficulty', 'fillWithBots'].some(key => data[key] !== undefined && data[key] !== (room as any)[key]);
    if (mode !== room.mode) room.mapId = isVolleyballMode(mode) ? 'pirate_cove' : mode === 'floor_is_lava' ? 'volcano_summit' : 'sky_carnival';
    room.mode = mode;
    room.maxPlayers = count;
    if (typeof data.fillWithBots === 'boolean') room.fillWithBots = data.fillWithBots;
    if (typeof data.mapId === 'string') room.mapId = data.mapId;
    if ([5, 10, 15].includes(data.winScore)) room.winScore = data.winScore;
    if ([3, 5, 6].includes(data.timerMinutes)) room.timerMinutes = data.timerMinutes;
    if (typeof data.difficulty === 'string') room.difficulty = data.difficulty;
    if (rebuild) room.slots = buildInitialSlots(mode, count, room.fillWithBots, room.slots);
    if (changed) for (const slot of room.slots) if (slot.occupiedBy === 'human' && !slot.isHost) slot.ready = false;
    return null;
  }

  function applyPlayerUpdate(room: CustomRoomState, client: ConnectedClient, data: Record<string, any>) {
    const slot = room.slots.find(slot => slot.playerId === client.playerId);
    if (!slot) return;
    if (typeof data.name === 'string' && data.name.trim()) slot.playerName = client.name = data.name.trim().slice(0, 16);
    for (const key of ['charId', 'outfitId', 'faceId'] as const) if (typeof data[key] === 'string') {
      client[key] = data[key];
      if (room.status === 'LOBBY') slot[key] = data[key];
    }
    for (const key of ['ready', 'micOn', 'listenOn', 'speaking'] as const) if (typeof data[key] === 'boolean') slot[key] = data[key];
  }

  function startRoomMatch(room: CustomRoomState) {
    if (room.status === 'PLAYING') return;
    dealCustomCharacters(room.slots);
    room.status = 'PLAYING';
    room.matchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    broadcastRoomState(room.code, true);
    broadcastMatchStartLocal(room.code);
    broadcastPublicRoomList(true);
  }

  function returnRoomToLobby(room: CustomRoomState) {
    room.status = 'LOBBY';
    for (const slot of room.slots) if (slot.occupiedBy === 'human' && !slot.isHost) slot.ready = false;
    broadcastRoomState(room.code, true);
    broadcastPublicRoomList(true);
  }

  return { rooms, clients, normalizeRoomCode, findMatchingRoom, generateRoomCode, buildInitialSlots, getOrUpdateClient, getPublicRoomSummaries, removePlayerFromCurrentRoom, handleCreateRoomForClient, handleJoinRoomForClient, roomActionError, applyRoomSettings, applyPlayerUpdate, startRoomMatch, returnRoomToLobby, broadcastRoomState, broadcastPublicRoomList,
    snapshot: (): RoomSnapshot => ({ rooms: structuredClone([...rooms.values()]), clients: [...clients.values()].map(({ ws, ...client }) => ({ ...client })) }),
  };
}
