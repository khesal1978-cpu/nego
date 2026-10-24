import React, { useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { ObstacleRushHudState } from './ObstacleRushCanvas';
import './gunFightHud.css';

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

