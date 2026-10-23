import { BALL_SKINS, CHARACTER_FACES, CHARACTER_OUTFITS, COURT_THEMES, CRAYON_CHARACTERS, DIFFICULTY_LEVELS, FLOOR_IS_LAVA_MAPS, HEAD_SHAPES, OBSTACLE_RUSH_MAPS, SUB_GAMES_LIST, WORLD_TOUR_LEVELS } from './types/game';
import type { AIDifficulty, BallSkinId, CameraPreset, CharacterId, CourtThemeId, FaceId, FloorIsLavaMapId, GameMode, HeadShape, ObstacleRushMapId, OutfitId } from './types/game';

export interface PlayerPreferences {
  gameMode: GameMode; selectedCharId: CharacterId; selectedOutfitId: OutfitId;
  selectedFaceId: FaceId; selectedHeadShape: HeadShape;
  selectedThemeId: CourtThemeId; selectedRushMapId: ObstacleRushMapId; selectedLavaMapId: FloorIsLavaMapId;
  difficulty: AIDifficulty; cameraPreset: CameraPreset; winScore: number; rushTimerMinutes: 3 | 5 | 6;
  matchFormat: '1v1' | '2v2'; ballSkinSetting: BallSkinId | 'auto';
  gameSpeedMultiplier: number; cameraFov: number; landingCircleStyle: 'classic' | 'neon' | 'off';
  enableVfx: boolean; enableScreenShake: boolean; showCallouts: boolean;
  muted: boolean; musicVol: number; sfxVol: number;
}
export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  gameMode: 'obstacle_rush', selectedCharId: 'green_hoodie', selectedOutfitId: 'crown_hoodie', selectedFaceId: 'happy_laugh', selectedHeadShape: 'round',
  selectedThemeId: 'pirate_cove', selectedRushMapId: 'sky_carnival', selectedLavaMapId: 'volcano_summit',
  difficulty: 'breezy', cameraPreset: 'dynamic_follow', winScore: 5, rushTimerMinutes: 3, matchFormat: '2v2', ballSkinSetting: 'auto',
  gameSpeedMultiplier: 1, cameraFov: 45, landingCircleStyle: 'classic', enableVfx: true, enableScreenShake: true, showCallouts: true,
  muted: false, musicVol: 30, sfxVol: 80,
};
const choices: Partial<Record<keyof PlayerPreferences, readonly unknown[]>> = {
  gameMode: SUB_GAMES_LIST.map(x => x.id), selectedCharId: CRAYON_CHARACTERS.map(x => x.id),
  selectedOutfitId: CHARACTER_OUTFITS.map(x => x.id), selectedFaceId: CHARACTER_FACES.map(x => x.id), selectedHeadShape: HEAD_SHAPES.map(x => x.id),
  selectedThemeId: COURT_THEMES.map(x => x.id), selectedRushMapId: OBSTACLE_RUSH_MAPS.map(x => x.id), selectedLavaMapId: FLOOR_IS_LAVA_MAPS.map(x => x.id),
  difficulty: DIFFICULTY_LEVELS.map(x => x.id), cameraPreset: ['portrait_court', 'dynamic_follow', 'side_sketch'],
  rushTimerMinutes: [3, 5, 6], matchFormat: ['1v1', '2v2'], ballSkinSetting: ['auto', ...BALL_SKINS.map(x => x.id)], landingCircleStyle: ['classic', 'neon', 'off'],
};
const ranges: Partial<Record<keyof PlayerPreferences, [number, number]>> = { winScore: [3, 25], gameSpeedMultiplier: [.5, 2.5], cameraFov: [30, 75], musicVol: [0, 100], sfxVol: [0, 100] };
const storageKey = 'sixzun-player-preferences-v1';
export function normalizePlayerPreferences(input: unknown): PlayerPreferences {
  const result = { ...DEFAULT_PLAYER_PREFERENCES };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(result) as (keyof PlayerPreferences)[]) {
    const candidate = value[key], range = ranges[key];
    if (choices[key]?.includes(candidate) || (typeof result[key] === 'boolean' && typeof candidate === 'boolean')) {
      (result as unknown as Record<string, unknown>)[key] = candidate;
    } else if (range && typeof candidate === 'number' && Number.isFinite(candidate)) {
      (result as unknown as Record<string, unknown>)[key] = Math.min(range[1], Math.max(range[0], candidate));
    }
  }
  return result;
}
export function readPlayerPreferences() {
  try { return normalizePlayerPreferences(JSON.parse(localStorage.getItem(storageKey) || 'null')); }
  catch { return { ...DEFAULT_PLAYER_PREFERENCES }; }
}
export function savePlayerPreferences(value: PlayerPreferences) {
  try { localStorage.setItem(storageKey, JSON.stringify(normalizePlayerPreferences(value))); } catch { /* Private mode can disallow saves. */ }
}
export function readTourProgress() {
  try { const value = Number(localStorage.getItem('volley_rally_unlocked_level')); return Number.isInteger(value) && value >= 1 ? Math.min(WORLD_TOUR_LEVELS.length, value) : 3; }
  catch { return 3; }
}
