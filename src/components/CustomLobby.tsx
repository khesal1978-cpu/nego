import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Crown, Headphones, LogOut, Mic, MicOff, Pencil, Plus, RefreshCw, Users, Wifi, WifiOff, X } from 'lucide-react';
import { DIFFICULTY_LEVELS, type CharacterConfig, type CharacterId } from '../types/game';
import { normalizeRoomCodeClient, type CustomRoomInfo, type CustomSlotInfo, type multiplayerClient, type PublicRoomSummary } from '../network/multiplayerClient';
import { isVolleyballMode, volleyballSlots } from '../network/customModes';
import type { MenuMap } from './GameMenus';
import './gameMenus.css';
import './customLobby.css';

type Mode = CustomRoomInfo['mode'];
const modes: Array<{ id: Mode; name: string; description: string }> = [
  { id: 'obstacle_rush', name: 'Gun Fight', description: 'A free-for-all in the fortress.' },
  { id: 'volleyball_1v1', name: 'Volleyball 1v1', description: 'You versus a friend or a bot.' },
  { id: 'volleyball_2v2', name: 'Volleyball 2v2', description: 'Two teams. One winning rally.' },
  { id: 'floor_is_lava', name: 'Nuke Showdown', description: 'Dodge, throw, and outlast the rest.' },
];
const modeName = (id: Mode) => modes.find(mode => mode.id === id)?.name;

interface Props {
  client: typeof multiplayerClient;
  connected: boolean;
  room: CustomRoomInfo | null;
  rooms: PublicRoomSummary[];
  error: string | null;
  playerName: string;
  selectedCharacter: CharacterId;
  mic: boolean;
  listen: boolean;
  speaking: boolean;
  maps: Record<Mode, MenuMap[]>;
  renderPortrait: (slot: CustomSlotInfo) => React.ReactNode;
  onCharacter: (character: CharacterConfig) => void;
  onName: () => void;
  onBack: () => void;
  onDismissError: () => void;
  onResume: () => void;
}

