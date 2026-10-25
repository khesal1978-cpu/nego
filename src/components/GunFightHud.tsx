import React, { useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { ObstacleRushHudState } from './ObstacleRushCanvas';
import './gunFightHud.css';
import { TouchControlIcon } from './TouchControlIcon';

export function GunFightAmmo({ hud }: { hud: ObstacleRushHudState }) {
  if (hud.ammo === undefined || !hud.magazineSize || (hud.respawnSec ?? 0) > 0) return null;
  const remaining = hud.reloadRemaining ?? 0;
  const progress = remaining > 0 ? 1 - remaining / (hud.reloadDuration || 1) : 1;
  return <div className="gun-ammo" role="group" aria-label={`${hud.weaponName}, ${hud.ammo} of ${hud.magazineSize} rounds${remaining > 0 ? ', reloading' : ''}`} data-reloading={remaining > 0}>
    <div className="gun-ammo-count"><TouchControlIcon action="fire" /><strong>{hud.ammo}<small> / {hud.magazineSize}</small></strong><span>{hud.weaponName}</span></div>
    <div className="gun-ammo-status">{remaining > 0 ? <><TouchControlIcon action="reload" /><span>Reloading · {remaining.toFixed(1)}s</span></> : <><span>Unlimited reserve</span><kbd>R · Reload</kbd></>}</div>
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

