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
    { title: 'Move into position', gesture: 'drag', controls: ['move'], phone: 'Drag the visible left joystick to move. Find a clear view of a nearby rival.', desktop: 'Move with WASD or arrow keys. Find a clear view of a nearby rival.' },
    { title: 'Aim and fire', gesture: 'tap', controls: ['fire'], phone: 'Keep your rival near the crosshair. Hold the Fire button to shoot, and release to stop.', desktop: 'Keep your rival near the crosshair. Hold F or the left mouse button to shoot.' },
    { title: 'Refill your magazine', gesture: 'tap', controls: ['reload'], phone: 'Tap Reload to refill early. An empty magazine reloads automatically. You can keep moving, but cannot fire until the reload finishes.', desktop: 'Press R to reload early. An empty magazine reloads automatically. Keep moving into cover until the reload finishes.' },
    { title: 'Keep moving', gesture: 'tap', controls: ['jump'], phone: 'Tap Jump to jump. Use cover while reloading.', desktop: 'Press Space to jump. Use cover while reloading.' },
  ] },
  nuke: { name: 'Nuke', goal: 'Stay alive, dodge incoming balls and win the final duel.', steps: [
    { title: 'Move and collect', gesture: 'drag', controls: ['move'], phone: 'Drag the visible left joystick to move. Nearby loose balls are picked up automatically.', desktop: 'Move with WASD or arrow keys. Nearby loose balls are picked up automatically.' },
    { title: 'Aim and throw', gesture: 'tap', controls: ['throw', 'jump'], phone: 'Drag the right side to aim. Tap Throw or single-tap the right side to throw. Tap Jump to jump.', desktop: 'Move the mouse to aim. Left-click to throw along the crosshair.' },
    { title: 'Dodge or catch', gesture: 'tap', controls: ['dodge'], phone: 'Tap Dodge to dodge. Use the joystick to choose your direction. A well-timed dodge can catch a nearby ball.', desktop: 'Right-click or press Shift to dodge. Use movement keys to choose the direction. Time it near an incoming ball to catch.' },
  ] },
  volleyball: { name: 'Volleyball', goal: 'Keep the ball off your floor and score on the rival court.', steps: [
    { title: 'Get under the ball', gesture: 'drag', controls: ['move'], phone: 'Drag the visible left joystick to move. Follow the landing marker to reach the next ball.', desktop: 'Move with WASD or arrow keys. Follow the landing marker.' },
    { title: 'Choose your shot', gesture: 'swipe', controls: ['spike'], phone: 'Aim with the joystick or drag the right side, then tap Hit / Jump to serve or spike.', desktop: 'Drag and release on the court to direct your shot. You can also use movement keys with Space to serve or spike.' },
    { title: 'Jump and save', gesture: 'double', controls: ['dive', 'lift', 'super', 'spike'], phone: 'Tap Dive to save a low ball, Set to lift it, or Power for a charged spike. Hit / Jump jumps for a spike. Only hit when the ball is within reach.', desktop: 'Space serves or jump-spikes. E requests a power spike. Shift dives and Alt lifts the ball.' },
  ] },
} as const;