export function CustomLobby(p: Props) {
  const [mode, setMode] = useState<Mode>('obstacle_rush');
  const [players, setPlayers] = useState(5);
  const [bots, setBots] = useState(true);
  const [mapId, setMapId] = useState(p.maps.obstacle_rush[0]?.id ?? 'sky_carnival');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const room = p.room;
  const activeMode = room?.mode ?? mode;
  const activeMapId = room?.mapId ?? mapId;
  const maps = p.maps[activeMode];
  const host = room?.hostId === p.client.playerId;
  const me = room?.slots.find(slot => slot.playerId === p.client.playerId);
  const humans = room?.slots.filter(slot => slot.occupiedBy === 'human') ?? [];
  const waiting = humans.filter(slot => !slot.ready && !slot.isHost).length;
  const occupied = room?.slots.filter(slot => slot.occupiedBy !== 'empty').length ?? 0;
  const fullTeams = !isVolleyballMode(room?.mode) || occupied === volleyballSlots(room!.mode);
  const inMatch = room?.status === 'PLAYING';
  const canEdit = p.connected && !busy && !inMatch && (!room || host);
  const canStart = host && p.connected && !busy && !inMatch && waiting === 0 && occupied >= 2 && fullTeams;

  async function run(label: string, action: () => unknown | Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(label);
    setLocalError(null);
    try { await action(); } catch (error) { setLocalError(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); }
    finally { pending.current = false; setBusy(null); }
  }

  function chooseMode(next: Mode) {
    const nextMap = p.maps[next][0]?.id ?? '';
    if (room) void run('Updating room…', () => p.client.updateRoomSettings({ mode: next, mapId: nextMap, maxPlayers: isVolleyballMode(next) ? volleyballSlots(next) : room.maxPlayers }));
    else { setMode(next); setMapId(nextMap); }
  }

  const mapPicker = <div className="custom-map-picker"><h3>Arena</h3><div className="map-grid">{maps.map(map => <button key={map.id} className="menu-map-card" aria-pressed={activeMapId === map.id} disabled={!canEdit} onClick={() => room ? void run('Updating arena…', () => p.client.updateRoomSettings({ mapId: map.id })) : setMapId(map.id)}><div className="menu-map-image">{map.preview}</div><div className="menu-map-caption"><h3>{map.name}</h3><span className="menu-map-check">{activeMapId === map.id && <Check size={13} />}</span></div></button>)}</div></div>;
  const modePicker = <label className="custom-field">Game mode<select value={activeMode} disabled={!canEdit} onChange={event => chooseMode(event.target.value as Mode)}>{modes.map(item => <option key={item.id} value={item.id} disabled={Boolean(room && isVolleyballMode(item.id) && humans.length > volleyballSlots(item.id))}>{item.name}</option>)}</select></label>;
  const playerPicker = <label className="custom-field">Player slots<select value={isVolleyballMode(activeMode) ? volleyballSlots(activeMode) : room?.maxPlayers ?? players} disabled={!canEdit || isVolleyballMode(activeMode)} onChange={event => room ? void run('Updating slots…', () => p.client.updateRoomSettings({ maxPlayers: Number(event.target.value) })) : setPlayers(Number(event.target.value))}>{(isVolleyballMode(activeMode) ? [volleyballSlots(activeMode)] : [2, 3, 4, 5]).map(count => <option key={count} value={count} disabled={count < humans.length}>{count} players{isVolleyballMode(activeMode) ? activeMode === 'volleyball_1v1' ? ' · 1 vs 1' : ' · 2 vs 2' : ''}</option>)}</select></label>;
  const botToggle = <label className="custom-checkbox"><input type="checkbox" checked={room?.fillWithBots ?? bots} disabled={!canEdit} onChange={event => room ? void run('Updating bots…', () => p.client.updateRoomSettings({ fillWithBots: event.target.checked })) : setBots(event.target.checked)} /><span>Fill open slots with bots<small>Friends can take a bot’s place before the match.</small></span></label>;

  return <section className="game-menu custom-menu" aria-label="Custom multiplayer">
    <header className="menu-header"><button className="menu-icon-button" onClick={p.onBack} aria-label="Back to main menu"><ArrowLeft size={20} /></button><div><h1>{room ? 'Your room' : 'Play together'}</h1><p>{room ? `${modeName(room.mode)} · ${room.name}` : 'Create a room, invite your friends, and make it your match.'}</p></div><span className={`custom-connection ${p.connected ? 'is-connected' : ''}`} role="status">{p.connected ? <Wifi size={14} /> : <WifiOff size={14} />}{p.connected ? 'Connected' : 'Reconnecting…'}</span></header>
    <div className="custom-profile"><button onClick={p.onName}><Pencil size={13} />{p.playerName}</button><div className="custom-profile-audio"><button aria-pressed={p.mic} disabled={Boolean(busy)} onClick={() => void run('Connecting microphone…', () => p.client.toggleMicrophone())}>{p.mic ? <Mic size={15} /> : <MicOff size={15} />}{p.mic ? p.speaking ? 'Speaking' : 'Mic on' : 'Mic off'}</button><button aria-pressed={p.listen} onClick={() => p.client.toggleListen()}><Headphones size={15} />{p.listen ? 'Voice on' : 'Voice off'}</button></div></div>
    {(p.error || localError) && <div className="custom-error" role="alert"><span>{localError || p.error}</span><button aria-label="Dismiss error" onClick={() => { setLocalError(null); p.onDismissError(); }}><X size={16} /></button></div>}
    <div className="custom-scroll">
      {!room ? <div className="custom-entry-layout">
        <section className="custom-card custom-create"><div className="custom-card-heading"><span className="custom-section-icon"><Plus size={20} /></span><div><h2>Create a room</h2><p>You choose the game. Everyone joins with a code.</p></div></div><div className="custom-mode-cards" role="group" aria-label="Game mode">{modes.map(item => <button key={item.id} aria-pressed={mode === item.id} disabled={!canEdit} onClick={() => chooseMode(item.id)}><span>{item.name}{mode === item.id && <Check size={14} />}</span><small>{item.description}</small></button>)}</div>{mapPicker}<div className="custom-fields">{playerPicker}{botToggle}</div><button className="menu-primary" disabled={!canEdit} onClick={() => void run('Creating room…', () => p.client.createCustomRoom({ mode, mapId, maxPlayers: isVolleyballMode(mode) ? volleyballSlots(mode) : players, fillWithBots: bots, winScore: 5, timerMinutes: 3, difficulty: 'breezy' }))}>{busy === 'Creating room…' ? busy : 'Create room'}<Plus size={17} /></button></section>
        <div className="custom-join-column"><section className="custom-card"><div className="custom-card-heading"><span className="custom-section-icon"><Users size={19} /></span><div><h2>Join your friends</h2><p>Enter the room code they shared with you.</p></div></div><form className="custom-code-form" onSubmit={event => { event.preventDefault(); if (code.length >= 3 && p.connected && !busy) void run('Joining room…', () => p.client.joinCustomRoom(code)); }}><label htmlFor="custom-room-code">Room code</label><div><input id="custom-room-code" value={code} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCDE" maxLength={6} onChange={event => setCode(normalizeRoomCodeClient(event.target.value))} /><button className="menu-primary" type="submit" disabled={!p.connected || Boolean(busy) || code.length < 3}>{busy === 'Joining room…' ? 'Joining…' : 'Join'}<ArrowRight size={16} /></button></div></form></section>
        <section className="custom-card custom-public"><div className="custom-public-heading"><h2>Open rooms <span>{p.rooms.filter(item => item.status === 'LOBBY').length}</span></h2><button className="menu-icon-button" aria-label="Refresh rooms" disabled={Boolean(busy)} onClick={() => void run('Refreshing rooms…', () => p.client.refreshStateHttp())}><RefreshCw size={15} /></button></div><div className="custom-room-list">{p.rooms.filter(item => item.status === 'LOBBY').map(item => <button key={item.code} disabled={!p.connected || Boolean(busy) || item.humanCount >= item.maxPlayers} onClick={() => void run('Joining room…', () => p.client.joinCustomRoom(item.code))}><span><strong>{item.name}</strong><small>{modeName(item.mode)} · {item.code}</small></span><span className="custom-room-count">{item.humanCount}/{item.maxPlayers}<ArrowRight size={15} /></span></button>)}{!p.rooms.some(item => item.status === 'LOBBY') && <div className="custom-empty"><Users size={28} /><h3>{p.connected ? 'Your group can be first' : 'Looking for a connection'}</h3><p>{p.connected ? 'Create a room and share its code with a friend.' : 'Rooms will appear when the connection is restored.'}</p></div>}</div></section></div>
      </div> : <>
        <div className="custom-room-banner"><div><span className="custom-eyebrow">Invite with this code</span><div className="custom-share-code"><code>{room.code}</code><button onClick={() => void run('Copying code…', async () => { if (!navigator.clipboard) throw new Error('Select and copy the room code above.'); await navigator.clipboard.writeText(room.code); setCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); })}><Copy size={14} />{copied ? 'Copied' : 'Copy code'}</button></div></div><div className="custom-room-summary"><strong>{humans.length} / {room.maxPlayers} players</strong><span>{room.slots.filter(slot => slot.occupiedBy === 'bot').length} bots · {inMatch ? 'Match in progress' : 'Lobby open'}</span></div><button className="custom-leave" disabled={Boolean(busy)} onClick={() => void run('Leaving room…', () => p.client.leaveCustomRoom())}><LogOut size={15} />Leave room</button></div>
        <div className="custom-room-layout"><div className="custom-squad-column"><section className="custom-card"><div className="custom-card-heading"><div><h2>The players</h2><p>{inMatch ? 'Your match is in progress.' : 'Choose an open slot to switch your place.'}</p></div><span className="custom-small-badge">{host ? 'You’re the host' : 'Guest'}</span></div><div className="custom-slots">{room.slots.map(slot => { const mine = slot.playerId === p.client.playerId; return <article key={slot.slotIndex} className={`custom-slot ${mine ? 'is-you' : ''}`}><div className="custom-slot-meta"><span>{slot.team === 'solo' ? `Slot ${slot.slotIndex + 1}` : `${slot.team === 'blue' ? 'Blue' : 'Red'} team`}</span>{slot.isHost && <span><Crown size={12} />Host</span>}</div><div className="custom-portrait">{slot.occupiedBy === 'empty' ? <Users size={34} /> : p.renderPortrait(slot)}</div><h3>{slot.occupiedBy === 'empty' ? 'Open slot' : slot.playerName}{mine && <small>You</small>}</h3><p className={slot.ready && slot.occupiedBy !== 'empty' ? 'custom-ready' : ''}>{slot.occupiedBy === 'empty' ? 'Invite a friend' : slot.occupiedBy === 'bot' ? 'Bot · ready' : slot.isHost ? 'Host' : slot.ready ? 'Ready' : 'Not ready'}{slot.occupiedBy === 'human' && slot.micOn && <Mic size={12} aria-label={slot.speaking ? 'Speaking' : 'Microphone on'} />}</p>{slot.occupiedBy !== 'human' && <div className="custom-slot-actions"><button disabled={!p.connected || Boolean(busy) || inMatch} onClick={() => void run('Switching slot…', () => p.client.selectSlot(slot.slotIndex))}>Take slot</button>{host && <button disabled={!canEdit} onClick={() => void run('Updating bot…', () => p.client.toggleSlotBot(slot.slotIndex))}>{slot.occupiedBy === 'bot' ? 'Remove bot' : 'Add bot'}</button>}</div>}</article>; })}</div></section>
        <section className="custom-card custom-random-characters"><h2>Random characters</h2><p>Everyone gets a different random character when the match starts. A fresh character every match.</p></section></div>
        <aside className="custom-card custom-room-settings"><div className="custom-card-heading"><div><h2>Match setup</h2><p>{host ? 'Changes update for everyone.' : 'The host manages these settings.'}</p></div></div><div className="custom-fields">{modePicker}{playerPicker}<label className="custom-field">{isVolleyballMode(activeMode) ? 'Winning score' : 'Match length'}<select disabled={!canEdit} value={isVolleyballMode(activeMode) ? room.winScore : room.timerMinutes} onChange={event => void run('Updating match…', () => p.client.updateRoomSettings(isVolleyballMode(activeMode) ? { winScore: Number(event.target.value) } : { timerMinutes: Number(event.target.value) as 3 | 5 | 6 }))}>{(isVolleyballMode(activeMode) ? [5, 10, 15] : [3, 5, 6]).map(value => <option key={value} value={value}>{value} {isVolleyballMode(activeMode) ? 'points' : 'minutes'}</option>)}</select></label><label className="custom-field">Bot difficulty<select disabled={!canEdit} value={room.difficulty} onChange={event => void run('Updating difficulty…', () => p.client.updateRoomSettings({ difficulty: event.target.value }))}>{DIFFICULTY_LEVELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>{botToggle}{mapPicker}</aside></div>
      </>}
    </div>
    {room && <footer className="custom-room-footer"><div role="status"><strong>{busy || (inMatch ? 'Match in progress' : waiting ? `Waiting for ${waiting} ${waiting === 1 ? 'player' : 'players'} to get ready` : occupied < 2 ? 'Add a bot or invite a friend' : !fullTeams ? `Fill all ${room.maxPlayers} slots for volleyball` : 'Everyone is ready')}</strong><p>{inMatch ? 'Return to your match or wait for the host to open the lobby.' : host ? 'Start when your group is ready.' : 'Ready up when you’re happy with the match setup.'}</p></div>{inMatch ? <><button className="menu-primary" disabled={Boolean(busy)} onClick={p.onResume}>Return to match<ArrowRight size={17} /></button>{host && <button className="menu-text-button" onClick={() => void run('Opening lobby…', () => p.client.returnToLobby())}>Open lobby</button>}</> : host ? <button className="menu-primary" disabled={!canStart} onClick={() => void run('Starting match…', () => p.client.startMatch())}>Start match<ArrowRight size={17} /></button> : <button className="menu-primary" disabled={!p.connected || Boolean(busy) || !me} aria-pressed={me?.ready ?? false} onClick={() => void run('Updating ready status…', () => p.client.updateMyRoomPlayer({ ready: !me?.ready }))}>{me?.ready ? 'Cancel ready' : 'Ready to play'}<Check size={17} /></button>}</footer>}
  </section>;
}
