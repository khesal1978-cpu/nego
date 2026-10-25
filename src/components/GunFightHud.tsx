import React, { useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { ObstacleRushHudState } from './ObstacleRushCanvas';
import './gunFightHud.css';

function GunWeaponIcon({ weapon }: { weapon?: string }) {
  return <svg viewBox="0 0 56 28" fill="currentColor" aria-hidden="true">
    {weapon === 'SHOTGUN' ? <path d="M3 12h10l4-3h30v3h7v3H26l-8 3-4 6H9l2-7H3Zm17 4h15v4H22Z" /> : weapon === 'FIRE' ? <><path d="M3 11h11l4-4h19v4h15v6H27l-6 7h-6l1-9H3Z" /><rect x="27" y="18" width="17" height="7" rx="3" /></> : <path d="M2 12h9l4-4h21V6h5v4h11v4H35l-4 4 3 7h-7l-4-8h-5l-5 8H8l3-11H2Zm17 4h4v5h-6Z" />}
  </svg>;
}

export function GunFightAmmo({ hud }: { hud: ObstacleRushHudState }) {
  if (hud.ammo === undefined || !hud.magazineSize || (hud.respawnSec ?? 0) > 0) return null;
  const remaining = hud.reloadRemaining ?? 0;
  const progress = remaining > 0 ? 1 - remaining / (hud.reloadDuration || 1) : 1;
  const assault = hud.weaponName === 'ASSAULT';
  const empty = assault && hud.ammo === 0 && (hud.reserveAmmo ?? 0) === 0;
  return <div className="gun-ammo" role="group" title="R / Reload button to reload" aria-label={`${hud.weaponName}, ${hud.ammo} loaded, ${assault ? `${hud.reserveAmmo ?? 0} reserve` : 'unlimited reserve'}${remaining > 0 ? ', reloading' : ''}`} data-reloading={remaining > 0} data-empty={empty}>
    <GunWeaponIcon weapon={hud.weaponName} />
    <strong>{hud.ammo}<small> / {assault ? hud.reserveAmmo ?? 0 : '∞'}</small></strong>
    <span>{remaining > 0 ? <>RELOAD <em>{remaining.toFixed(1)}s</em></> : empty ? 'FIND AMMO' : <>{hud.weaponName}{!assault && <em>{Math.ceil(hud.weaponTimerSec ?? 0)}s</em>}</>}</span>
    {remaining > 0 && <div className="gun-ammo-track" role="progressbar" aria-label="Reload progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress * 100}%` }} /></div>}
  </div>;
}

export function GunFightScore({ hud }: { hud: ObstacleRushHudState }) {
  const seconds = Math.max(0, Math.ceil(hud.timeRemainingSec));
  return (
    <div className="gun-score" aria-label="Match time">
      <Clock3 size={13} aria-hidden="true" />
      <span className={seconds <= 30 ? 'gun-score-urgent' : ''}>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
    </div>
  );
}

export function GunFightKillNotice({ kills }: { kills: number }) {
  const previousKills = useRef(kills);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const earnedKill = kills > previousKills.current;
    previousKills.current = kills;
    setVisible(earnedKill);
    if (!earnedKill) return;
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, [kills]);

  return visible ? (
    <div key={kills} className="gun-kill-notice" role="status">
      <span>{kills} {kills === 1 ? 'Kill' : 'Kills'}</span>
    </div>
  ) : null;
}

