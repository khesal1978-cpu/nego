import type { MatchStats } from '../types/game';

export function recordRally(stats: MatchStats, rally: number, perfect: boolean, charge: number, usedSuper: boolean, partnerSet: boolean): MatchStats {
  if (stats.matchWinner) return stats;
  return { ...stats, currentRally: rally, bestRally: Math.max(stats.bestRally, rally), perfectSpikes: stats.perfectSpikes + Number(perfect), partnerSets: stats.partnerSets + Number(partnerSet), superCharge: usedSuper ? 0 : Math.min(100, stats.superCharge + charge) };
}

// Count active wall-clock time, independent of game speed and excluded pauses.
export function createMatchClock() {
  let elapsed = 0;
  let started: number | null = null;
  return {
    reset() { elapsed = 0; started = null; },
    resume(now: number) { if (started === null) started = now; },
    seconds(now: number) { return (elapsed + (started === null ? 0 : Math.max(0, now - started))) / 1000; },
    pause(now: number) { if (started !== null) { elapsed += Math.max(0, now - started); started = null; } },
  };
}

export const gunStandings = (stats: MatchStats) => [...(stats.arenaStandings ?? [])].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
export const nukeStandings = (stats: MatchStats) => [...(stats.nukeStandings ?? [])].sort((a, b) => Number(b.alive) - Number(a.alive) || b.roundWins - a.roundWins || b.kills - a.kills || b.hp - a.hp);
