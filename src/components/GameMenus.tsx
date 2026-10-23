import React, { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, RotateCcw } from 'lucide-react';
import { DIFFICULTY_LEVELS, SUB_GAMES_LIST, type AIDifficulty, type GameMode, type LevelModifier } from '../types/game';
import './gameMenus.css';
import { GameInfo } from './GameInfo';

const SETTINGS_TABS = [{ id: 'gameplay', label: 'Gameplay' }, { id: 'camera', label: 'Camera & effects' }, { id: 'audio', label: 'Audio' }, { id: 'about', label: 'About' }] as const;

function MenuHeader({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return <header className="menu-header"><button className="menu-icon-button" onClick={onBack} aria-label="Back to main menu"><ArrowLeft size={20} /></button><div><h1>{title}</h1><p>{description}</p></div></header>;
}

function Choices<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div className="menu-choices" role="group" aria-label={label}>{options.map(option => <button key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

function SettingRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <div className="menu-setting-row"><div><h3>{title}</h3>{description && <p>{description}</p>}</div><div className="menu-setting-control">{children}</div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button className="menu-toggle" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)}><span /><small>{checked ? 'On' : 'Off'}</small></button>;
}

export interface SettingsValues {
  matchFormat: '1v1' | '2v2';
  winScore: number;
  duration: 3 | 5 | 6;
  difficulty: AIDifficulty;
  tempo: number;
  modifier: LevelModifier;
  fov: number;
  landingRing: 'classic' | 'neon' | 'off';
  vfx: boolean;
  shake: boolean;
  callouts: boolean;
  muted: boolean;
  music: number;
  sfx: number;
}

