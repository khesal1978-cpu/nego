import type { GameMode } from '../types/game';

export type TutorialFamily = 'gun' | 'nuke' | 'volleyball';
export const tutorialFamily = (mode: GameMode): TutorialFamily => mode === 'obstacle_rush' ? 'gun' : mode === 'floor_is_lava' ? 'nuke' : 'volleyball';
const storageKey = 'sixzun-controls-learned-v1';
const sessionSeen = new Set<TutorialFamily>();
export function readTutorialSeen(): TutorialFamily[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) for (const item of saved) if (['gun', 'nuke', 'volleyball'].includes(item)) sessionSeen.add(item);
  } catch { /* Memory still prevents repeat prompts when storage is unavailable. */ }
  return [...sessionSeen];
}
export function rememberTutorial(family: TutorialFamily) {
  sessionSeen.add(family);
  const seen = readTutorialSeen();
  try { localStorage.setItem(storageKey, JSON.stringify(seen)); } catch { /* Storage is optional. */ }
  return seen;
}
export const GAME_TUTORIALS = {
  gun: { name: 'Gun Fight', goal: 'Score the most eliminations before time runs out.', steps: [
    { title: 'Move into position', gesture: 'drag', phone: 'Drag the left side to move. Find a clear view of a nearby rival.', desktop: 'Move with WASD or arrow keys. Find a clear view of a nearby rival.' },
    { title: 'Firing is automatic', gesture: 'auto', phone: 'Your character aims and fires on its own when a rival is visible and in range. No fire button or tap is needed.', desktop: 'Your character fires automatically at a visible rival in range. F also allows a manual shot.' },
    { title: 'Keep moving', gesture: 'double', phone: 'Double-tap the right side to jump. Use cover while reloading.', desktop: 'Press Space to jump. Use cover while reloading.' },
  ] },
  nuke: { name: 'Nuke', goal: 'Stay alive, dodge incoming balls and win the final duel.', steps: [
    { title: 'Move and collect', gesture: 'drag', phone: 'Drag the left side to move. Nearby loose balls are picked up automatically.', desktop: 'Move with WASD or arrow keys. Nearby loose balls are picked up automatically.' },
    { title: 'Aim and throw', gesture: 'tap', phone: 'Drag the right side to aim. Single-tap the right side to throw along the crosshair.', desktop: 'Move the mouse to aim. Left-click to throw along the crosshair.' },
    { title: 'Dodge or catch', gesture: 'double', phone: 'Double-tap the right side to dodge. Use the left stick to choose your direction. A well-timed dodge can catch a nearby ball.', desktop: 'Right-click or press Shift to dodge. Use movement keys to choose the direction. Time it near an incoming ball to catch.' },
  ] },
  volleyball: { name: 'Volleyball', goal: 'Keep the ball off your floor and score on the rival court.', steps: [
    { title: 'Get under the ball', gesture: 'drag', phone: 'Drag the left side to move. Follow the landing marker to reach the next ball.', desktop: 'Move with WASD or arrow keys. Follow the landing marker.' },
    { title: 'Choose your shot', gesture: 'swipe', phone: 'Swipe the right side in the direction you want the ball to travel, then release to hit. Swipe up toward the rival court.', desktop: 'Drag and release on the court to direct your shot. You can also use movement keys with Space to serve or spike.' },
    { title: 'Jump and save', gesture: 'double', phone: 'Tap the right side to serve or jump-spike. Double-tap for a stronger spike or dive save. Only hit when the ball is within reach.', desktop: 'Space serves or jump-spikes. E requests a power spike. Shift dives and Alt lifts the ball.' },
  ] },
} as const;
