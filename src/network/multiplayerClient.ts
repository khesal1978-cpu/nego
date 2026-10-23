import { latestRoomSnapshot } from './roomSnapshot';
import type { CustomMode } from './customModes';
import type { MqttClient } from 'mqtt';
import { CharacterId, FaceId, OutfitId } from '../types/game';
import { acceptEventSequence, acceptSequence, MAX_REALTIME_BUFFER, voiceStartTime } from './transport';
import { multiplayerApi, multiplayerSocket, PUBLIC_MQTT_ENABLED } from './deploymentConfig';
import { DEFAULT_ICE_SERVERS, normalizeIceServers } from './iceServers';
import { watchIceRecovery } from './iceRecovery';

const CLUSTER_TOPIC_PREFIX = 'sixgun_mp_v3_ba31eb5b';

export interface CustomSlotInfo {
  slotIndex: number;
  team: 'blue' | 'red' | 'solo';
  occupiedBy: 'human' | 'bot' | 'empty';
  playerId: string | null;
  playerName: string;
  charId: CharacterId;
  outfitId: OutfitId;
  faceId: FaceId;
  ready: boolean;
  isHost: boolean;
  micOn: boolean;
  listenOn: boolean;
  speaking: boolean;
}

export interface CustomRoomInfo {
  code: string;
  name: string;
  hostId: string;
  mode: CustomMode;
  mapId: string;
  maxPlayers: number;
  winScore: number;
  timerMinutes: 3 | 5 | 6;
  difficulty: string;
  fillWithBots: boolean;
  status: 'LOBBY' | 'PLAYING';
  matchId?: string;
  createdAt: number;
  updatedAt?: number;
  version?: number;
  slots: CustomSlotInfo[];
}

export interface PublicRoomSummary {
  code: string;
  name: string;
  mode: CustomMode;
  mapId: string;
  maxPlayers: number;
  humanCount: number;
  status: 'LOBBY' | 'PLAYING';
}

export interface RemotePlayerStatePacket {
  roomCode?: string;
  matchId?: string;
  sequence?: number;
  senderId: string;
  slotIndex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp?: number;
  maxHp?: number;
  kills?: number;
  deaths?: number;
  weapon?: string;
  holdingBallId?: number | null;
  action?: string;
}

export interface RemoteGameEventPacket {
  roomCode?: string;
  matchId?: string;
  sequence?: number;
  senderId: string;
  eventKind: string;
  payload: Record<string, any>;
}

type Listener<T> = (data: T) => void;

export function normalizeRoomCodeClient(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .slice(0, 6);
}

export function mergeClientRooms(local: CustomRoomInfo | null | undefined, incoming: CustomRoomInfo): CustomRoomInfo {
  return latestRoomSnapshot(local, { ...incoming, code: normalizeRoomCodeClient(incoming.code) });
}

class MultiplayerClientManager {
  private ws: WebSocket | null = null;
  private mqttClient: MqttClient | null = null;
  private subscribedFastRoomCode: string | null = null;
  private broadcastChan: BroadcastChannel | null = null;
  private reconnectTimer: number | null = null;
  private pollTimer: number | null = null;
  private pendingWsQueue: Array<Record<string, any>> = [];
  private knownRoomsByCode = new Map<string, CustomRoomInfo>();

  public playerId: string;
  public playerName: string = 'Athlete';
  public charId: CharacterId = 'green_hoodie';
  public outfitId: OutfitId = 'crown_hoodie';
  public faceId: FaceId = 'happy_laugh';

  public connected: boolean = false;
  public onlineCount: number = 1;
  public currentRoom: CustomRoomInfo | null = null;
  public publicRooms: PublicRoomSummary[] = [];
  public lastError: string | null = null;

  // Voice Chat State (Talk & Listen)
  public micEnabled: boolean = false;
  public listenEnabled: boolean = true;
  public isSpeaking: boolean = false;
  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private vadInterval: number | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private remoteAudioEls = new Map<string, HTMLAudioElement>();
  private nextPlayTimeBySender = new Map<string, number>();
  private tickSequence = 0;
  private eventSequence = 0;
  private receivedTicks = new Map<string, number>();
  private receivedEvents = new Map<string, Set<number>>();
  private micRequest = 0;
  private micStarting = false;
  private makingOffers = new Set<string>();
  private ignoredOffers = new Set<string>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private signalQueues = new Map<string, Promise<void>>();
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private movementChannels = new Map<string, RTCDataChannel>();
  private actionChannels = new Map<string, RTCDataChannel>();
  private iceServers: RTCIceServer[] = [...DEFAULT_ICE_SERVERS];
  private iceRefreshTimer: number | null = null;
  private iceRecovery = new Map<string, () => void>();
  private lastIceRequest = -Infinity;

  private stateListeners = new Set<Listener<void>>();
  private matchStartListeners = new Set<Listener<CustomRoomInfo>>();
  private remoteTickListeners = new Set<Listener<RemotePlayerStatePacket>>();
  private remoteEventListeners = new Set<Listener<RemoteGameEventPacket>>();

