import React, { useEffect, useRef } from 'react';
import { ArrowRight, Home, Pause, Play, RotateCcw, User } from 'lucide-react';
import type { GameMode, MatchStats } from '../types/game';
import { gunStandings, nukeStandings } from './matchStats';
import './matchPanels.css';

function usePanelFocus(onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    panel.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escape.current) { event.preventDefault(); escape.current(); }
      if (event.key !== 'Tab') return;
      const buttons = [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener('keydown', onKey);
    return () => { panel.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return ref;
}

interface PauseProps {
  mapName: string;
  onResume: () => void;
  onMenu: () => void;
  onControls?: () => void;
}

export function PausePanel(props: PauseProps) {
  const ref = usePanelFocus(props.onResume);
  return <div className="match-overlay match-overlay--pause">
    <div className="match-panel match-panel--pause" ref={ref} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="pause-emblem" aria-hidden="true"><Pause size={26} strokeWidth={3} /></div>
      <header className="pause-heading">
        <h1 id="pause-title">Paused</h1>
        <p className="match-kicker">{props.mapName}</p>
      </header>
      <div className="match-pause-actions">
        <button className="match-button match-button--primary" onClick={props.onResume}><Play size={19} />Resume<ArrowRight size={19} /></button>
        <button className="match-button match-button--quiet" onClick={props.onMenu}><Home size={18} />Main menu</button>
        {props.onControls && <button className="match-button match-button--quiet" onClick={props.onControls}>How to play</button>}
      </div>
    </div>
  </div>;
}

interface ResultsProps {
  stats: MatchStats;
  mode: GameMode;
  playerName: string;
  opponentName: string;
  playerPortrait?: React.ReactNode;
  opponentPortrait?: React.ReactNode;
  playerPartner?: { name: string; portrait: React.ReactNode };
  opponentPartner?: { name: string; portrait: React.ReactNode };
  onRestart: () => void;
  onMenu: () => void;
  roomCode?: string;
  leaving?: boolean;
}

export function MatchResults(props: ResultsProps) {
  const ref = usePanelFocus();
  const { stats } = props;
  const won = stats.matchWinner === 'player';
  const arena = props.mode === 'obstacle_rush';
  const nuke = props.mode === 'floor_is_lava';
  const nukeSorted = nukeStandings(stats);
  const nukePlayer = nukeSorted.find(athlete => athlete.isPlayer);
  const sorted = gunStandings(stats);
  const player = sorted.find(fighter => fighter.isPlayer);
  const rival = (arena ? sorted : nukeSorted).find(athlete => !athlete.isPlayer);
  const rivalName = rival?.name ?? props.opponentName;
  const rank = sorted.findIndex(fighter => fighter.isPlayer) + 1;
  const score = arena ? player?.kills ?? stats.playerScore : stats.playerScore;
  const seconds = Math.max(0, Math.round(stats.raceTimeSec ?? 0));
  const metrics = arena ? [['Kills', score], ['Deaths', player?.deaths ?? 0], ['K / D', (score / Math.max(1, player?.deaths ?? 0)).toFixed(2)]] : nuke ? [['Knockouts', nukePlayer?.kills ?? 0], ['Hits', nukePlayer?.hits ?? 0], ['Catches', nukePlayer?.catches ?? 0]] : [['Best rally', stats.bestRally], ['Perfect spikes', stats.perfectSpikes], ['Partner sets', stats.partnerSets]];
  return <div className={'match-overlay match-overlay--results ' + (nuke ? 'match-overlay--nuke ' : '') + (won ? 'result-victory' : 'result-defeat')}>
    <div className="match-panel match-panel--results" ref={ref} role="dialog" aria-modal="true" aria-labelledby="results-title">
      <header className="result-header">
        <span className="result-eyebrow">{arena ? 'Gun Fight' : nuke ? 'Nuke' : 'Volleyball'} · Match complete</span>
        <h1 id="results-title">{won ? 'Victory' : 'Defeat'}</h1>
        {props.roomCode && <p>Still in room {props.roomCode}. Leave only when you choose.</p>}
        <p>{nuke ? stats.lastPointReason : won ? props.playerName + (props.playerPartner ? "'s team wins" : ' wins') : rivalName + (props.opponentPartner ? "'s team wins" : ' wins')}<span aria-label="Match duration">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></p>
      </header>
      <div className="result-content">
        <div className="result-matchup">
        <section className="result-personal" aria-label="Your result">
          <div className="result-avatar">{props.playerPortrait ?? <User size={42} />}</div>
          <h2>{props.playerName}</h2>
          <span className="result-side-label">YOU</span>
          <strong className="result-score">{arena ? score : nuke ? nukePlayer?.roundWins ?? stats.playerScore : score}<small>{arena ? 'kills' : nuke ? 'Rounds survived' : 'points'}</small></strong>
          {arena && rank > 0 && <p className="result-rank">Rank #{rank}<span>{player?.deaths ?? 0} deaths</span></p>}
          {props.playerPartner && <div className="result-partner">{props.playerPartner.portrait}<span>{props.playerPartner.name}<small>Your partner</small></span></div>}
        </section>
        <span className="result-versus" aria-hidden="true">VS</span>
        <section className="result-personal result-opponent" aria-label="Opponent result"><div className="result-avatar">{props.opponentPortrait ?? <User size={42} />}</div><h2>{rivalName}</h2><span className="result-side-label">{arena || nuke ? 'TOP RIVAL' : 'OPPONENT'}</span><strong className="result-score">{rival ? arena ? rival.kills : 'roundWins' in rival ? rival.roundWins : stats.aiScore : stats.aiScore}<small>{arena ? 'kills' : nuke ? 'Rounds survived' : 'points'}</small></strong>{props.opponentPartner && <div className="result-partner">{props.opponentPartner.portrait}<span>{props.opponentPartner.name}<small>Opponent partner</small></span></div>}</section>
        </div>
        <section className="result-metrics" aria-label="Your match statistics">{metrics.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</section>
        {arena && sorted.length > 0 ? <section className="result-roster" aria-label="Final standings">
          <div className="result-roster-label"><span>Final standings</span><span>K / D</span></div>
          <ol>{sorted.map((fighter, index) => <li key={fighter.id} className={fighter.isPlayer ? 'result-you' : ''}>
            <span className="result-place">{index + 1}</span><span className="result-name">{fighter.isPlayer ? 'You' : fighter.name}</span><strong>{fighter.kills}<small> / {fighter.deaths}</small></strong>
          </li>)}</ol>
        </section> : nuke && nukeSorted.length ? <section className="result-roster" aria-label="Nuke standings">
          <div className="result-roster-label"><span>{won ? 'Final standings' : 'Standings at elimination'}</span><span>Rounds / KOs</span></div>
          <ol>{nukeSorted.map((athlete, index) => <li key={athlete.id} className={athlete.isPlayer ? 'result-you' : ''}><span className="result-place">{index + 1}</span><span className="result-name">{athlete.isPlayer ? props.playerName : athlete.name}</span><strong>{athlete.roundWins}<small> / {athlete.kills}</small></strong></li>)}</ol>
        </section> : null}
      </div>
      <footer className="match-results-actions">
        <button className="match-button match-button--primary" disabled={props.leaving} onClick={props.onRestart}><RotateCcw size={18} />{props.roomCode ? 'Back to room' : 'Play again'}</button>
        <button className="match-button" disabled={props.leaving} onClick={props.onMenu}><Home size={18} />{props.leaving ? 'Leaving…' : props.roomCode ? 'Leave room' : 'Main menu'}</button>
      </footer>
    </div>
  </div>;
}
