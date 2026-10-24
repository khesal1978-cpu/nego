import React, { memo, useEffect, useState } from 'react';
import { CRAYON_CHARACTERS } from '../types/game';
import { LoadingCharacters3D } from './LoadingCharacters3D';
import './loadingScreen.css';

export const LOADING_SCENES = [
  { id: 'squad', label: 'The crew', kicker: 'A little attitude. A lot of game.', title: ['SMALL SQUAD.', 'BIG ENERGY.'], note: 'Your next great round starts here.', tip: 'Move smart. Stay in the game.', characters: ['green_hoodie', 'gold_king', 'pink_visor'] },
  { id: 'nuke', label: 'Nuke', kicker: 'Dodge. Catch. Throw.', title: ['CATCH THE', 'CHAOS.'], note: 'One ball can change everything.', tip: 'Nuke: auto-pickup · drag right to aim · tap to throw.', characters: ['purple_shades', 'red_cap', 'astro_bean'] },
  { id: 'volley', label: 'Volleyball', kicker: 'Good friends. Great rallies.', title: ['SET IT UP.', 'SEND IT.'], note: 'Make the next point yours.', tip: 'Time your jump and meet the ball at its highest point.', characters: ['blue_sporty', 'strawberry_kid'] },
  { id: 'jungle', label: 'Jungle', kicker: 'Welcome to the wild side.', title: ['STAY QUICK.', 'STAND TALL.'], note: 'Big adventures. Little legends.', tip: 'Use cover and keep moving between shots.', characters: ['pirate_capt', 'pineapple_king', 'burger_chef'] },
  { id: 'gun', label: 'Gun Fight', kicker: 'Cool under pressure.', title: ['LOCKED IN.', 'LET’S PLAY.'], note: 'A little swagger before the action.', tip: 'Gun Fight fires automatically at visible rivals. Keep moving and use cover.', characters: ['smokey_jester'] },
] as const;

function firstScene() {
  try {
    const previous = Number(sessionStorage.getItem('sixzun-loading-scene') ?? -1);
    return Number.isSafeInteger(previous) && previous >= -1 ? (previous + 1) % LOADING_SCENES.length : 0;
  }
  catch { return 0; }
}

const LoadingScene = memo(function LoadingScene({ index, onReady }: { index: number; onReady: () => void }) {
  const scene = LOADING_SCENES[index];
  return <div className={`loader-stage loader-stage--${scene.id}`} aria-label={`${scene.label} character scene`}>
    <div className="loader-orbit loader-orbit--one" /><div className="loader-orbit loader-orbit--two" />
    <div className="loader-floor" />
    <span className="loader-star loader-star--one" aria-hidden="true">✦</span><span className="loader-star loader-star--two" aria-hidden="true">✧</span>
    {scene.id === 'nuke' && <><div className="loader-ball loader-ball--nuke" /><div className="loader-ball-trail" /></>}
    {scene.id === 'volley' && <><div className="loader-net" /><div className="loader-ball loader-ball--volley" /></>}
    {scene.id === 'jungle' && <><div className="loader-palm loader-palm--left"><i /><i /><i /></div><div className="loader-palm loader-palm--right"><i /><i /><i /></div></>}
    {scene.id === 'gun' && <><div className="loader-hero-glow" aria-hidden="true" /><div className="loader-smoke" aria-hidden="true"><i /><i /><i /></div></>}
    <LoadingCharacters3D characters={scene.characters} onReady={onReady} presentation={scene.id === 'gun' ? 'gun' : 'cast'} />
    <div className="loader-character-names">{scene.characters.map(id => <span key={id}>{CRAYON_CHARACTERS.find(character => character.id === id)!.name}</span>)}</div>
    <div className="loader-stage-badge"><span>{scene.id === 'gun' ? 'READY. AIM. PLAY.' : 'PLAY YOUR WAY'}</span></div>
  </div>;
});

export function LoadingScreen({ progress, onReady, initialScene }: { progress: number; onReady: () => void; initialScene?: number }) {
  const [index, setIndex] = useState(() => initialScene !== undefined && Number.isInteger(initialScene) ? Math.max(0, Math.min(LOADING_SCENES.length - 1, initialScene)) : firstScene());
  useEffect(() => {
    try { sessionStorage.setItem('sixzun-loading-scene', String(index)); } catch { /* Optional storage. */ }
  }, [index]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => setIndex(value => (value + 1) % LOADING_SCENES.length), 2400);
    return () => window.clearInterval(interval);
  }, []);
  const scene = LOADING_SCENES[index];
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  return <section className={`loading-screen loading-screen--${scene.id}${safeProgress >= 100 ? ' loading-screen--complete' : ''}`} aria-label="Bonk Up loading screen">
    <div className="loader-grain" aria-hidden="true" />
    <header className="loader-header"><span className="loader-wordmark">Bonk <span>Up</span><i /></span><span className="loader-edition">LITTLE LEGENDS. BIG GAMES.</span><span className="loader-scene-count">{String(index + 1).padStart(2, '0')}<span> / {String(LOADING_SCENES.length).padStart(2, '0')}</span></span></header>
    <main className="loader-main">
      <div className="loader-copy" key={scene.id}>
        <p className="loader-kicker"><span />{scene.kicker}</p>
        <h1>{scene.title[0]}<br /><em>{scene.title[1]}</em></h1>
        <p className="loader-note">{scene.note}</p>
        <nav className="loader-scenes" aria-label="Loading designs">
          {LOADING_SCENES.map((item, i) => <button key={item.id} type="button" onClick={() => setIndex(i)} aria-label={`Show ${item.label} loading design`} aria-pressed={index === i}><span />{index === i && <small>{item.label}</small>}</button>)}
        </nav>
      </div>
      <LoadingScene index={index} onReady={onReady} />
    </main>
    <footer className="loader-footer">
      <div className="loader-progress-area"><div className="loader-progress-label"><span>{safeProgress >= 100 ? 'READY TO PLAY' : 'GETTING READY'}<i className="loader-dots">...</i></span><span>Bonk Up</span></div><div className="loader-progress" role="progressbar" aria-label="Startup progress" aria-valuenow={Math.round(safeProgress)} aria-valuemin={0} aria-valuemax={100}><div style={{ transform: `scaleX(${safeProgress / 100})` }} /></div><p className="loader-tip">{scene.tip}</p></div>
      <span className="loader-auto" role="status">{safeProgress >= 100 ? 'LET’S GO' : 'OPENING AUTOMATICALLY'}<i aria-hidden="true" /></span>
    </footer>
  </section>;
}