  constructor() {
    // Generate a strictly unique playerId per window/tab instance so even duplicated browser tabs
    // never share the same playerId or overwrite each other's slot!
    this.playerId = `ath_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(-4)}`;
    try {
      const savedName = localStorage.getItem('sixgun_player_name');
      if (savedName && savedName.trim()) {
        this.playerName = savedName.trim().slice(0, 16);
      }
    } catch (_e) {
      // Ignore storage error
    }
    this.initBroadcastChannel();
    this.initGlobalMqttMesh();
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }
    try {
      const bc = new BroadcastChannel('sixgun_mp_bus_v3');
      this.broadcastChan = bc;
      bc.onmessage = (ev) => {
        if (!ev.data || ev.data.senderId === this.playerId) return;
        this.handleCrossPeerPacket(ev.data);
      };
    } catch (_e) {
      // Ignore if BroadcastChannel is blocked
    }
  }

  private async initGlobalMqttMesh() {
    if (!PUBLIC_MQTT_ENABLED) return;
    if (typeof window === 'undefined') return;
    try {
      const { default: mqtt } = await import('mqtt');
      const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: `sixgun_web_${this.playerId}`,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 8000,
      });
      this.mqttClient = client;

      client.on('connect', () => {
        client.subscribe(`${CLUSTER_TOPIC_PREFIX}/rooms/+`, { qos: 1 });
        client.subscribe(`${CLUSTER_TOPIC_PREFIX}/events`, { qos: 0 });
        if (this.currentRoom?.code) {
          this.subscribeFastRoomTopic(this.currentRoom.code);
        }
        this.notifyState();
      });

      client.on('message', (topic, payloadBuf) => {
        try {
          if (!payloadBuf || payloadBuf.length === 0) return;
          const data = JSON.parse(payloadBuf.toString());
          if (!data || data.senderId === this.playerId) return;

          if (topic.startsWith(`${CLUSTER_TOPIC_PREFIX}/rooms/`)) {
            if (data.deleted && data.code) {
              const norm = normalizeRoomCodeClient(data.code);
              this.knownRoomsByCode.delete(norm);
              this.rebuildPublicRoomsFromKnown();
              return;
            }
            if (data.room && data.room.code) {
              if (!this.connected && this.currentRoom?.code === normalizeRoomCodeClient(data.room.code)) this.ingestIncomingRoomState(data.room as CustomRoomInfo);
            }
            return;
          }

          this.handleCrossPeerPacket(data);
        } catch (_err) {
          // Ignore malformed packet
        }
      });

      client.on('error', () => {
        // Handled cleanly by reconnect + HTTP/WS
      });
    } catch (_e) {
      // Ignore MQTT init error
    }
  }

  private subscribeFastRoomTopic(rawCode: string) {
    const norm = normalizeRoomCodeClient(rawCode);
    if (!norm || !this.mqttClient) return;
    if (this.subscribedFastRoomCode && this.subscribedFastRoomCode !== norm) {
      try {
        this.mqttClient.unsubscribe(
          `${CLUSTER_TOPIC_PREFIX}/fast/${this.subscribedFastRoomCode}`
        );
      } catch (_e) {
        // Ignore
      }
    }
    this.subscribedFastRoomCode = norm;
    try {
      this.mqttClient.subscribe(`${CLUSTER_TOPIC_PREFIX}/fast/${norm}`, {
        qos: 0,
      });
    } catch (_e) {
      // Ignore
    }
  }

  private publishCrossPeer(
    payload: Record<string, any>,
    options?: { retainRoom?: CustomRoomInfo; fastRoomCode?: string }
  ) {
    const packet = {
      ...payload,
      senderId: this.playerId,
    };

    if (this.broadcastChan) {
      try {
        this.broadcastChan.postMessage(packet);
      } catch (_e) {
        // Ignore
      }
    }

    if (this.mqttClient && this.mqttClient.connected) {
      try {
        if (options?.retainRoom) {
          const norm = normalizeRoomCodeClient(options.retainRoom.code);
          this.mqttClient.publish(
            `${CLUSTER_TOPIC_PREFIX}/rooms/${norm}`,
            JSON.stringify({
              senderId: this.playerId,
              room: options.retainRoom,
              ts: Date.now(),
            }),
            { qos: 1, retain: true }
          );
        } else if (options?.fastRoomCode) {
          const norm = normalizeRoomCodeClient(options.fastRoomCode);
          this.mqttClient.publish(
            `${CLUSTER_TOPIC_PREFIX}/fast/${norm}`,
            JSON.stringify(packet),
            { qos: 0 }
          );
        } else {
          this.mqttClient.publish(
            `${CLUSTER_TOPIC_PREFIX}/events`,
            JSON.stringify(packet),
            { qos: 0 }
          );
        }
      } catch (_e) {
        // Ignore
      }
    }
  }

  private ingestIncomingRoomState(incoming: CustomRoomInfo) {
    const norm = normalizeRoomCodeClient(incoming.code);
    if (!norm) return;
    const merged = mergeClientRooms(this.knownRoomsByCode.get(norm), incoming);
    this.knownRoomsByCode.set(norm, merged);
    if (this.currentRoom?.code === norm) {
      const previous = this.currentRoom;
      const room = mergeClientRooms(previous, merged);
      if (!room.slots.some(slot => slot.playerId === this.playerId)) {
        this.currentRoom = null;
        this.cleanupVoicePeers();
      } else {
        this.currentRoom = room;
        if (previous.status !== 'PLAYING' && room.status === 'PLAYING') {
          for (const cb of this.matchStartListeners) cb(room);
        }
        this.syncWebRTCPeers(previous, room);
      }
    }
    this.notifyState();
  }

  private rebuildPublicRoomsFromKnown() {
    this.publicRooms = this.publicRooms.filter(room => room.status === 'LOBBY');
  }

  private handleCrossPeerPacket(data: Record<string, any>) {
    const type = data.type as string;

    if (type === 'room:state' || type === 'cluster:join_request' || type === 'match:start') return;
    if (this.connected) return;

    const packet = data.packet || data;
    const roomCode = normalizeRoomCodeClient(
      data.roomCode || packet.roomCode || ''
    );
    if (
      !this.currentRoom ||
      (roomCode &&
        normalizeRoomCodeClient(this.currentRoom.code) !== roomCode)
    ) {
      return;
    }

    if (type === 'game:player_state' || packet.type === 'game:player_state') {
      const pkt = packet as RemotePlayerStatePacket;
      if (this.acceptRemotePacket(pkt, this.receivedTicks)) {
        for (const cb of this.remoteTickListeners) {
          cb(pkt);
        }
      }
      return;
    }

    if (type === 'game:event' || packet.type === 'game:event') {
      const pkt = packet as RemoteGameEventPacket;
      if (this.acceptRemoteEvent(pkt)) {
        for (const cb of this.remoteEventListeners) {
          cb(pkt);
        }
      }
      return;
    }

    if (type === 'voice:audio_chunk' || packet.type === 'voice:audio_chunk') {
      if (
        this.listenEnabled &&
        packet.senderId !== this.playerId &&
        Array.isArray(packet.samples)
      ) {
        this.playIncomingAudioChunk(
          String(packet.senderId || ''),
          packet.samples as number[],
          Number(packet.sampleRate) || 16000
        );
      }
      return;
    }
  }

  public connect() {
    this.startPollingFallback();

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const url = multiplayerSocket(window.location);
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.connected = true;
        this.send({
          type: 'player:identify',
          playerId: this.playerId,
          name: this.playerName,
          charId: this.charId,
          outfitId: this.outfitId,
          faceId: this.faceId,
          roomCode: this.currentRoom?.code || null,
        });
        while (this.pendingWsQueue.length > 0) {
          const item = this.pendingWsQueue.shift();
          if (item && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(item));
          }
        }
        this.notifyState();
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this.handleMessage(msg);
        } catch (_err) {
          // Ignore invalid JSON
        }
      };

      ws.onclose = () => {
        this.connected = false;
        this.notifyState();
        if (this.reconnectTimer === null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 2200);
        }
      };

      ws.onerror = () => {
        // Handled cleanly via HTTP/MQTT fallback + auto-reconnect
      };
    } catch (_err) {
      // HTTP + MQTT fallback remains active
    }
  }

  private startPollingFallback() {
    if (this.pollTimer !== null || typeof window === 'undefined') return;
    this.refreshStateHttp();
    this.pollTimer = window.setInterval(() => {
      if (!this.connected) void this.refreshStateHttp();
    }, 1800);
  }

  public async refreshStateHttp() {
    try {
      const params = new URLSearchParams({
        playerId: this.playerId,
        roomCode: this.currentRoom?.code || '',
      });
      const requestedRoom = this.currentRoom?.code;
      const res = await fetch(multiplayerApi(`/api/mp/state?${params.toString()}`), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.rooms)) {
        this.publicRooms = data.rooms;
        this.rebuildPublicRoomsFromKnown();
      }
      if (typeof data.onlineCount === 'number') {
        this.onlineCount = Math.max(1, data.onlineCount);
      }
      if (data.room && requestedRoom === this.currentRoom?.code) {
        this.ingestIncomingRoomState(data.room as CustomRoomInfo);
      } else if (!data.room && requestedRoom && requestedRoom === this.currentRoom?.code) {
        this.knownRoomsByCode.delete(requestedRoom);
        this.currentRoom = null;
        this.stopMicrophone();
        this.lastError = 'This room is no longer available. Create a room or join again.';
      }
      this.notifyState();
    } catch (_e) {
      // Ignore transient network errors
    }
  }

  private handleMessage(msg: any) {
    const type = msg.type as string;
    if (type === 'rtc:config') { this.applyIceConfiguration(msg); return; }

    if (type === 'rooms:list') {
      this.publicRooms = Array.isArray(msg.rooms) ? msg.rooms : [];
      this.rebuildPublicRoomsFromKnown();
      this.onlineCount = Math.max(1, Number(msg.onlineCount) || 1);
      this.notifyState();
      return;
    }

    if (type === 'room:state' && msg.room) {
      this.lastError = null;
      this.ingestIncomingRoomState(msg.room as CustomRoomInfo);
      return;
    }

    if (type === 'room:left') {
      this.currentRoom = null;
      this.cleanupVoicePeers();
      this.notifyState();
      return;
    }

    if (type === 'room:error') {
      this.lastError = String(msg.message || 'Unable to join room');
      this.notifyState();
      return;
    }

    if (type === 'match:start' && msg.room) {
      this.ingestIncomingRoomState(msg.room as CustomRoomInfo);
      return;
    }

    if (type === 'game:player_state') {
      const pkt = msg as RemotePlayerStatePacket;
      if (this.acceptRemotePacket(pkt, this.receivedTicks)) {
        for (const cb of this.remoteTickListeners) {
          cb(pkt);
        }
      }
      return;
    }

    if (type === 'game:event') {
      const pkt = msg as RemoteGameEventPacket;
      if (this.acceptRemoteEvent(pkt)) {
        for (const cb of this.remoteEventListeners) {
          cb(pkt);
        }
      }
      return;
    }

    if (type === 'voice:signal') {
      this.handleVoiceSignal(String(msg.fromId || ''), msg.signal);
      return;
    }

    if (type === 'voice:audio_chunk') {
      if (
        this.listenEnabled &&
        msg.senderId !== this.playerId &&
        Array.isArray(msg.samples)
      ) {
        this.playIncomingAudioChunk(
          String(msg.senderId || ''),
          msg.samples as number[],
          Number(msg.sampleRate) || 16000
        );
      }
      return;
    }
  }

  public send(payload: Record<string, any>) {
    // Movement and voice must never sit behind an ever-growing WebSocket queue.
    const replaceableState = payload.type === 'game:event' && String(payload.eventKind).endsWith(':state') && payload.payload?.matchEnded !== true;
    if ((payload.type === 'game:player_state' || payload.type === 'voice:audio_chunk' || replaceableState) && (this.ws?.bufferedAmount || 0) > MAX_REALTIME_BUFFER) return;
    const enriched = {
      playerId: this.playerId,
      name: this.playerName,
      charId: this.charId,
      outfitId: this.outfitId,
      faceId: this.faceId,
      roomCode: this.currentRoom?.code || null,
      ...payload,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(enriched));
    } else if (
      !String(payload.type).startsWith('game:') &&
      payload.type !== 'voice:audio_chunk'
    ) {
      this.pendingWsQueue.push(enriched);
      if (this.pendingWsQueue.length > 12) {
        this.pendingWsQueue.shift();
      }
    }
  }

  public syncProfile(
    name: string,
    charId: CharacterId,
    outfitId: OutfitId,
    faceId: FaceId
  ) {
    this.playerName = name.trim().slice(0, 16) || 'Athlete';
    this.charId = charId;
    this.outfitId = outfitId;
    this.faceId = faceId;
    try {
      localStorage.setItem('sixgun_player_name', this.playerName);
    } catch (_e) {
      // Ignore storage error
    }
    if (this.currentRoom) {
      void this.updateMyRoomPlayer({ name: this.playerName, charId: this.charId, outfitId: this.outfitId, faceId: this.faceId });
    } else {
      this.send({ type: 'player:update_profile', name: this.playerName, charId: this.charId, outfitId: this.outfitId, faceId: this.faceId });
    }
    this.notifyState();
  }

  private async roomRequest(path: string, payload: Record<string, unknown> = {}, enter = false) {
    this.lastError = null;
    this.notifyState();
    try {
      const response = await fetch(multiplayerApi('/api/mp/room/' + path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ playerId: this.playerId, name: this.playerName,
          charId: this.charId, outfitId: this.outfitId, faceId: this.faceId,
          roomCode: this.currentRoom?.code, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'The room could not be updated.');
      if (path === 'leave') {
        if (this.currentRoom) this.knownRoomsByCode.delete(this.currentRoom.code);
        this.currentRoom = null;
        this.stopMicrophone();
        this.cleanupVoicePeers();
      } else if (data.room) {
        if (enter) {
          this.cleanupVoicePeers();
          this.currentRoom = data.room;
          this.knownRoomsByCode.set(data.room.code, data.room);
          this.subscribeFastRoomTopic(data.room.code);
          this.syncWebRTCPeers(null, data.room);
          if (this.micEnabled || !this.listenEnabled) void this.updateMyRoomPlayer({ micOn: this.micEnabled, listenOn: this.listenEnabled, speaking: this.isSpeaking });
        } else this.ingestIncomingRoomState(data.room);
      }
      if (Array.isArray(data.rooms)) this.publicRooms = data.rooms;
      this.notifyState();
      return true;
    } catch (error) {
      this.lastError = error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Connection timed out. Please try again.';
      this.notifyState();
      return false;
    }
  }

  public async createCustomRoom(options: {
    mode: CustomRoomInfo['mode']; mapId: string; maxPlayers: number; winScore: number;
    timerMinutes: 3 | 5 | 6; difficulty: string; fillWithBots: boolean; customCode?: string;
  }) { return this.roomRequest('create', options, true); }

  public async joinCustomRoom(code: string, preferredSlot?: number) {
    const cleanCode = normalizeRoomCodeClient(code);
    if (cleanCode.length < 3) {
      this.lastError = 'Enter a valid room code.';
      this.notifyState();
      return false;
    }
    return this.roomRequest('join', { code: cleanCode, preferredSlot }, true);
  }

  public async leaveCustomRoom() { return this.roomRequest('leave'); }
  public async selectSlot(slotIndex: number) { return this.roomRequest('select-slot', { slotIndex }); }
  public async toggleSlotBot(slotIndex: number) { return this.roomRequest('toggle-bot', { slotIndex }); }
  public async updateRoomSettings(settings: Partial<Pick<CustomRoomInfo, 'mode' | 'mapId' | 'maxPlayers' | 'winScore' | 'timerMinutes' | 'difficulty' | 'fillWithBots'>>) {
    return this.roomRequest('settings', settings);
  }
  public async updateMyRoomPlayer(updates: {
    name?: string; charId?: CharacterId; outfitId?: OutfitId; faceId?: FaceId;
    ready?: boolean; micOn?: boolean; listenOn?: boolean; speaking?: boolean;
  }) {
    if (!this.currentRoom) return false;
    return this.roomRequest('player', updates);
  }
  public async startMatch() { return this.roomRequest('start'); }
  public async returnToLobby() {
    if (this.currentRoom?.hostId !== this.playerId) return false;
    return this.roomRequest('return');
  }

  public sendPlayerTick(packet: Omit<RemotePlayerStatePacket, 'senderId'>) {
    if (!this.currentRoom || this.currentRoom.status !== 'PLAYING') return;
    const fullPacket: RemotePlayerStatePacket = {
      ...packet,
      roomCode: this.currentRoom.code,
      matchId: this.currentRoom.matchId,
      senderId: this.playerId,
      sequence: ++this.tickSequence,
    };
    const message = { type: 'game:player_state', ...fullPacket };
    if (!this.sendDirect(message, this.movementChannels)) this.send(message);
    if (!this.connected) this.publishCrossPeer(
      {
        type: 'game:player_state',
        roomCode: this.currentRoom.code,
        packet: fullPacket,
      },
      { fastRoomCode: this.currentRoom.code }
    );
  }

  public sendGameEvent(eventKind: string, payload: Record<string, any>) {
    if (!this.currentRoom || this.currentRoom.status !== 'PLAYING') return;
    const fullPacket: RemoteGameEventPacket = {
      roomCode: this.currentRoom.code,
      matchId: this.currentRoom.matchId,
      senderId: this.playerId,
      eventKind,
      payload,
      sequence: ++this.eventSequence,
    };
    const message = { type: 'game:event', ...fullPacket };
    // Snapshots are replaceable; reliable combat actions keep their own channel.
    const channels = eventKind.endsWith(':state') && payload.matchEnded !== true ? this.movementChannels : this.actionChannels;
    if (!this.sendDirect(message, channels)) this.send(message);
    if (!this.connected) this.publishCrossPeer(
      {
        type: 'game:event',
        roomCode: this.currentRoom.code,
        packet: fullPacket,
      },
      { fastRoomCode: this.currentRoom.code }
    );
  }

  // =========================================================================
  // Voice uses WebRTC with a bounded PCM relay while audio is negotiating.
  // =========================================================================
  public async toggleMicrophone(): Promise<boolean> {
    if (this.micEnabled || this.micStarting) {
      this.stopMicrophone();
      return false;
    }

    if (!this.currentRoom) return false;
    this.micStarting = true;
    const request = ++this.micRequest;
    const roomCode = this.currentRoom.code;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      if (request !== this.micRequest || this.currentRoom?.code !== roomCode) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      this.localStream = stream;
      this.micEnabled = true;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.analyser = analyser;

      const processor = this.audioCtx.createScriptProcessor(1024, 1, 1);
      const muteGain = this.audioCtx.createGain();
      muteGain.gain.value = 0;
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(this.audioCtx.destination);
      this.scriptProcessor = processor;
      this.micSource = source;
      this.micGain = muteGain;

      const inputSampleRate = this.audioCtx.sampleRate;
      const targetSampleRate = 16000;
      const ratio = Math.max(1, Math.round(inputSampleRate / targetSampleRate));

      processor.onaudioprocess = (ev) => {
        if (!this.micEnabled || !this.currentRoom) return;
        const needsRelay = this.currentRoom.slots.some(slot => slot.occupiedBy === 'human' && slot.playerId && slot.playerId !== this.playerId && !this.hasDirectAudio(slot.playerId, 'send'));
        if (!needsRelay) return;
        const input = ev.inputBuffer.getChannelData(0);
        let sumSq = 0;
        for (let i = 0; i < input.length; i += 4) {
          sumSq += input[i] * input[i];
        }
        const rms = Math.sqrt(sumSq / (input.length / 4));
        if (rms < 0.012) return;

        const downsampled: number[] = [];
        for (let i = 0; i < input.length; i += ratio) {
          downsampled.push(Math.round(input[i] * 1000) / 1000);
        }

        const voicePkt = {
          type: 'voice:audio_chunk',
          senderId: this.playerId,
          roomCode: this.currentRoom.code,
          sampleRate: Math.round(inputSampleRate / ratio),
          samples: downsampled,
        };
        this.send(voicePkt);
        if (!this.connected) this.publishCrossPeer(
          {
            type: 'voice:audio_chunk',
            roomCode: this.currentRoom.code,
            packet: voicePkt,
          },
          { fastRoomCode: this.currentRoom.code }
        );
      };

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      this.vadInterval = window.setInterval(() => {
        if (!this.analyser || !this.micEnabled) return;
        this.analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          sum += dataArr[i];
        }
        const avg = sum / dataArr.length;
        const speakingNow = avg > 14;
        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          this.updateMyRoomPlayer({
            micOn: this.micEnabled,
            listenOn: this.listenEnabled,
            speaking: this.isSpeaking,
          });
          this.notifyState();
        }
      }, 110);

      this.updateMyRoomPlayer({
        micOn: true,
        listenOn: this.listenEnabled,
        speaking: false,
      });

      if (this.currentRoom) {
        this.syncWebRTCPeers(null, this.currentRoom);
      }

      this.notifyState();
      return true;
    } catch (_err) {
      if (request !== this.micRequest) return false;
      this.stopMicrophone();
      this.lastError = !window.isSecureContext
        ? 'Microphone needs HTTPS. Open the shared HTTPS game link.'
        : _err instanceof Error && (_err.name === 'NotAllowedError' || _err.name === 'SecurityError')
          ? 'Microphone permission is blocked. Allow it in the browser site settings, then try again.'
          : 'Microphone is unavailable. Check that it is connected and not in use by another app.';
      this.notifyState();
      return false;
    } finally {
      if (request === this.micRequest) this.micStarting = false;
    }
  }

  public stopMicrophone() {
    this.micRequest++;
    this.micStarting = false;
    this.micEnabled = false;
    this.isSpeaking = false;
    if (this.vadInterval !== null) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (_e) {
        // Ignore
      }
      this.scriptProcessor = null;
    }
    this.micSource?.disconnect(); this.micSource = null;
    this.micGain?.disconnect(); this.micGain = null;
    this.analyser = null;
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    for (const pc of this.peerConnections.values()) {
      for (const sender of pc.getSenders()) if (sender.track) pc.removeTrack(sender);
    }
    this.updateMyRoomPlayer({
      micOn: false,
      listenOn: this.listenEnabled,
      speaking: false,
    });
    this.notifyState();
  }

  public toggleListen(): boolean {
    this.listenEnabled = !this.listenEnabled;
    for (const audioEl of this.remoteAudioEls.values()) {
      audioEl.muted = !this.listenEnabled;
      if (this.listenEnabled) void audioEl.play().catch(() => {});
    }
    if (this.listenEnabled && this.audioCtx?.state === 'suspended') void this.audioCtx.resume();
    this.updateMyRoomPlayer({
      micOn: this.micEnabled,
      listenOn: this.listenEnabled,
      speaking: this.isSpeaking,
    });
    this.notifyState();
    return this.listenEnabled;
  }

  private playIncomingAudioChunk(
    senderId: string,
    samples: number[],
    sampleRate: number
  ) {
    if (!this.listenEnabled || samples.length === 0 || samples.length > 4096 ||
      !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 48000 ||
      !this.currentRoom?.slots.some(slot => slot.occupiedBy === 'human' && slot.playerId === senderId)) return;
    if (this.hasDirectAudio(senderId, 'receive')) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const buf = this.audioCtx.createBuffer(1, samples.length, sampleRate);
      const chan = buf.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        chan[i] = samples[i];
      }

      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      const prevEnd = this.nextPlayTimeBySender.get(senderId) || 0;
      if (prevEnd > now + .15) return;
      const startAt = voiceStartTime(now, prevEnd);
      src.start(startAt);
      this.nextPlayTimeBySender.set(senderId, startAt + buf.duration);
    } catch (_e) {
      // Ignore audio context autoplay restriction
    }
  }

  private hasDirectAudio(remoteId: string, direction: 'send' | 'receive') {
    const pc = this.peerConnections.get(remoteId);
    if (pc?.connectionState !== 'connected') return false;
    return pc.getTransceivers().some(item => {
      const track = direction === 'send' ? item.sender.track : item.receiver.track;
      const active = direction === 'send' ? ['sendonly', 'sendrecv'] : ['recvonly', 'sendrecv'];
      return track?.kind === 'audio' && track.readyState === 'live' && active.includes(item.currentDirection || '') &&
        (direction === 'send' || !track.muted);
    });
  }

  private syncWebRTCPeers(
    _prevRoom: CustomRoomInfo | null,
    nextRoom: CustomRoomInfo
  ) {
    this.requestIceConfiguration();
    const humanIds = nextRoom.slots
      .filter(
        (s) =>
          s.occupiedBy === 'human' &&
          s.playerId &&
          s.playerId !== this.playerId
      )
      .map((s) => s.playerId!);

    for (const remoteId of humanIds) {
      if (!this.peerConnections.has(remoteId)) {
        void this.createPeerConnection(remoteId, this.playerId < remoteId);
      } else if (this.localStream) {
        const pc = this.peerConnections.get(remoteId)!;
        for (const track of this.localStream.getTracks()) if (!pc.getSenders().some(sender => sender.track === track)) {
          const transceiver = pc.getTransceivers().find(item => item.receiver.track.kind === track.kind && !item.sender.track);
          if (transceiver) { void transceiver.sender.replaceTrack(track); transceiver.direction = 'sendrecv'; }
          else pc.addTrack(track, this.localStream);
        }
      }
    }
    for (const remoteId of this.peerConnections.keys()) if (!humanIds.includes(remoteId)) {
      this.iceRecovery.get(remoteId)?.(); this.iceRecovery.delete(remoteId);
      this.peerConnections.get(remoteId)?.close(); this.peerConnections.delete(remoteId);
      const audio = this.remoteAudioEls.get(remoteId); if (audio) { audio.pause(); audio.srcObject = null; this.remoteAudioEls.delete(remoteId); }
      this.pendingCandidates.delete(remoteId); this.nextPlayTimeBySender.delete(remoteId);
      this.movementChannels.delete(remoteId); this.actionChannels.delete(remoteId);
    }
  }

  private requestIceConfiguration() {
    if (!this.currentRoom || Date.now() - this.lastIceRequest < 30000) return;
    this.lastIceRequest = Date.now();
    this.send({ type: 'rtc:request' });
  }

  private applyIceConfiguration(message: Record<string, any>) {
    if (!this.currentRoom) return;
    this.iceServers = normalizeIceServers(message.iceServers);
    for (const pc of this.peerConnections.values()) {
      if (pc.connectionState === 'closed') continue;
      try {
        pc.setConfiguration({ ...pc.getConfiguration(), iceServers: this.iceServers });
        if (pc.connectionState !== 'connected' && message.relay) pc.restartIce();
      } catch { /* The WebSocket relay remains usable on older browsers. */ }
    }
    if (this.iceRefreshTimer) window.clearTimeout(this.iceRefreshTimer);
    const ttl = Number.isFinite(message.expiresIn) ? Math.max(60, Math.min(3600, message.expiresIn)) : 60;
    this.iceRefreshTimer = window.setTimeout(() => {
      this.iceRefreshTimer = null; this.lastIceRequest = -Infinity; this.requestIceConfiguration();
    }, Math.max(30, ttl - 300) * 1000);
  }

  private async createPeerConnection(remoteId: string, isInitiator: boolean) {
    try {
      const pc = new RTCPeerConnection({
        iceServers: this.iceServers,
      });
      this.peerConnections.set(remoteId, pc);
      this.iceRecovery.set(remoteId, watchIceRecovery(pc, () => this.requestIceConfiguration()));
      const setupChannel = (channel: RTCDataChannel) => {
        const channels = channel.label === 'movement' ? this.movementChannels : this.actionChannels;
        channels.set(remoteId, channel);
        channel.onmessage = event => {
          try {
            const message = JSON.parse(String(event.data));
            if (message.senderId === remoteId && (message.type === 'game:player_state' || message.type === 'game:event')) this.handleMessage(message);
          } catch { /* Ignore incomplete packets; WebSocket remains available. */ }
        };
        channel.onclose = () => { if (channels.get(remoteId) === channel) channels.delete(remoteId); };
      };
      pc.ondatachannel = event => setupChannel(event.channel);
      if (isInitiator) {
        setupChannel(pc.createDataChannel('movement', { ordered: false, maxRetransmits: 0 }));
        setupChannel(pc.createDataChannel('actions', { ordered: true }));
      }
      pc.onnegotiationneeded = async () => {
        if (!isInitiator && !pc.remoteDescription) return;
        if (this.makingOffers.has(remoteId) || pc.signalingState !== 'stable') return;
        try {
          this.makingOffers.add(remoteId);
          await pc.setLocalDescription(await pc.createOffer());
          this.send({ type: 'voice:signal', targetId: remoteId, signal: { type: 'offer', sdp: pc.localDescription } });
        } catch { /* PCM relay remains available when negotiation fails. */ }
        finally { this.makingOffers.delete(remoteId); }
      };

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          pc.addTrack(track, this.localStream);
        }
      } else pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          this.send({
            type: 'voice:signal',
            targetId: remoteId,
            signal: { type: 'candidate', candidate: ev.candidate },
          });
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        let audioEl = this.remoteAudioEls.get(remoteId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          this.remoteAudioEls.set(remoteId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.muted = !this.listenEnabled;
        audioEl.play().catch(() => {});
      };

    } catch (_e) {
      // Fallback PCM chunk relay handles voice if WebRTC is blocked
    }
  }

  private handleVoiceSignal(fromId: string, signal: any) {
    const pending = (this.signalQueues.get(fromId) || Promise.resolve()).then(() => this.applyVoiceSignal(fromId, signal));
    this.signalQueues.set(fromId, pending);
    void pending.finally(() => { if (this.signalQueues.get(fromId) === pending) this.signalQueues.delete(fromId); });
    return pending;
  }

  private async applyVoiceSignal(fromId: string, signal: any) {
    if (!fromId || !signal) return;
    if (!this.currentRoom?.slots.some(slot => slot.occupiedBy === 'human' && slot.playerId === fromId && fromId !== this.playerId)) return;
    try {
      let pc = this.peerConnections.get(fromId);
      if (!pc) {
        await this.createPeerConnection(fromId, false);
        pc = this.peerConnections.get(fromId);
      }
      if (!pc) return;

      if (signal.type === 'offer' && signal.sdp) {
        const collision = this.makingOffers.has(fromId) || pc.signalingState !== 'stable';
        const polite = this.playerId > fromId;
        if (collision && !polite) { this.ignoredOffers.add(fromId); return; }
        this.ignoredOffers.delete(fromId);
        if (collision) await pc.setLocalDescription({ type: 'rollback' });
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({
          type: 'voice:signal',
          targetId: fromId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (this.ignoredOffers.has(fromId)) return;
        if (!pc.remoteDescription) {
          const pending = this.pendingCandidates.get(fromId) || [];
          pending.push(signal.candidate); this.pendingCandidates.set(fromId, pending.slice(-64));
          return;
        }
        await pc.addIceCandidate(signal.candidate);
      }
      if (pc.remoteDescription) {
        const pending = this.pendingCandidates.get(fromId) || [];
        this.pendingCandidates.delete(fromId);
        for (const candidate of pending) await pc.addIceCandidate(candidate);
      }
    } catch (_e) {
      // Ignore signaling race condition
    }
  }

  private cleanupVoicePeers() {
    for (const dispose of this.iceRecovery.values()) dispose();
    this.iceRecovery.clear();
    if (this.iceRefreshTimer) window.clearTimeout(this.iceRefreshTimer);
    this.iceRefreshTimer = null; this.lastIceRequest = -Infinity;
    this.iceServers = [...DEFAULT_ICE_SERVERS];
    this.receivedTicks.clear(); this.receivedEvents.clear();
    for (const pc of this.peerConnections.values()) {
      try {
        pc.close();
      } catch (_e) {
        // Ignore
      }
    }
    this.peerConnections.clear();
    this.signalQueues.clear();
    this.movementChannels.clear(); this.actionChannels.clear();
    this.pendingCandidates.clear(); this.makingOffers.clear(); this.ignoredOffers.clear(); this.nextPlayTimeBySender.clear();
    for (const audioEl of this.remoteAudioEls.values()) {
      audioEl.srcObject = null;
    }
    this.remoteAudioEls.clear();
  }

  private isCurrentPacket(packet: { senderId: string; roomCode?: string; matchId?: string }) {
    const room = this.currentRoom;
    return room?.status === 'PLAYING' && packet.senderId !== this.playerId &&
      (!packet.roomCode || packet.roomCode === room.code) && packet.matchId === room.matchId &&
      room.slots.some(slot => slot.occupiedBy === 'human' && slot.playerId === packet.senderId);
  }

  private acceptRemoteEvent(packet: RemoteGameEventPacket) {
    if (!this.isCurrentPacket(packet) || typeof packet.eventKind !== 'string' || !packet.payload || typeof packet.payload !== 'object') return false;
    let history = this.receivedEvents.get(packet.senderId);
    if (!history) { history = new Set(); this.receivedEvents.set(packet.senderId, history); }
    return acceptEventSequence(history, packet.sequence);
  }

  private acceptRemotePacket(packet: RemotePlayerStatePacket, history: Map<string, number>) {
    if (!this.isCurrentPacket(packet) || ![packet.x, packet.y, packet.z, packet.vx, packet.vy, packet.vz, packet.yaw].every(Number.isFinite)) return false;
    if (!acceptSequence(history.get(packet.senderId), packet.sequence)) return false;
    if (packet.sequence !== undefined) history.set(packet.senderId, packet.sequence);
    return true;
  }

  private sendDirect(message: Record<string, unknown>, channels: Map<string, RTCDataChannel>) {
    const peers = this.currentRoom?.slots.filter(slot => slot.occupiedBy === 'human' && slot.playerId && slot.playerId !== this.playerId) || [];
    if (!peers.length) return false;
    let deliveredToAll = true;
    const json = JSON.stringify(message);
    for (const slot of peers) {
      const channel = channels.get(slot.playerId!);
      if (channel?.readyState !== 'open') { deliveredToAll = false; continue; }
      const terminalState = (message.payload as Record<string, unknown> | undefined)?.matchEnded === true;
      if ((message.type === 'game:player_state' || (message.type === 'game:event' && String(message.eventKind).endsWith(':state') && !terminalState)) && channel.bufferedAmount > MAX_REALTIME_BUFFER) continue;
      try { channel.send(json); } catch { deliveredToAll = false; }
    }
    // Relay covers unavailable peers; sequence checks discard duplicate copies.
    return deliveredToAll;
  }

  public subscribe(cb: Listener<void>) {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  public onMatchStart(cb: Listener<CustomRoomInfo>) {
    this.matchStartListeners.add(cb);
    return () => {
      this.matchStartListeners.delete(cb);
    };
  }

  public onRemoteTick(cb: Listener<RemotePlayerStatePacket>) {
    this.remoteTickListeners.add(cb);
    return () => {
      this.remoteTickListeners.delete(cb);
    };
  }

  public onRemoteEvent(cb: Listener<RemoteGameEventPacket>) {
    this.remoteEventListeners.add(cb);
    return () => {
      this.remoteEventListeners.delete(cb);
    };
  }

  private notifyState() {
    for (const cb of this.stateListeners) {
      cb();
    }
  }
}

export const multiplayerClient = new MultiplayerClientManager();