export function GameSettings({ mode, values: v, onChange, onBack, onReset, onControls, initialTab = 'gameplay' }: { mode: GameMode; values: SettingsValues; onChange: (values: Partial<SettingsValues>) => void; onBack: () => void; onReset: () => void; onControls?: () => void; initialTab?: 'gameplay' | 'camera' | 'audio' }) {
  const [tab, setTab] = useState<'gameplay' | 'camera' | 'audio' | 'about'>(initialTab);
  const tabId = useId();
  const volleyball = mode !== 'obstacle_rush' && mode !== 'floor_is_lava';
  return <section className="game-menu settings-menu" aria-label="Game settings">
    <MenuHeader title="Settings" description="Make the game feel right for you." onBack={onBack} />
    <div className="menu-tabs" role="tablist" aria-label="Settings categories">
      {SETTINGS_TABS.map((item, index) => <button key={item.id} role="tab" id={`${tabId}-${item.id}`} aria-controls={`${tabId}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % SETTINGS_TABS.length : event.key === 'ArrowLeft' ? (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? SETTINGS_TABS.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        setTab(SETTINGS_TABS[next].id);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}>{item.label}</button>)}
    </div>
    <div className="menu-scroll">
      <div className="settings-content" role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`}>
        {tab === 'about' && <GameInfo />}
        {tab === 'gameplay' && <>
          <div className="menu-section-heading"><h2>Match preferences</h2><p>These choices apply to your next match.</p></div>
          <div className="menu-settings-card">
            {onControls && <SettingRow title="How to play" description="Review the controls whenever you need them."><button type="button" className="menu-primary" onClick={onControls}>View controls</button></SettingRow>}
            {volleyball ? <>
              <SettingRow title="Team size" description="Play solo or with a partner."><Choices label="Team size" value={v.matchFormat} options={[{ value: '1v1', label: '1 vs 1' }, { value: '2v2', label: '2 vs 2' }]} onChange={matchFormat => onChange({ matchFormat })} /></SettingRow>
              <SettingRow title="Winning score"><Choices label="Winning score" value={v.winScore} options={[5, 10, 15].map(value => ({ value, label: `${value} points` }))} onChange={winScore => onChange({ winScore })} /></SettingRow>
            </> : <SettingRow title="Match length"><Choices label="Match length" value={v.duration} options={([3, 5, 6] as const).map(value => ({ value, label: `${value} min` }))} onChange={duration => onChange({ duration })} /></SettingRow>}
            <SettingRow title="Difficulty" description="Choose how challenging the rivals are."><Choices label="Difficulty" value={v.difficulty} options={DIFFICULTY_LEVELS.map(d => ({ value: d.id, label: d.shortLabel }))} onChange={difficulty => onChange({ difficulty })} /></SettingRow>
            <SettingRow title="Game speed" description="100% is the standard pace."><Choices label="Game speed" value={v.tempo} options={[0.85, 1, 1.15, 1.3].map(value => ({ value, label: `${Math.round(value * 100)}%` }))} onChange={tempo => onChange({ tempo })} /></SettingRow>
            {volleyball && <SettingRow title="Court rules"><Choices label="Court rules" value={v.modifier} options={[{ value: 'none', label: 'Standard' }, { value: 'low_gravity', label: 'Low gravity' }, { value: 'big_ball', label: 'Big ball' }, { value: 'windy', label: 'Wind' }]} onChange={modifier => onChange({ modifier })} /></SettingRow>}
          </div>
        </>}
        {tab === 'camera' && <>
          <div className="menu-section-heading"><h2>View & movement</h2><p>The camera follows your player throughout the match.</p></div>
          <div className="menu-settings-card">
            <SettingRow title="Field of view" description="Choose a closer view or see more of the arena."><Choices label="Field of view" value={v.fov} options={[{ value: 40, label: 'Close' }, { value: 45, label: 'Standard' }, { value: 52, label: 'Wide' }]} onChange={fov => onChange({ fov })} /></SettingRow>
            {volleyball && <SettingRow title="Ball landing marker"><Choices label="Ball landing marker" value={v.landingRing} options={[{ value: 'classic', label: 'Classic' }, { value: 'neon', label: 'Bright' }, { value: 'off', label: 'Hidden' }]} onChange={landingRing => onChange({ landingRing })} /></SettingRow>}
            <SettingRow title="Impact effects" description="Sparks and trails on hits."><Toggle label="Impact effects" checked={v.vfx} onChange={vfx => onChange({ vfx })} /></SettingRow>
            <SettingRow title="Camera shake" description="Movement on strong impacts."><Toggle label="Camera shake" checked={v.shake} onChange={shake => onChange({ shake })} /></SettingRow>
            {mode !== 'obstacle_rush' && <SettingRow title="Match callouts" description="Brief messages during play."><Toggle label="Match callouts" checked={v.callouts} onChange={callouts => onChange({ callouts })} /></SettingRow>}
          </div>
        </>}
        {tab === 'audio' && <>
          <div className="menu-section-heading"><h2>Sound</h2><p>Set the music and effects volume.</p></div>
          <div className="menu-settings-card">
            <SettingRow title="Sound"><Toggle label="Sound" checked={!v.muted} onChange={enabled => onChange({ muted: !enabled })} /></SettingRow>
            {(['music', 'sfx'] as const).map(key => <SettingRow key={key} title={key === 'music' ? 'Music' : 'Sound effects'}><label className="menu-range"><input aria-label={key === 'music' ? 'Music volume' : 'Sound effects volume'} type="range" min={0} max={100} value={v[key]} disabled={v.muted} onChange={event => onChange({ [key]: Number(event.target.value) })} /><output>{v[key]}%</output></label></SettingRow>)}
          </div>
        </>}
      </div>
    </div>
    <footer className="menu-footer"><button className="menu-text-button" onClick={onReset}><RotateCcw size={15} />Reset defaults</button><button className="menu-primary" onClick={onBack}>Done<Check size={17} /></button></footer>
  </section>;
}

export interface MenuMap { id: string; name: string; subtitle: string; preview: React.ReactNode }
interface ModesProps {
  mode: GameMode;
  maps: MenuMap[];
  selectedMap: string;
  difficulty: AIDifficulty;
  duration: 3 | 5 | 6;
  winScore: number;
  matchFormat: '1v1' | '2v2';
  onMode: (mode: GameMode) => void;
  onMap: (id: string) => void;
  onDifficulty: (difficulty: AIDifficulty) => void;
  onDuration: (duration: 3 | 5 | 6) => void;
  onWinScore: (score: number) => void;
  onFormat: (format: '1v1' | '2v2') => void;
  onBack: () => void;
  onPlay: () => void;
  ballSkinControl?: React.ReactNode;
  autoMap?: boolean;
  onAutoMap?: (enabled: boolean) => void;
}

export function ModesAndMaps(props: ModesProps) {
  const modeInfo = SUB_GAMES_LIST.find(mode => mode.id === props.mode);
  const map = props.maps.find(item => item.id === props.selectedMap);
  const timed = props.mode === 'obstacle_rush' || props.mode === 'floor_is_lava';
  return <section className="game-menu modes-menu" aria-label="Modes and maps">
    <MenuHeader title="Modes & maps" description="Choose your game, find an arena, and jump in." onBack={props.onBack} />
    <div className="modes-layout">
      <nav className="mode-list" aria-label="Game modes">{SUB_GAMES_LIST.filter(mode => mode.id !== 'survival' && mode.id !== 'hoop_volley').map(mode => <button key={mode.id} aria-pressed={props.mode === mode.id} onClick={() => props.onMode(mode.id)}><span>{mode.tabLabel}</span><ChevronRight size={16} /></button>)}</nav>
      <div className="map-selection">
        <div className="menu-section-heading map-heading"><div><h2>{modeInfo?.tabLabel ?? 'Choose an arena'}</h2><p>{timed ? 'Pick the setting for your next match.' : props.autoMap ? 'A random court every match.' : 'Choose a court for your next rally.'}</p></div>{!timed && props.onAutoMap && <button className="map-auto-toggle" aria-pressed={props.autoMap} onClick={() => props.onAutoMap?.(!props.autoMap)}>Auto <span>{props.autoMap ? 'On' : 'Off'}</span></button>}</div>
        <div className="map-grid">{props.maps.map(item => <button className="menu-map-card" key={item.id} aria-pressed={!props.autoMap && props.selectedMap === item.id} onClick={() => props.onMap(item.id)}>
          <div className="menu-map-image">{item.preview}</div>
          <div className="menu-map-caption"><div><h3>{item.name}</h3><p>{item.subtitle}</p></div><span className="menu-map-check">{props.selectedMap === item.id && <Check size={14} />}</span></div>
        </button>)}</div>
      </div>
      <aside className="match-setup" aria-label="Match setup">
        <div className="menu-section-heading"><h2>Your match</h2><p>{!timed && props.autoMap ? 'Random court' : map?.name ?? 'Select a map'}</p></div>
        <div className="match-setup-fields">
          {timed ? <div><h3>Match length</h3><Choices label="Match length" value={props.duration} options={([3, 5, 6] as const).map(value => ({ value, label: `${value} min` }))} onChange={props.onDuration} /></div> : <>
            <div><h3>Team size</h3><Choices label="Team size" value={props.matchFormat} options={[{ value: '1v1', label: '1 vs 1' }, { value: '2v2', label: '2 vs 2' }]} onChange={props.onFormat} /></div>
            <div><h3>Winning score</h3><Choices label="Winning score" value={props.winScore} options={[5, 10, 15].map(value => ({ value, label: `${value} pts` }))} onChange={props.onWinScore} /></div>
          </>}
          <div><label htmlFor="menu-difficulty">Difficulty</label><select id="menu-difficulty" value={props.difficulty} onChange={event => props.onDifficulty(event.target.value as AIDifficulty)}>{DIFFICULTY_LEVELS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
          {props.ballSkinControl}
        </div>
        <button className="menu-primary menu-play" onClick={props.onPlay} disabled={!map}>Play match<ArrowRight size={18} /></button>
      </aside>
    </div>
  </section>;
}
