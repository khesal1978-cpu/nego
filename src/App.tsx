import { readPlayerPreferences, savePlayerPreferences, readTourProgress } from './playerPreferences';
import { NameEntry } from './components/NameEntry';
import { isVolleyballMode } from './network/customModes';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Trophy,
  Pause,
  Home,
  ChevronLeft,
  ChevronRight,
  Users,
  User,
  Settings,
  Check,
  Smile,
  Shirt,
  Skull,
  Wrench,
  Pencil,
  Camera,
  Zap,
  Flag,
  Flame,
  Mic,
  MicOff,
  Headphones,
  Copy,
  Radio,
  Heart,
  ArrowRight,
  Plus,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { FullscreenControl } from './components/FullscreenControl';
import { GameTutorial } from './components/GameTutorial';
import { readTutorialSeen, rememberTutorial, tutorialFamily } from './components/gameTutorials';
import { CharacterPreview3D } from './components/CharacterPreview3D';
import { VoiceMicControl } from './components/VoiceMicControl';
import { LandscapePrompt } from './components/LandscapePrompt';
import { LoadingScreen } from './components/LoadingScreen';
import { VolleyballCanvas } from './components/VolleyballCanvas';
import { GunFightScore } from './components/GunFightHud';
import { PausePanel, MatchResults } from './components/MatchPanels';
import { ActualMapThumbnail } from './components/ActualMapThumbnail';
import { ProfilePanel } from './components/ProfilePanel';
import { createMatchClock, recordRally, gunStandings, nukeStandings } from './components/matchStats';
import { WeatherControl } from './components/WeatherControl';
import { CharacterPortrait as ChibiCharacterPortrait } from './components/CharacterPortrait';
import { customCharacter } from './network/customCharacters';
import { createGunTouchActions } from './components/gunTouchControls';
import { CharacterStudio } from './components/CharacterStudio';
import { CustomLobby } from './components/CustomLobby';
import { GameSettings, ModesAndMaps, type SettingsValues } from './components/GameMenus';
import {
  ObstacleRushCanvas,
  ObstacleRushHudState,
} from './components/ObstacleRushCanvas';
import {
  FloorIsLavaCanvas,
  FloorIsLavaHudState,
} from './components/FloorIsLavaCanvas';
import {
  CustomRoomInfo,
  multiplayerClient,
  PublicRoomSummary,
} from './network/multiplayerClient';
import {
  AIDifficulty,
  BALL_SKINS,
  BallSkinConfig,
  BallSkinId,
  CalloutPopup,
  CameraPreset,
  CHARACTER_FACES,
  CHARACTER_OUTFITS,
  CharacterConfig,
  CharacterId,
  COURT_THEMES,
  CourtTheme,
  CourtThemeId,
  CRAYON_CHARACTERS,
  DIFFICULTY_LEVELS,
  FaceId,
  FLOOR_IS_LAVA_MAPS,
  FloorIsLavaMapConfig,
  FloorIsLavaMapId,
  GameMode,
  GameState,
  HEAD_SHAPES,
  HeadShape,
  LevelModifier,
  MatchStats,
  OBSTACLE_RUSH_MAPS,
  ObstacleRushMapConfig,
  ObstacleRushMapId,
  OutfitConfig,
  OutfitId,
  SUB_GAMES_LIST,
  WORLD_TOUR_LEVELS,
} from './types/game';
import './components/gameTheme.css';
import './components/polish.css';
import './components/responsive.css';
import { crayonAudio } from './audio/crayonAudio';
import {
  getLavaMapThumbnailDataUrl,
  getMapThumbnailDataUrl,
  getRushMapThumbnailDataUrl,
} from './three/crayonModels';

/**
 * Renders the custom Chest Emblem SVG icon for all 10 outfit emblem types
 */
const renderOutfitEmblemSvg = (
  emblemType: OutfitConfig['emblemType'],
  accentColor: string,
  cx: number,
  cy: number,
  scale: number = 1
) => {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      {emblemType === 'crown' && (
        <path
          d="M -9 5 L -11 -5 L -4 0 L 0 -7 L 4 0 L 11 -5 L 9 5 Z"
          fill="#FACC15"
          stroke="#0F172A"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
      )}
      {emblemType === 'star' && (
        <polygon
          points="0,-8 2.4,-2.6 8.2,-1.8 3.9,2.1 5,7.8 0,5 -5,7.8 -3.9,2.1 -8.2,-1.8 -2.4,-2.6"
          fill="#FACC15"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {emblemType === 'bolt' && (
        <polygon
          points="2.5,-8 -6,1 0,1 -2.5,8.5 6,-1 0,-1"
          fill="#38BDF8"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {emblemType === 'skull' && (
        <g>
          <path
            d="M -6.5 -1 C -6.5 -7 6.5 -7 6.5 -1 C 6.5 2 4.5 3.5 4 4.5 L 4 7 L -4 7 L -4 4.5 C -4.5 3.5 -6.5 2 -6.5 -1 Z"
            fill="#F8FAFC"
            stroke="#0F172A"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="-2.4" cy="-1" r="1.4" fill="#0F172A" />
          <circle cx="2.4" cy="-1" r="1.4" fill="#0F172A" />
        </g>
      )}
      {emblemType === 'paw' && (
        <g fill={accentColor || '#FDE047'} stroke="#0F172A" strokeWidth="1.7">
          <ellipse cx="0" cy="2.5" rx="4.8" ry="3.6" />
          <circle cx="-5" cy="-2.5" r="2" />
          <circle cx="0" cy="-4.2" r="2" />
          <circle cx="5" cy="-2.5" r="2" />
        </g>
      )}
      {emblemType === 'planet' && (
        <g>
          <circle
            cx="0"
            cy="0"
            r="5.2"
            fill="#38BDF8"
            stroke="#0F172A"
            strokeWidth="2"
          />
          <ellipse
            cx="0"
            cy="0"
            rx="9.5"
            ry="2.6"
            transform="rotate(-20)"
            fill="none"
            stroke="#FACC15"
            strokeWidth="2.2"
          />
        </g>
      )}
      {emblemType === 'number' && (
        <g>
          <circle
            cx="0"
            cy="0"
            r="6.8"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="2"
          />
          <path
            d="M -2.5 -3.5 L 3 -3.5 L -1 4.5"
            fill="none"
            stroke="#0F172A"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {emblemType === 'burger' && (
        <g>
          <path
            d="M -7 -1 C -7 -7 7 -7 7 -1 Z"
            fill="#F59E0B"
            stroke="#0F172A"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <line
            x1="-7.5"
            y1="1"
            x2="7.5"
            y2="1"
            stroke="#22C55E"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <rect
            x="-7"
            y="2.2"
            width="14"
            height="3.6"
            rx="1.8"
            fill="#78350F"
            stroke="#0F172A"
            strokeWidth="1.8"
          />
        </g>
      )}
      {emblemType === 'berry' && (
        <g>
          <path
            d="M 0 7 C -6 4 -7 -2 -4 -5 C -1 -6 1 -6 4 -5 C 7 -2 6 4 0 7 Z"
            fill="#F43F5E"
            stroke="#0F172A"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <polygon
            points="-4,-5 0,-8 4,-5 0,-3.5"
            fill="#22C55E"
            stroke="#0F172A"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="-1.8" cy="0" r="0.9" fill="#FEF08A" />
          <circle cx="1.8" cy="0" r="0.9" fill="#FEF08A" />
          <circle cx="0" cy="3" r="0.9" fill="#FEF08A" />
        </g>
      )}
      {emblemType === 'pineapple' && (
        <g>
          <polygon
            points="-3,-3 -5,-8 0,-5 5,-8 3,-3"
            fill="#22C55E"
            stroke="#0F172A"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <ellipse
            cx="0"
            cy="2"
            rx="5.2"
            ry="5.8"
            fill="#FACC15"
            stroke="#0F172A"
            strokeWidth="1.9"
          />
          <line x1="-3" y1="-1" x2="3" y2="5" stroke="#CA8A04" strokeWidth="1.4" />
          <line x1="3" y1="-1" x2="-3" y2="5" stroke="#CA8A04" strokeWidth="1.4" />
        </g>
      )}
    </g>
  );
};

/**
 * Illustrated 3D-Shaded Outfit Preview SVG for the "Outfits" Tab in Customize
 * Supports all 12 Outfits & all 10 Custom Chest Emblems!
 */
const OutfitPreviewSvg: React.FC<{ outfit: OutfitConfig }> = ({ outfit }) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-16 h-16 overflow-visible select-none drop-shadow-[0_3px_4px_rgba(4,13,24,0.45)]"
    >
      <defs>
        <linearGradient id={`outfit_grad_${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="91" rx="22" ry="3.5" fill="rgba(6,24,44,0.35)" />
      {/* Curved Hoodie Sleeves & White Cuffs */}
      <path
        d="M 27 28 C 16 34 11 44 9 54 L 20 59 C 22 50 26 42 32 38 Z"
        fill={outfit.primaryColor}
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="9"
        y="53"
        width="11"
        height="4.5"
        rx="2"
        transform="rotate(24 14 55)"
        fill="#F8FAFC"
        stroke="#0F172A"
        strokeWidth="2"
      />
      <path
        d="M 73 28 C 84 34 89 44 91 54 L 80 59 C 78 50 74 42 68 38 Z"
        fill={outfit.primaryColor}
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="80"
        y="53"
        width="11"
        height="4.5"
        rx="2"
        transform="rotate(-24 86 55)"
        fill="#F8FAFC"
        stroke="#0F172A"
        strokeWidth="2"
      />
      {/* Sporty Shorts with White Side Stripes */}
      <rect
        x="29"
        y="64"
        width="19"
        height="22"
        rx="5"
        fill={outfit.secondaryColor}
        stroke="#0F172A"
        strokeWidth="2.8"
      />
      <rect
        x="52"
        y="64"
        width="19"
        height="22"
        rx="5"
        fill={outfit.secondaryColor}
        stroke="#0F172A"
        strokeWidth="2.8"
      />
      <line
        x1="31.5"
        y1="67"
        x2="31.5"
        y2="83"
        stroke="#F8FAFC"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <line
        x1="68.5"
        y1="67"
        x2="68.5"
        y2="83"
        stroke="#F8FAFC"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Sculpted Hoodie Torso + 3D Gradient */}
      <path
        d="M 27 68 C 25 46 28 24 38 23 L 62 23 C 72 24 75 46 73 68 Z"
        fill={outfit.primaryColor}
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M 27 68 C 25 46 28 24 38 23 L 62 23 C 72 24 75 46 73 68 Z"
        fill={`url(#outfit_grad_${uid})`}
        pointerEvents="none"
      />
      {/* Hoodie Ribbed Neckline Collar */}
      <path
        d="M 38 23 Q 50 31 62 23 Q 58 28 50 28 Q 42 28 38 23 Z"
        fill={outfit.secondaryColor}
        stroke="#0F172A"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M 31 62 C 30 46 32 30 39 26"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Kangaroo Pocket & Drawstrings */}
      <path
        d="M 36 67 L 39 57 L 61 57 L 64 67"
        fill="rgba(15,23,42,0.18)"
        stroke="#0F172A"
        strokeWidth="1.8"
      />
      <line
        x1="44"
        y1="26"
        x2="44"
        y2="37"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <line
        x1="56"
        y1="26"
        x2="56"
        y2="37"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Matching Custom Chest Emblem */}
      {renderOutfitEmblemSvg(outfit.emblemType, outfit.accentColor, 50, 44.5, 1.15)}
    </svg>
  );
};

/**
 * Instant, Ultra-HD 800x500 3D-Shaded Diorama Arena Preview for Volleyball Courts
 * Cached in memory for 0ms lag when clicking modes & 3D arenas!
 */
const MapThumbnailPreview: React.FC<{ theme: CourtTheme }> = React.memo(({ theme }) => <ActualMapThumbnail kind="court" map={theme} />);
const RushMapThumbnailPreview: React.FC<{ rushMap: ObstacleRushMapConfig; view?: 'ingame' | 'aerial' }> = React.memo(({ rushMap }) => <ActualMapThumbnail kind="gun" map={rushMap} />);
const LavaMapThumbnailPreview: React.FC<{ lavaMap: FloorIsLavaMapConfig }> = React.memo(({ lavaMap }) => <ActualMapThumbnail kind="nuke" map={lavaMap} />);

/**
 * Crisp 3D Spherical-Clipped Volleyball Swatch Icon for the 10 Ball Skins
 */
const BallSkinSwatchIcon: React.FC<{
  skin: BallSkinConfig;
  size?: number;
}> = ({ skin, size = 24 }) => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="shrink-0 overflow-visible drop-shadow-[0_2px_2px_rgba(4,13,24,0.5)]"
    >
      <defs>
        <clipPath id={`ball_clip_${uid}`}>
          <circle cx="16" cy="16" r="13.5" />
        </clipPath>
        <radialGradient id={`ball_shade_${uid}`} cx="36%" cy="30%" r="68%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#04101E" stopOpacity="0.32" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#ball_clip_${uid})`}>
        <circle cx="16" cy="16" r="14" fill={skin.primaryColors[0]} />
        <path
          d="M 2 10 Q 16 18 30 10 L 31 19 Q 16 25 1 19 Z"
          fill={skin.primaryColors[1]}
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        <path
          d="M 5 25 Q 16 19 27 25 L 28 31 L 4 31 Z"
          fill={skin.primaryColors[2]}
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        <path
          d="M 16 2 Q 21 16 13 30"
          fill="none"
          stroke="#0F172A"
          strokeWidth="1.4"
          opacity="0.65"
        />
        <circle cx="16" cy="16" r="13.5" fill={`url(#ball_shade_${uid})`} />
      </g>
      <circle
        cx="16"
        cy="16"
        r="13.5"
        fill="none"
        stroke="#0F172A"
        strokeWidth="2.2"
      />
      <ellipse
        cx="11.5"
        cy="8.5"
        rx="3.8"
        ry="1.8"
        transform="rotate(-24 11.5 8.5)"
        fill="#FFFFFF"
        opacity="0.8"
      />
    </svg>
  );
};

export function App() {
  const [savedPreferences] = useState(readPlayerPreferences);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [gameMode, setGameMode] = useState<GameMode>(savedPreferences.gameMode);
  const [learnedControls, setLearnedControls] = useState(readTutorialSeen);
  const [replayControls, setReplayControls] = useState(false);
  const roomControlMode = gameState === 'CUSTOM_LOBBY' ? multiplayerClient.currentRoom?.mode : undefined;
  const controlMode: GameMode = roomControlMode === 'volleyball_1v1' ? 'duo_2v2' : roomControlMode === 'volleyball_2v2' ? 'hoop_volley' : roomControlMode || gameMode;
  const controlFamily = tutorialFamily(controlMode);
  const showControls = replayControls || ((gameState === 'PLAYING' || (gameState === 'CUSTOM_LOBBY' && Boolean(multiplayerClient.currentRoom))) && !learnedControls.includes(controlFamily));
  const closeControls = () => { setLearnedControls(rememberTutorial(controlFamily)); setReplayControls(false); };
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.visualViewport?.width || window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.visualViewport?.height || window.innerHeight : 800,
  }));
  const [splashDismissed, setSplashDismissed] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingSceneReady, setLoadingSceneReady] = useState(false);
  const handleLoadingReady = useCallback(() => setLoadingSceneReady(true), []);
  const loadingNeedsRotation = viewport.h > viewport.w && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  // Smooth initial game loading animation (0% -> 100%) when opening SIXZUN, then auto-open game
  useEffect(() => {
    if (!loadingSceneReady || loadingNeedsRotation) return;
    let rafId = 0;
    let dismissTimer = 0;
    const startTime = performance.now();
    const durationMs = new URLSearchParams(window.location.search).get('loading-preview') === '1' ? 12000 : 3000;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 2.4);
      const pct = t < 1 ? Math.min(99, Math.round(eased * 100)) : 100;
      setLoadingProgress(pct);
      if (t < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        dismissTimer = window.setTimeout(() => {
          setSplashDismissed(true);
        }, 320);
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(dismissTimer);
    };
  }, [loadingSceneReady, loadingNeedsRotation]);

  useEffect(() => {
    const updateViewport = () => {
      const visual = window.visualViewport;
      const height = visual && visual.scale === 1 ? visual.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
      document.documentElement.style.setProperty('--app-top', `${visual?.offsetTop || 0}px`);
      setViewport({ w: window.innerWidth, h: height });
    };
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    updateViewport();
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      document.documentElement.style.removeProperty('--app-top');
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);

  const isPortrait = viewport.h > viewport.w;
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  // On phones, ask for landscape from the first loading frame and retain the match on rotation.
  const needsLandscape = isPortrait && (isTouchDevice || gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'TOUR_MAP');
  const canvasGameState = gameState === 'GAME_OVER' || (gameState === 'PLAYING' && (isPortrait || showControls))
    ? 'PAUSED' : gameState;
  // Show SIXZUN Splash & Loading screen on initial open
  const showSplashScreen = !splashDismissed;

  // True when viewport is in landscape aspect ratio so side-by-side panels work across all mobile & desktop landscape screens
  const isWideLayout = !isPortrait;
  // True for compact landscape mobile viewports (e.g. 640x360, 740x360, 800x360, 844x390, 915x412)
  const isShortLandscape = isWideLayout && viewport.h < 540;

  const [selectedTourLevel] = useState<number>(1);
  const [unlockedTourLevel, setUnlockedTourLevel] = useState<number>(readTourProgress);

  // Selected Character + Customizable Outfit, Face, and Head Shape!
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>(savedPreferences.selectedCharId);
  const [selectedOutfitId, setSelectedOutfitId] = useState<OutfitId>(savedPreferences.selectedOutfitId);
  const [selectedFaceId, setSelectedFaceId] = useState<FaceId>(savedPreferences.selectedFaceId);
  const [selectedHeadShape, setSelectedHeadShape] = useState<HeadShape>(savedPreferences.selectedHeadShape);

  const [partnerCharId, setPartnerCharId] = useState<CharacterId>('blue_sporty');
  const [opponentCharId, setOpponentCharId] = useState<CharacterId>('pirate_capt');
  const [opponentPartnerCharId, setOpponentPartnerCharId] =
    useState<CharacterId>('purple_shades');

  const matchClock = useRef(createMatchClock());
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('sixgun_player_name') || 'LEO_STRIKER';
    } catch {
      return 'LEO_STRIKER';
    }
  });
  const [hasConfirmedName, setHasConfirmedName] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sixgun_name_confirmed_v1') === '1';
    } catch {
      return false;
    }
  });
  const [nameInputDraft, setNameInputDraft] = useState<string>(() => {
    try {
      return localStorage.getItem('sixgun_player_name') || '';
    } catch {
      return '';
    }
  });

  // Real-Time Multiplayer & Voice Chat State
  const [mpConnected, setMpConnected] = useState<boolean>(multiplayerClient.connected);
  const [mpOnlineCount, setMpOnlineCount] = useState(multiplayerClient.onlineCount);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [mpRoom, setMpRoom] = useState<CustomRoomInfo | null>(multiplayerClient.currentRoom);
  const [customMatchRoom, setCustomMatchRoom] = useState<CustomRoomInfo | null>(null);
  const [leavingResultRoom, setLeavingResultRoom] = useState(false);
  const [mpPublicRooms, setMpPublicRooms] = useState<PublicRoomSummary[]>(
    multiplayerClient.publicRooms
  );
  const [mpError, setMpError] = useState<string | null>(multiplayerClient.lastError);
  const [mpMicEnabled, setMpMicEnabled] = useState<boolean>(multiplayerClient.micEnabled);
  const [mpListenEnabled, setMpListenEnabled] = useState<boolean>(
    multiplayerClient.listenEnabled
  );
  const [mpIsSpeaking, setMpIsSpeaking] = useState<boolean>(multiplayerClient.isSpeaking);

  // Selected Volleyball Court, Solo Gun Fight Map, & 12P Floor is Lava Map!
  const [selectedThemeId, setSelectedThemeId] = useState<CourtThemeId>(savedPreferences.selectedThemeId);
  const [selectedRushMapId, setSelectedRushMapId] =
    useState<ObstacleRushMapId>(savedPreferences.selectedRushMapId);
  const [selectedLavaMapId, setSelectedLavaMapId] =
    useState<FloorIsLavaMapId>(savedPreferences.selectedLavaMapId);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(savedPreferences.difficulty);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(savedPreferences.cameraPreset);
  const [winScore, setWinScore] = useState<number>(savedPreferences.winScore);
  const [rushTimerMinutes, setRushTimerMinutes] = useState<3 | 5 | 6>(savedPreferences.rushTimerMinutes);
  const [activeModifier, setActiveModifier] = useState<LevelModifier>('none');
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>(savedPreferences.matchFormat);
  const [ballSkinSetting, setBallSkinSetting] = useState<BallSkinId | 'auto'>(savedPreferences.ballSkinSetting);
  const [activeBallSkin, setActiveBallSkin] = useState<BallSkinConfig>(BALL_SKINS[0]);

  const handleCycleBallSkinSetting = () => {
    crayonAudio.playMenuClick();
    setBallSkinSetting((prev) => {
      if (prev === 'auto') return BALL_SKINS[0].id;
      const idx = BALL_SKINS.findIndex((b) => b.id === prev);
      if (idx < 0 || idx === BALL_SKINS.length - 1) return 'auto';
      return BALL_SKINS[idx + 1].id;
    });
  };

  // Extra Functional Settings State (Gameplay, Camera, Visual FX & Audio)
  const [settingsTab, setSettingsTab] = useState<'gameplay' | 'camera' | 'audio'>('gameplay');
  const [gameSpeedMultiplier, setGameSpeedMultiplier] = useState<number>(savedPreferences.gameSpeedMultiplier);
  const [cameraFov, setCameraFov] = useState<number>(savedPreferences.cameraFov);
  const [landingCircleStyle, setLandingCircleStyle] = useState<
    'classic' | 'neon' | 'off'
  >(savedPreferences.landingCircleStyle);
  const [enableVfx, setEnableVfx] = useState<boolean>(savedPreferences.enableVfx);
  const [enableScreenShake, setEnableScreenShake] = useState<boolean>(savedPreferences.enableScreenShake);
  const [showCallouts, setShowCallouts] = useState<boolean>(savedPreferences.showCallouts);

  const [muted, setMuted] = useState<boolean>(savedPreferences.muted);
  const [musicVol, setMusicVol] = useState<number>(savedPreferences.musicVol);
  const [sfxVol, setSfxVol] = useState<number>(savedPreferences.sfxVol);

  useEffect(() => {
    savePlayerPreferences({ gameMode, selectedCharId, selectedOutfitId, selectedFaceId, selectedHeadShape, selectedThemeId, selectedRushMapId, selectedLavaMapId, difficulty, cameraPreset, winScore, rushTimerMinutes, matchFormat, ballSkinSetting, gameSpeedMultiplier, cameraFov, landingCircleStyle, enableVfx, enableScreenShake, showCallouts, muted, musicVol, sfxVol });
  }, [gameMode, selectedCharId, selectedOutfitId, selectedFaceId, selectedHeadShape, selectedThemeId, selectedRushMapId, selectedLavaMapId, difficulty, cameraPreset, winScore, rushTimerMinutes, matchFormat, ballSkinSetting, gameSpeedMultiplier, cameraFov, landingCircleStyle, enableVfx, enableScreenShake, showCallouts, muted, musicVol, sfxVol]);

  useEffect(() => {
    crayonAudio.muted = muted;
    crayonAudio.musicVolume = musicVol / 100;
    crayonAudio.sfxVolume = sfxVol / 100;
    crayonAudio.syncVolleyballNatureAmbienceVolume();
  }, [muted, musicVol, sfxVol]);

  const actionTriggerRef = useRef<{
    spikeRequested: boolean;
    diveRequested: boolean;
    superRequested: boolean;
    liftRequested?: boolean;
    jumpRequested?: boolean;
    firingHeld?: boolean;
    fireRequested?: boolean;
    joystickX?: number;
    joystickY?: number;
    joystickActive?: boolean;
  }>({
    spikeRequested: false,
    diveRequested: false,
    superRequested: false,
    liftRequested: false,
    jumpRequested: false,
    joystickX: 0,
    joystickY: 0,
    joystickActive: false,
  });

  // Gun Fight: left movement, automatic fire and right-side double-tap jump.
  const invisibleJoyRef = useRef<{
    active: boolean;
    pointerId: number | null;
    originX: number;
    originY: number;
  }>({
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
  });

  const gunTouchActions = useRef(createGunTouchActions(() => { actionTriggerRef.current.jumpRequested = true; }));

  const joyContainerRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);

  const resetInvisibleJoy = useCallback(() => {
    invisibleJoyRef.current.active = false;
    invisibleJoyRef.current.pointerId = null;
    gunTouchActions.current.reset();
    Object.assign(actionTriggerRef.current, {
      joystickActive: false, joystickX: 0, joystickY: 0,
      spikeRequested: false, diveRequested: false, superRequested: false,
      liftRequested: false, jumpRequested: false, firingHeld: false, fireRequested: false,
    });
    if (joyContainerRef.current) joyContainerRef.current.style.display = 'none';
  }, []);
  useEffect(() => {
    if (isPortrait || gameState !== 'PLAYING') resetInvisibleJoy();
  }, [isPortrait, gameState, resetInvisibleJoy]);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) resetInvisibleJoy(); };
    window.addEventListener('blur', resetInvisibleJoy);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', resetInvisibleJoy);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resetInvisibleJoy]);

  const handleInvisibleJoyDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === 'mouse' || e.clientX - bounds.left >= bounds.width / 2) {
      if (!gunTouchActions.current.start(e)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    // Only capture and start joystick if no finger is currently controlling the joystick!
    if (!invisibleJoyRef.current.active || invisibleJoyRef.current.pointerId === null) {
      e.currentTarget.setPointerCapture(e.pointerId);
      invisibleJoyRef.current.active = true;
      invisibleJoyRef.current.pointerId = e.pointerId;
      invisibleJoyRef.current.originX = e.clientX;
      invisibleJoyRef.current.originY = e.clientY;
      actionTriggerRef.current.joystickX = 0;
      actionTriggerRef.current.joystickY = 0;
      actionTriggerRef.current.joystickActive = true;
      if (joyContainerRef.current && joyKnobRef.current) {
        joyContainerRef.current.style.display = 'flex';
        joyContainerRef.current.style.left = `${e.clientX}px`;
        joyContainerRef.current.style.top = `${e.clientY}px`;
        joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
    }
  }, []);

  const handleInvisibleJoyMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    gunTouchActions.current.move(e);
    if (!invisibleJoyRef.current.active || invisibleJoyRef.current.pointerId !== e.pointerId) {
      return;
    }
    const maxR = 58;
    const dx = e.clientX - invisibleJoyRef.current.originX;
    const dy = e.clientY - invisibleJoyRef.current.originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) {
      actionTriggerRef.current.joystickX = 0;
      actionTriggerRef.current.joystickY = 0;
      if (joyKnobRef.current) {
        joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
      return;
    }
    const clamped = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const clampedDx = Math.cos(angle) * clamped;
    const clampedDy = Math.sin(angle) * clamped;
    actionTriggerRef.current.joystickX = clampedDx / maxR;
    actionTriggerRef.current.joystickY = clampedDy / maxR;
    actionTriggerRef.current.joystickActive = true;
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate3d(${clampedDx}px, ${clampedDy}px, 0)`;
    }
  }, []);

  const handleInvisibleJoyEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    gunTouchActions.current.end(e);
    if (invisibleJoyRef.current.pointerId === e.pointerId) {
      invisibleJoyRef.current.active = false;
      invisibleJoyRef.current.pointerId = null;
      actionTriggerRef.current.joystickX = 0;
      actionTriggerRef.current.joystickY = 0;
      actionTriggerRef.current.joystickActive = false;
      if (joyContainerRef.current) {
        joyContainerRef.current.style.display = 'none';
      }
    }
  }, []);

  const [rushRunKey, setRushRunKey] = useState<number>(1);
  const [callouts, setCallouts] = useState<CalloutPopup[]>([]);
  const calloutTimers = useRef(new Set<number>());
  const currentGameState = useRef(gameState);
  currentGameState.current = gameState;
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      for (const timer of calloutTimers.current) window.clearTimeout(timer);
      calloutTimers.current.clear();
      setCallouts([]);
    }
  }, [gameState, rushRunKey]);
  useEffect(() => () => {
    for (const timer of calloutTimers.current) window.clearTimeout(timer);
    calloutTimers.current.clear();
  }, []);
  const [rushHud, setRushHud] = useState<ObstacleRushHudState>({
    countdown: 3,
    raceTimeSec: 0,
    timeRemainingSec: 180,
    playerProgressPct: 0,
    sectionName: 'Blaster Battle Grand Fort · 4P Solo',
    stageIndex: 1,
    fallsCount: 0,
    maxFalls: 0,
    playerHp: 240,
    playerMaxHp: 240,
    playerKills: 0,
    playerDeaths: 0,
    playerRank: 1,
    weaponName: 'AUTO ASSAULT BLASTER',
    weaponTimerSec: 0,
    standings: [],
  });
  const [stats, setStats] = useState<MatchStats>({
    playerScore: 0,
    aiScore: 0,
    targetWinScore: 5,
    currentRally: 0,
    bestRally: 0,
    perfectSpikes: 0,
    partnerSets: 0,
    bonusHits: 0,
    superCharge: 0,
    servingSide: 'player',
    lastPointWinner: null,
    lastPointReason: '',
    matchWinner: null,
    raceTimeSec: 0,
    raceTimeLeftSec: 0,
    raceFalls: 0,
    raceMaxFalls: 4,
    raceProgressPct: 0,
  });



  const is2v2Match = matchFormat === '2v2';

  const basePlayerChar =
    CRAYON_CHARACTERS.find((c) => c.id === selectedCharId) || CRAYON_CHARACTERS[0];

  // Merge the user's chosen Outfit, Face, and Head Shape into the active 3D Player Character
  const activePlayerChar = useMemo<CharacterConfig>(
    () => ({
      ...basePlayerChar,
      outfitId: selectedOutfitId,
      faceId: selectedFaceId,
      headShape: selectedHeadShape,
    }),
    [basePlayerChar, selectedOutfitId, selectedFaceId, selectedHeadShape]
  );

  const activePartnerChar =
    CRAYON_CHARACTERS.find((c) => c.id === partnerCharId) || CRAYON_CHARACTERS[5];
  const activeOpponentChar =
    CRAYON_CHARACTERS.find((c) => c.id === opponentCharId) || CRAYON_CHARACTERS[4];
  const activeOpponentPartnerChar =
    CRAYON_CHARACTERS.find((c) => c.id === opponentPartnerCharId) || CRAYON_CHARACTERS[1];
  const matchRoom = customMatchRoom?.code === mpRoom?.code && ['PLAYING', 'PAUSED', 'GAME_OVER'].includes(gameState) ? customMatchRoom : null;
  const matchCharacters = useMemo(() => {
    const slots = matchRoom?.slots || [];
    const me = slots.find(slot => slot.playerId === multiplayerClient.playerId);
    const partner = slots.find(slot => slot.team === me?.team && slot !== me && slot.occupiedBy !== 'empty');
    const rivals = slots.filter(slot => slot.team !== me?.team && slot.occupiedBy !== 'empty');
    return { player: customCharacter(me, activePlayerChar), partner: customCharacter(partner, activePartnerChar), rival: customCharacter(rivals[0], activeOpponentChar), rival2: customCharacter(rivals[1], activeOpponentPartnerChar) };
  }, [matchRoom, activePlayerChar, activePartnerChar, activeOpponentChar, activeOpponentPartnerChar]);
  const activeTheme =
    COURT_THEMES.find((t) => t.id === selectedThemeId) || COURT_THEMES[0];
  const [autoVolleyballMap, setAutoVolleyballMap] = useState(() => { try { return localStorage.getItem('sixzun-auto-court') !== 'off'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('sixzun-auto-court', autoVolleyballMap ? 'on' : 'off'); } catch {} }, [autoVolleyballMap]);
  const activeRushMap =
    OBSTACLE_RUSH_MAPS.find((m) => m.id === selectedRushMapId) ||
    OBSTACLE_RUSH_MAPS[0];
  const activeLavaMap =
    FLOOR_IS_LAVA_MAPS.find((m) => m.id === selectedLavaMapId) ||
    FLOOR_IS_LAVA_MAPS[0];
  const [lavaHud, setLavaHud] = useState<FloorIsLavaHudState>({
    countdown: 3,
    aliveCount: 4,
    totalPlayers: 4,
    survivalTimeSec: 0,
    timeRemainingSec: 180,
    playerLives: 1,
    playerHp: 160,
    playerMaxHp: 160,
    lavaLevelMeters: 0,
    lavaWarningState: 'STABLE',
    tilesCrumbled: 0,
    currentTier: 1,
    eliminationBanner: null,
  });

  // Connect & Subscribe to Real-Time WebSocket Multiplayer + Voice Chat Server
  useEffect(() => {
    let previousRoomStatus = multiplayerClient.currentRoom?.status;
    const unsubState = multiplayerClient.subscribe(() => {
      const status = multiplayerClient.currentRoom?.status;
      if (previousRoomStatus === 'PLAYING' && status === 'LOBBY') {
        setGameState('CUSTOM_LOBBY');
        setMatchTransition(null);
      } else if (previousRoomStatus === 'PLAYING' && !status) {
        setGameState('TITLE_MENU');
        setMatchTransition(null);
      }
      previousRoomStatus = status;
      setMpConnected(multiplayerClient.connected);
      setMpOnlineCount(multiplayerClient.onlineCount);
      setMpRoom(multiplayerClient.currentRoom ? { ...multiplayerClient.currentRoom } : null);
      setMpPublicRooms([...multiplayerClient.publicRooms]);
      setMpError(multiplayerClient.lastError);
      setMpMicEnabled(multiplayerClient.micEnabled);
      setMpListenEnabled(multiplayerClient.listenEnabled);
      setMpIsSpeaking(multiplayerClient.isSpeaking);
    });

    const unsubMatchStart = multiplayerClient.onMatchStart((room) => {
      crayonAudio.playMenuClick();
      setCustomMatchRoom({ ...room, slots: room.slots.map(slot => ({ ...slot })) });
      if (isVolleyballMode(room.mode)) {
        setGameMode(room.mode === 'volleyball_1v1' ? 'duo_2v2' : 'hoop_volley');
        setMatchFormat(room.mode === 'volleyball_1v1' ? '1v1' : '2v2');
        setWinScore(room.winScore || 5);
        setSelectedThemeId((room.mapId as CourtThemeId) || 'pirate_cove');
        const blueSlots = room.slots.filter((s) => s.team === 'blue');
        const redSlots = room.slots.filter((s) => s.team === 'red');
        const mySlot = room.slots.find((s) => s.playerId === multiplayerClient.playerId);
        const myTeam = mySlot?.team === 'red' ? redSlots : blueSlots;
        const rivalTeam = mySlot?.team === 'red' ? blueSlots : redSlots;
        const partnerSlot = myTeam.find((s) => s.playerId !== multiplayerClient.playerId) || myTeam[1];
        if (partnerSlot?.charId) setPartnerCharId(partnerSlot.charId);
        setOpponentCharId(rivalTeam[0]?.charId || 'pirate_capt');
        if (rivalTeam[1]?.charId) setOpponentPartnerCharId(rivalTeam[1].charId as CharacterId);
      } else if (room.mode === 'floor_is_lava') {
        setGameMode('floor_is_lava');
        setSelectedLavaMapId((room.mapId as FloorIsLavaMapId) || 'volcano_summit');
        setRushTimerMinutes(room.timerMinutes || 3);
      } else {
        setGameMode('obstacle_rush');
        setSelectedRushMapId((room.mapId as ObstacleRushMapId) || 'sky_carnival');
        setRushTimerMinutes(room.timerMinutes || 3);
      }
      if (room.difficulty) {
        setDifficulty(room.difficulty as AIDifficulty);
      }
      matchClock.current.reset();
      setStats((prev) => ({
        ...prev,
        playerScore: 0,
        aiScore: 0,
        targetWinScore: room.winScore || 5,
        currentRally: 0,
        bestRally: 0,
        perfectSpikes: 0,
        partnerSets: 0,
        bonusHits: 0,
        superCharge: 0,
        servingSide: 'player',
        lastPointWinner: null,
        lastPointReason: '',
        matchWinner: null,
        raceTimeSec: 0,
        nukeStandings: undefined,
        arenaStandings: undefined,
        raceTimeLeftSec: (room.timerMinutes || 3) * 60,
        raceFalls: 0,
        raceMaxFalls: 0,
        raceProgressPct: 0,
      }));
      setRushRunKey((prev) => prev + 1);
      setMatchTransition(room.mode === 'obstacle_rush' ? null : {
        title: `ROOM ${room.code} LIVE`,
        subtitle:
          isVolleyballMode(room.mode)
            ? `${room.mode === 'volleyball_1v1' ? '1v1' : '2v2'} Volleyball · Custom Live`
            : room.mode === 'floor_is_lava'
              ? `${room.maxPlayers}P Nuke Showdown · Custom Live`
              : `${room.maxPlayers}P Gun Fight · Custom Live`,
      });
      setGameState('PLAYING');
    });

    return () => {
      unsubState();
      unsubMatchStart();
    };
  }, []);

  // Solo play and ordinary menus do not open a multiplayer connection.
  useEffect(() => {
    if (gameState === 'CUSTOM_LOBBY' || mpRoom?.code) multiplayerClient.connect();
    else multiplayerClient.disconnectWhenIdle();
  }, [gameState, mpRoom?.code]);

  // Keep player's profile synced with the real-time server whenever name, character, outfit, or face changes
  useEffect(() => {
    multiplayerClient.syncProfile(
      playerName,
      selectedCharId,
      selectedOutfitId,
      selectedFaceId
    );
  }, [playerName, selectedCharId, selectedOutfitId, selectedFaceId]);
  useEffect(() => {
    try { localStorage.setItem('sixgun_player_name', playerName); } catch {}
  }, [playerName]);
  useEffect(() => {
    if (canvasGameState !== 'PLAYING') return;
    matchClock.current.resume(performance.now());
    const tick = window.setInterval(() => setStats(prev => prev.matchWinner ? prev : { ...prev, raceTimeSec: matchClock.current.seconds(performance.now()) }), 250);
    return () => { matchClock.current.pause(performance.now()); window.clearInterval(tick); };
  }, [canvasGameState, gameMode, rushRunKey]);
  const finalRival = (gameMode === 'obstacle_rush' ? gunStandings(stats) : gameMode === 'floor_is_lava' ? nukeStandings(stats) : []).find(player => !player.isPlayer);
  const myRoomSlot = mpRoom?.slots.find(slot => slot.playerId === multiplayerClient.playerId);
  const roomRivals = isVolleyballMode(mpRoom?.mode) && mpRoom ? mpRoom.slots.filter(slot => slot.team !== myRoomSlot?.team && slot.occupiedBy !== 'empty') : [];
  const roomPartner = isVolleyballMode(mpRoom?.mode) && mpRoom ? mpRoom.slots.find(slot => slot.team === myRoomSlot?.team && slot.playerId !== multiplayerClient.playerId && slot.occupiedBy !== 'empty') : undefined;
  const rivalSlot = mpRoom?.slots.find(slot => slot.playerId && (`remote_${slot.playerId}` === finalRival?.id || slot.playerId === finalRival?.id)) || roomRivals[0];
  const resultRivalChar = { ...(CRAYON_CHARACTERS.find(char => char.id === (finalRival?.charId || rivalSlot?.charId)) || activeOpponentChar), ...(rivalSlot ? { outfitId: rivalSlot.outfitId, faceId: rivalSlot.faceId } : {}) };
  const resultRivalName = finalRival?.name || rivalSlot?.playerName || activeOpponentChar.name;
  const activeDiffConfig =
    DIFFICULTY_LEVELS.find((d) => d.id === difficulty) || DIFFICULTY_LEVELS[1];
  const activeModeInfo =
    SUB_GAMES_LIST.find((m) => m.id === gameMode) || SUB_GAMES_LIST[0];
  const modeAvailableThemes = useMemo(() => {
    const ids = activeModeInfo.modeThemes || [];
    const list = ids
      .map((id) => COURT_THEMES.find((t) => t.id === id))
      .filter((t): t is CourtTheme => Boolean(t));
    return list.length > 0 ? list : COURT_THEMES.slice(0, 6);
  }, [activeModeInfo]);

  const handleSelectCharacter = (char: CharacterConfig) => {
    crayonAudio.playMenuClick();
    setSelectedCharId(char.id);
    setSelectedOutfitId(char.defaultOutfit);
    setSelectedFaceId(char.defaultFace);
    setSelectedHeadShape(char.headShape);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    crayonAudio.muted = next;
    crayonAudio.syncVolleyballNatureAmbienceVolume();
    if (!next) crayonAudio.playMenuClick();
  };

  // Quiet original music in menus and matches; pause screens and hidden tabs stay silent.
  useEffect(() => {
    crayonAudio.setVolleyballNatureAmbience(false);
    crayonAudio.setBackgroundMusic(splashDismissed && canvasGameState !== 'PAUSED');
    return () => crayonAudio.setBackgroundMusic(false);
  }, [canvasGameState, splashDismissed]);

  const handleAddCallout = useCallback(
    (popup: {
      text: string;
      subtext?: string;
      color: string;
      bgHex?: string;
      x: number;
      y: number;
    }) => {
      if (currentGameState.current !== 'PLAYING') return;
      const id = Date.now() + Math.random();
      setCallouts((prev) => [
        ...prev.slice(-3),
        { ...popup, bgHex: popup.bgHex || '#0F172A', id },
      ]);
      const timer = window.setTimeout(() => {
        calloutTimers.current.delete(timer);
        setCallouts((prev) => prev.filter((c) => c.id !== id));
      }, 1100);
      calloutTimers.current.add(timer);
    },
    []
  );

  const handleRallyUpdate = useCallback(
    (
      newRally: number,
      isSweetSpot: boolean,
      superDelta: number,
      usedSuper: boolean,
      isPartnerSet: boolean
    ) => {
      setStats(prev => recordRally(prev, newRally, isSweetSpot, superDelta, usedSuper, isPartnerSet));
    },
    []
  );

  const handleBonusScore = useCallback((points: number, _label: string) => {
    setStats((prev) => {
      if (prev.matchWinner) return prev;
      const nextPlayer = prev.playerScore + points;
      const won = nextPlayer >= prev.targetWinScore ? 'player' : null;
      return {
        ...prev,
        playerScore: nextPlayer,
        bonusHits: prev.bonusHits + 1,
        matchWinner: won,
        raceTimeSec: matchClock.current.seconds(performance.now()),
      };
    });
  }, []);

  const handlePointFinished = useCallback(
    (winner: 'player' | 'ai', reason: string) => {
      setStats((prev) => {
        // Prevent duplicate point counting once a match winner is decided
        if (prev.matchWinner) return prev;

        const nextPlayer =
          winner === 'player' ? prev.playerScore + 1 : prev.playerScore;
        const nextAi = winner === 'ai' ? prev.aiScore + 1 : prev.aiScore;
        const target = prev.targetWinScore;

        let decidedWinner: 'player' | 'ai' | null = null;
        if (gameMode === 'survival' && winner === 'ai') {
          decidedWinner = 'ai';
        } else if (nextPlayer >= target) {
          decidedWinner = 'player';
        } else if (nextAi >= target) {
          decidedWinner = 'ai';
        }

        return {
          ...prev,
          playerScore: nextPlayer,
          aiScore: nextAi,
          currentRally: 0,
          servingSide: winner,
          lastPointWinner: winner,
          lastPointReason: reason,
          matchWinner: decidedWinner,
          raceTimeSec: matchClock.current.seconds(performance.now()),
        };
      });
    },
    [gameMode]
  );

  const [matchTransition, setMatchTransition] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  useEffect(() => {
    if (!matchTransition) return;
    if (gameState !== 'PLAYING') { setMatchTransition(null); return; }
    const timer = window.setTimeout(() => setMatchTransition(null), 820);
    return () => window.clearTimeout(timer);
  }, [matchTransition, gameState]);

  // Cleanly handle Victory / Defeat transition and rewards when matchWinner is decided
  // Fixed: Changing gameState to GAME_OVER now clears matchTransition simultaneously so the Defeat/Victory banner never gets stuck!
  useEffect(() => {
    if (gameState !== 'PLAYING' || !stats.matchWinner) return;

    const isWin = stats.matchWinner === 'player';
    if (isWin) {
      crayonAudio.playScoreCheer();
      if (gameMode === 'tour') {
        const nextLvl = Math.min(
          WORLD_TOUR_LEVELS.length,
          selectedTourLevel + 1
        );
        if (nextLvl > unlockedTourLevel) {
          setUnlockedTourLevel(nextLvl);
          try { localStorage.setItem('volley_rally_unlocked_level', String(nextLvl)); } catch {}
        }
      }
    }

    // Results appear directly, without a second glowing celebration overlay.
    setMatchTransition(null);
    setGameState('GAME_OVER');
  }, [
    stats.matchWinner,
    stats.lastPointReason,
    gameState,
    gameMode,
    selectedTourLevel,
    unlockedTourLevel,
    activeLavaMap.name,
    activeRushMap.name,
    activeTheme.name,
  ]);

  const pickRandomOpponents = (exclude1: CharacterId, exclude2?: CharacterId) => {
    const pool = CRAYON_CHARACTERS.filter(
      (c) => c.id !== exclude1 && c.id !== exclude2
    );
    const first = pool[Math.floor(Math.random() * pool.length)] || CRAYON_CHARACTERS[4];
    const secondPool = pool.filter((c) => c.id !== first.id);
    const second =
      secondPool[Math.floor(Math.random() * secondPool.length)] || CRAYON_CHARACTERS[1];
    return [first.id, second.id] as const;
  };

  const handleRaceFinished = useCallback(
    (
      winner: 'player' | 'ai',
      reason: string,
      raceTimeSec: number,
      timeRemainingSec: number,
      fallsCount: number,
      maxFalls: number,
      progressPct: number,
      standings?: Array<{
        id: string;
        name: string;
        kills: number;
        deaths: number;
        isPlayer: boolean;
        charId: CharacterId;
      }>
    ) => {
      setStats((prev) => {
        if (prev.matchWinner) return prev;
        return {
          ...prev,
          playerScore: standings?.find(fighter => fighter.isPlayer)?.kills ?? (winner === 'player' ? 1 : 0),
          aiScore: standings ? Math.max(0, ...standings.filter(fighter => !fighter.isPlayer).map(fighter => fighter.kills)) : (winner === 'ai' ? 1 : 0),
          lastPointWinner: winner,
          lastPointReason: reason,
          matchWinner: winner,
          raceTimeSec: matchClock.current.seconds(performance.now()),
          raceTimeLeftSec: timeRemainingSec,
          raceFalls: fallsCount,
          raceMaxFalls: maxFalls,
          raceProgressPct: progressPct,
          arenaStandings: standings,
        };
      });
    },
    []
  );

  const resetMatchStats = (targetScore: number) => {
    matchClock.current.reset();
    setStats({
      playerScore: 0,
      aiScore: 0,
      targetWinScore: targetScore,
      currentRally: 0,
      bestRally: 0,
      perfectSpikes: 0,
      partnerSets: 0,
      bonusHits: 0,
      superCharge: 0,
      servingSide: 'player',
      lastPointWinner: null,
      lastPointReason: '',
      matchWinner: null,
      raceTimeSec: 0,
      raceTimeLeftSec: rushTimerMinutes * 60,
      raceFalls: 0,
      raceMaxFalls: activeDiffConfig.rushMaxFalls,
      raceProgressPct: 0,
    });
  };

  const triggerStartTransition = (targetMode: GameMode) => {
    if (targetMode === 'obstacle_rush') { setMatchTransition(null); return; }
    const arenaLabel =
      targetMode === 'floor_is_lava'
        ? `${activeLavaMap.name} · 4P Nuke`
        : `${activeTheme.name} · Volleyball`;
    setMatchTransition({
      title: 'ARENA READY',
      subtitle: arenaLabel,
    });
  };

  const handleStartMatch = (overrideMode?: GameMode) => {
    crayonAudio.playMenuClick();
    const nextMode = overrideMode || gameMode;
    if (overrideMode) setGameMode(overrideMode);
    if (autoVolleyballMap && nextMode !== 'obstacle_rush' && nextMode !== 'floor_is_lava' && nextMode !== 'tour') {
      const themes = COURT_THEMES.slice(0, 6).filter(theme => theme.id !== selectedThemeId);
      setSelectedThemeId(themes[Math.floor(Math.random() * themes.length)].id);
    }

    const [opp1, opp2] = pickRandomOpponents(selectedCharId, partnerCharId);
    setOpponentCharId(opp1);
    setOpponentPartnerCharId(opp2);
    resetMatchStats(winScore);
    setRushRunKey((prev) => prev + 1);
    triggerStartTransition(nextMode);
    setGameState('PLAYING');
  };

  const handleRestartMatch = () => {
    crayonAudio.playMenuClick();
    if (multiplayerClient.currentRoom) {
      void multiplayerClient.returnToLobby();
      setGameState('CUSTOM_LOBBY');
      return;
    }
    if (autoVolleyballMap && gameMode !== 'obstacle_rush' && gameMode !== 'floor_is_lava' && gameMode !== 'tour') {
      const themes = COURT_THEMES.slice(0, 6).filter(theme => theme.id !== selectedThemeId);
      setSelectedThemeId(themes[Math.floor(Math.random() * themes.length)].id);
    }
    resetMatchStats(winScore);
    setRushRunKey((prev) => prev + 1);
    triggerStartTransition(gameMode);
    setGameState('PLAYING');
  };

  const handleResultExit = async () => {
    crayonAudio.playMenuClick();
    if (multiplayerClient.currentRoom) {
      if (leavingResultRoom) return;
      setLeavingResultRoom(true);
      try {
        if (!await multiplayerClient.leaveCustomRoom()) return;
      } finally { setLeavingResultRoom(false); }
    }
    setCustomMatchRoom(null);
    setGameState('TITLE_MENU');
  };

  const handleSettingsChange = (patch: Partial<SettingsValues>) => {
    if (patch.matchFormat !== undefined) setMatchFormat(patch.matchFormat);
    if (patch.winScore !== undefined) setWinScore(patch.winScore);
    if (patch.duration !== undefined) setRushTimerMinutes(patch.duration);
    if (patch.difficulty !== undefined) setDifficulty(patch.difficulty);
    if (patch.tempo !== undefined) setGameSpeedMultiplier(patch.tempo);
    if (patch.modifier !== undefined) setActiveModifier(patch.modifier);
    if (patch.fov !== undefined) setCameraFov(patch.fov);
    if (patch.landingRing !== undefined) setLandingCircleStyle(patch.landingRing);
    if (patch.vfx !== undefined) setEnableVfx(patch.vfx);
    if (patch.shake !== undefined) setEnableScreenShake(patch.shake);
    if (patch.callouts !== undefined) setShowCallouts(patch.callouts);
    if (patch.muted !== undefined) { setMuted(patch.muted); crayonAudio.muted = patch.muted; }
    if (patch.music !== undefined) { setMusicVol(patch.music); crayonAudio.musicVolume = patch.music / 100; }
    if (patch.sfx !== undefined) { setSfxVol(patch.sfx); crayonAudio.sfxVolume = patch.sfx / 100; }

  };

  const rootBgClass =
    gameState === 'TITLE_MENU'
      ? 'bg-[radial-gradient(circle_at_50%_46%,#8CE9FF_0%,#48BDF8_42%,#0EA5E9_78%,#0284C7_100%)]'
      : gameState === 'SETTINGS' ||
          gameState === 'PROFILE' ||
          gameState === 'GAME_OVER' ||
          gameState === 'CUSTOM_LOBBY'
        ? 'bg-[radial-gradient(circle_at_50%_42%,#163A5F_0%,#0D233A_45%,#081728_78%,#040D18_100%)]'
        : gameState === 'CHARACTER_SELECT'
          ? 'bg-[#062641]'
          : 'bg-[#0B192C]';

  return (
    <>
    <div
      inert={needsLandscape}
      className={`game-app relative w-full h-full h-dvh overflow-hidden select-none font-sans transition-colors duration-300 ${rootBgClass}`}
    >
      {/* Tactile Halftone & Hand-Drawn Sketch Texture + Ambient Studio Clouds behind Blue Menu Gradients */}
      {(gameState === 'TITLE_MENU' ||
        gameState === 'SETTINGS' ||
        gameState === 'GAME_OVER' ||
        gameState === 'CUSTOM_LOBBY' ||
        gameState === 'PROFILE') && (
        <div
          className={`menu-blue-texture pointer-events-none fixed inset-0 z-0 overflow-hidden ${
            gameState === 'SETTINGS' ||
            gameState === 'PROFILE' ||
            gameState === 'CUSTOM_LOBBY' ||
            gameState === 'GAME_OVER'
              ? 'opacity-45'
              : 'opacity-100'
          }`}
        >
          {/* Subtle Sunburst & Cloud Silhouette Layer */}
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full opacity-30"
          >
            <g stroke="#38BDF8" strokeWidth="1.75" fill="none" opacity="0.35">
              <circle cx="720" cy="420" r="240" strokeDasharray="10 14" />
              <circle cx="720" cy="420" r="350" strokeDasharray="6 18" />
              <circle cx="720" cy="420" r="470" strokeDasharray="14 22" />
            </g>
            {/* Soft Layered Horizon Waves */}
            <path
              d="M 0 740 Q 360 690 720 735 T 1440 720 L 1440 900 L 0 900 Z"
              fill="rgba(14, 165, 233, 0.08)"
            />
            <path
              d="M 0 795 Q 420 755 820 795 T 1440 780 L 1440 900 L 0 900 Z"
              fill="rgba(4, 13, 24, 0.32)"
            />
          </svg>
        </div>
      )}

      {/* Subtle Studio Floor Glow under the 3D Hero in Main Menu */}
      {gameState === 'TITLE_MENU' && (
        <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
          <div className="w-[280px] h-[280px] sm:w-[460px] sm:h-[460px] rounded-full bg-white/20 blur-3xl -translate-y-4" />
        </div>
      )}

      {/* FULL-SCREEN 3D VOLLEYBALL, 4P/5P GUN FIGHT, OR NUKE CANVAS */}
      {['TITLE_MENU', 'PROFILE', 'CHARACTER_SELECT', 'SETTINGS', 'MODE_SELECT', 'CUSTOM_LOBBY', 'GAME_OVER'].includes(gameState) ? null : gameMode === 'obstacle_rush' &&
      (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAME_OVER') ? (
        <ObstacleRushCanvas
          key={`${rushRunKey}_${selectedRushMapId}_${rushTimerMinutes}_${mpRoom?.code || 'solo'}`}
          gameState={canvasGameState}
          playerChar={matchCharacters.player}
          playerDisplayName={playerName}
          customSlots={matchRoom?.mode === 'obstacle_rush' ? matchRoom.slots : undefined}
          maxCustomPlayers={mpRoom?.mode === 'obstacle_rush' ? mpRoom.maxPlayers : 4}
          rushMap={activeRushMap}
          difficulty={difficulty}
          cameraPreset={cameraPreset}
          gameSpeedMultiplier={gameSpeedMultiplier}
          cameraFov={cameraFov}
          enableVfx={enableVfx}
          enableScreenShake={enableScreenShake}
          matchDurationSec={rushTimerMinutes * 60}
          actionTriggerRef={actionTriggerRef}
          onHudUpdate={setRushHud}
          onCallout={handleAddCallout}
          onRaceFinished={handleRaceFinished}
        />
      ) : gameMode === 'floor_is_lava' &&
        (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAME_OVER') ? (
        <FloorIsLavaCanvas
          key={`${rushRunKey}_${selectedLavaMapId}_${difficulty}_${rushTimerMinutes}_${mpRoom?.code || 'solo'}`}
          gameState={canvasGameState}
          playerCharacter={matchCharacters.player}
          playerDisplayName={playerName}
          customSlots={matchRoom?.mode === 'floor_is_lava' ? matchRoom.slots : undefined}
          aiDifficulty={difficulty}
          cameraPreset={cameraPreset}
          lavaMapId={selectedLavaMapId}
          matchDurationSec={rushTimerMinutes * 60}
          gameSpeedMultiplier={gameSpeedMultiplier}
          cameraFov={cameraFov}
          onHudUpdate={setLavaHud}
          onCallout={(text, color) =>
            handleAddCallout({
              text,
              color: color || '#FEF08A',
              x: 50,
              y: 28,
            })
          }
          onGameOver={(winner, lavaStats) => {
            setStats((prev) => {
              if (prev.matchWinner) return prev;
              return {
                ...prev,
                playerScore: lavaStats.playerScore ?? (winner === 'player' ? 3 : 0),
                aiScore: lavaStats.aiScore ?? (winner === 'ai' ? 3 : 0),
                bestRally: lavaStats.bestRally ?? 0,
                perfectSpikes: lavaStats.perfectSpikes ?? 0,
                lastPointWinner: winner,
                lastPointReason:
                  lavaStats.lastPointReason ||
                  (winner === 'player'
                    ? `${playerName} won the Nuke Showdown on ${activeLavaMap.name}!`
                    : `Rivals won the Nuke Showdown on ${activeLavaMap.name}!`),
                matchWinner: winner,
                raceTimeSec: matchClock.current.seconds(performance.now()),
                raceMaxFalls: lavaStats.raceMaxFalls || 0,
                raceProgressPct: lavaStats.raceProgressPct || 0,
                nukeStandings: lavaStats.nukeStandings,
              };
            });
            setMatchTransition(null);
            setGameState('GAME_OVER');
          }}
        />
      ) : (
        <VolleyballCanvas
          gameState={canvasGameState}
          gameMode={
            gameState === 'PLAYING' || gameState === 'PAUSED'
              ? gameMode
              : 'quick'
          }
          playerChar={matchCharacters.player}
          partnerChar={matchCharacters.partner}
          aiChar1={matchCharacters.rival}
          aiChar2={matchCharacters.rival2}
          is2v2={is2v2Match}
          theme={
            gameState === 'PLAYING' || gameState === 'PAUSED'
              ? activeTheme
              : COURT_THEMES[0]
          }
          difficulty={difficulty}
          cameraPreset={cameraPreset}
          modifier={activeModifier}
          servingSide={stats.servingSide}
          matchId={rushRunKey}
          ballSkinSetting={ballSkinSetting}
          onActiveBallSkinChange={setActiveBallSkin}
          actionTriggerRef={actionTriggerRef}
          onRallyUpdate={handleRallyUpdate}
          onPointFinished={handlePointFinished}
          onBonusScore={handleBonusScore}
          onCallout={handleAddCallout}
          superCharge={stats.superCharge}
          gameSpeedMultiplier={gameSpeedMultiplier}
          cameraFov={cameraFov}
          landingCircleStyle={landingCircleStyle}
          enableVfx={enableVfx}
          enableScreenShake={enableScreenShake}
        />
      )}

      {/* COZY CRAYON POST-PROCESSING VIGNETTE OVERLAY */}
      <div className="crayon-postfx fixed inset-0 z-10 pointer-events-none" />

      {/* CLEAN NORMAL WHITE FLOATING CALLOUT TEXT (Original crisp white text style!) */}
      {gameState === 'PLAYING' && showCallouts && gameMode !== 'obstacle_rush' && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
          {callouts.map((c) => (
            <div
              key={c.id}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              className="callout-float absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center"
            >
              <span
                className="font-display text-xl sm:text-3xl font-black tracking-wider uppercase text-white"
                style={{
                  textShadow: '0 2px 8px rgba(4,16,30,0.85)',
                }}
              >
                {c.text}
              </span>
              {c.subtext && (
                <span
                  className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-white/95 mt-0.5"
                  style={{
                    textShadow: '0 1px 6px rgba(4,16,30,0.85)',
                  }}
                >
                  {c.subtext}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen Tap-Only Very-Low-Opacity Joystick + Double-Tap Jump Layer for Gun Fight (Native 1:1 Screen Coordinates) */}
      {!isPortrait && gameState === 'PLAYING' && gameMode === 'obstacle_rush' && (
        <div
          onPointerDown={handleInvisibleJoyDown}
          onPointerMove={handleInvisibleJoyMove}
          onPointerUp={handleInvisibleJoyEnd}
          onPointerCancel={handleInvisibleJoyEnd}
          onLostPointerCapture={handleInvisibleJoyEnd}
          onContextMenu={event => event.preventDefault()}
          className="fixed inset-0 z-[15] pointer-events-auto touch-none select-none"
        >
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANEL 1: MAIN MENU (Non-Overlapping Responsive Layout for All Screens)*/}
      {/* ===================================================================== */}
      {gameState === 'TITLE_MENU' && (
        <div
          className={`title-screen fixed inset-0 z-30 flex flex-col justify-between ${
            isShortLandscape ? 'px-2.5 py-1.5' : 'p-2.5 sm:p-5 lg:p-7'
          } safe-pad pointer-events-none overflow-hidden`}
        >
          {/* TOP BAR: Left Player Card | Right Audio & Settings Studio Buttons */}
          <div className="flex items-center justify-between w-full gap-2.5 sm:gap-4 pointer-events-auto shrink-0">
            {/* Top-Left Player Profile Card with Athlete Stats */}
            <button aria-label="Open profile"
              onClick={() => {
                crayonAudio.playMenuClick();
                setGameState('PROFILE');
              }}
              className="title-player-card group flex items-center gap-2.5 sm:gap-3.5 bg-[#071D35]/95 hover:bg-[#0D2C4D] backdrop-blur-md border-2 border-[#38BDF8]/55 hover:border-[#38BDF8] rounded-2xl p-1.5 sm:p-2 pr-3.5 sm:pr-5 shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.16)] transition-all active:translate-y-0.5 active:shadow-[0_2px_0_#04101E] cursor-pointer min-w-0 max-w-[68%] sm:max-w-none"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8] border-2 border-white/90 flex items-center justify-center overflow-hidden shadow-md shrink-0 group-hover:scale-105 transition-transform">
                <ChibiCharacterPortrait
                  char={activePlayerChar}
                  outfitOverride={selectedOutfitId}
                  faceOverride={selectedFaceId}
                  size={42}
                />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs sm:text-base font-black text-white leading-tight tracking-tight truncate">
                    {playerName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-gradient-to-b from-[#BEF264] to-[#84CC16] border border-[#06182C] text-[#06182C] font-display text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 shadow-xs">
                    {activePlayerChar.name}
                  </span>
                </div>
                <div className="text-[10px] sm:text-xs font-bold text-[#7DD3FC] mt-0.5 truncate">
                  {activePlayerChar.title} ·{' '}
                  {gameMode === 'obstacle_rush'
                    ? activeRushMap.name
                    : gameMode === 'floor_is_lava'
                      ? activeLavaMap.name
                      : activeTheme.name}
                </div>
              </div>
            </button>

            {/* Audio and settings; fullscreen lives outside the game. */}
            <div className="title-audio flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Mute Toggle Button */}
              <button
                onClick={handleToggleMute}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#071D35]/95 hover:bg-[#0D2C4D] backdrop-blur-md border-2 border-[#38BDF8]/55 hover:border-[#38BDF8] flex items-center justify-center text-white shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.16)] transition-all active:translate-y-0.5 active:shadow-[0_2px_0_#04101E] cursor-pointer"
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#4ADE80]" />
                )}
              </button>

              {/* Settings Studio Button */}
              <button
                onClick={() => {
                  crayonAudio.playMenuClick();
                  setSettingsTab('gameplay');
                  setGameState('SETTINGS');
                }}
                className="flex items-center gap-2 px-3 sm:px-4 h-9 sm:h-11 rounded-xl bg-[#071D35]/95 hover:bg-[#0D2C4D] backdrop-blur-md border-2 border-[#38BDF8]/55 hover:border-[#38BDF8] text-white shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.16)] transition-all active:translate-y-0.5 active:shadow-[0_2px_0_#04101E] cursor-pointer"
                title="Open Game Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-[#FDE047]" />
                <span className="font-display text-xs font-black uppercase tracking-wider hidden sm:inline">
                  Settings
                </span>
              </button>
            </div>
          </div>

          {/* MAIN STAGE: Left/Right Columns on Wide (PC/Landscape) with Open Center; Top/Bottom on Portrait with Open Middle */}
          <div
            className={`title-main flex-1 min-h-0 flex ${
              isWideLayout
                ? 'flex-row items-center justify-between gap-2 px-0.5 sm:px-2'
                : 'flex-col items-center justify-between px-0.5 py-0.5'
            } w-full`}
          >
            {/* Top (Portrait) / Left (PC & Landscape): Bespoke 3D Emblem + Bottom-Left Custom Multiplayer Dock */}
            <div
              className={`title-column flex flex-col ${
                isWideLayout
                  ? 'items-start justify-between h-full py-0.5 w-[31%] max-w-[310px]'
                  : 'items-center justify-start pt-0.5 w-full'
              } select-none shrink-0`}
            >
              <div
                className={`${
                  isShortLandscape
                    ? 'w-36 sm:w-44'
                    : isWideLayout
                      ? 'w-48 sm:w-60 lg:w-72 xl:w-80 my-auto'
                      : 'w-40 sm:w-52'
                } pointer-events-none`}
              >
                <svg
                  viewBox="0 0 460 220"
                  className="w-full h-auto overflow-visible drop-shadow-[0_12px_20px_rgba(4,16,30,0.48)]"
                >
                  <defs>
                    <linearGradient id="sixgun_top_face" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="20%" stopColor="#FEF08A" />
                      <stop offset="62%" stopColor="#A3E635" />
                      <stop offset="100%" stopColor="#16A34A" />
                    </linearGradient>
                    <linearGradient id="sixgun_bevel_grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#15803D" />
                      <stop offset="100%" stopColor="#064E3B" />
                    </linearGradient>
                    <linearGradient id="sixgun_crown_grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FEF9C3" />
                      <stop offset="45%" stopColor="#FACC15" />
                      <stop offset="100%" stopColor="#EA580C" />
                    </linearGradient>
                    <linearGradient id="sixgun_ribbon_grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06182C" />
                      <stop offset="50%" stopColor="#0F294A" />
                      <stop offset="100%" stopColor="#06182C" />
                    </linearGradient>
                    <clipPath id="sixgun_top_shine">
                      <rect x="0" y="45" width="460" height="44" />
                    </clipPath>
                    <clipPath id="sixgun_ball_clip">
                      <circle cx="0" cy="0" r="23" />
                    </clipPath>
                    <radialGradient id="sixgun_ball_shade" cx="35%" cy="28%" r="70%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                      <stop offset="58%" stopColor="#FFFFFF" stopOpacity="0" />
                      <stop offset="100%" stopColor="#04101E" stopOpacity="0.35" />
                    </radialGradient>
                  </defs>

                  <g transform="rotate(-4 225 108)">
                    <path
                      d="M 28 66 L 398 54 L 382 140 L 14 146 Z"
                      fill="#04101E"
                      opacity="0.42"
                    />
                    <path
                      d="M 34 61 L 392 50 L 378 134 L 20 140 Z"
                      fill="#071D35"
                      stroke="#38BDF8"
                      strokeWidth="3"
                      strokeOpacity="0.55"
                    />

                    <g transform="translate(68, 46) rotate(-14)">
                      <path
                        d="M -26 14 L -32 -14 L -12 -2 L 0 -22 L 12 -2 L 32 -14 L 26 14 Z"
                        fill="#04101E"
                        stroke="#04101E"
                        strokeWidth="9"
                        strokeLinejoin="round"
                        transform="translate(0, 4)"
                      />
                      <path
                        d="M -26 14 L -32 -14 L -12 -2 L 0 -22 L 12 -2 L 32 -14 L 26 14 Z"
                        fill="url(#sixgun_crown_grad)"
                        stroke="#04101E"
                        strokeWidth="6"
                        strokeLinejoin="round"
                      />
                      <rect
                        x="-26"
                        y="9"
                        width="52"
                        height="8"
                        rx="4"
                        fill="#F59E0B"
                        stroke="#04101E"
                        strokeWidth="4.5"
                      />
                      <circle cx="0" cy="-23" r="4.5" fill="#FEF08A" stroke="#04101E" strokeWidth="3.2" />
                      <circle cx="-32" cy="-15" r="4" fill="#FEF08A" stroke="#04101E" strokeWidth="3.2" />
                      <circle cx="32" cy="-15" r="4" fill="#FEF08A" stroke="#04101E" strokeWidth="3.2" />
                      <circle cx="0" cy="4" r="3.4" fill="#EF4444" stroke="#04101E" strokeWidth="2" />
                      <circle cx="-13" cy="5.5" r="2.6" fill="#38BDF8" stroke="#04101E" strokeWidth="1.8" />
                      <circle cx="13" cy="5.5" r="2.6" fill="#38BDF8" stroke="#04101E" strokeWidth="1.8" />
                    </g>

                    {[12, 9, 6, 3].map((depthOffset) => (
                      <text
                        key={depthOffset}
                        x="210"
                        y={122 + depthOffset}
                        textAnchor="middle"
                        fontFamily="'Rubik', 'Outfit', sans-serif"
                        fontWeight="900"
                        fontStyle="italic"
                        fontSize="78"
                        letterSpacing="3"
                        paintOrder="stroke fill"
                        stroke="#04101E"
                        strokeWidth="17"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        fill="#04101E"
                      >
                        SIXZUN
                      </text>
                    ))}

                    <text
                      x="210"
                      y="126"
                      textAnchor="middle"
                      fontFamily="'Rubik', 'Outfit', sans-serif"
                      fontWeight="900"
                      fontStyle="italic"
                      fontSize="78"
                      letterSpacing="3"
                      paintOrder="stroke fill"
                      stroke="#04101E"
                      strokeWidth="15"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      fill="url(#sixgun_bevel_grad)"
                    >
                      SIXZUN
                    </text>

                    <text
                      x="210"
                      y="121"
                      textAnchor="middle"
                      fontFamily="'Rubik', 'Outfit', sans-serif"
                      fontWeight="900"
                      fontStyle="italic"
                      fontSize="78"
                      letterSpacing="3"
                      paintOrder="stroke fill"
                      stroke="#04101E"
                      strokeWidth="12"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      fill="url(#sixgun_top_face)"
                    >
                      SIXZUN
                    </text>

                    <text
                      x="210"
                      y="121"
                      textAnchor="middle"
                      fontFamily="'Rubik', 'Outfit', sans-serif"
                      fontWeight="900"
                      fontStyle="italic"
                      fontSize="78"
                      letterSpacing="3"
                      fill="rgba(255,255,255,0.32)"
                      clipPath="url(#sixgun_top_shine)"
                      style={{ pointerEvents: 'none' }}
                    >
                      SIXZUN
                    </text>

                    <g transform="translate(396, 86) rotate(12)">
                      <circle cx="0" cy="4.5" r="25" fill="#04101E" />
                      <g clipPath="url(#sixgun_ball_clip)">
                        <circle cx="0" cy="0" r="24" fill="#F8FAFC" />
                        <path
                          d="M -26 -12 Q 0 2 26 -12 L 26 2 Q 0 14 -26 2 Z"
                          fill="#38BDF8"
                          stroke="#04101E"
                          strokeWidth="3.2"
                        />
                        <path
                          d="M -24 13 Q 0 2 24 13 L 24 26 L -24 26 Z"
                          fill="#FACC15"
                          stroke="#04101E"
                          strokeWidth="3.2"
                        />
                        <path
                          d="M 0 -24 Q 9 0 -5 24"
                          fill="none"
                          stroke="#04101E"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                        />
                        <circle cx="0" cy="0" r="23.5" fill="url(#sixgun_ball_shade)" />
                      </g>
                      <circle
                        cx="0"
                        cy="0"
                        r="23"
                        fill="none"
                        stroke="#04101E"
                        strokeWidth="5"
                      />
                      <ellipse
                        cx="-7.5"
                        cy="-9.5"
                        rx="6.8"
                        ry="3.2"
                        transform="rotate(-25 -7.5 -9.5)"
                        fill="rgba(255,255,255,0.82)"
                      />
                    </g>

                    <g transform="translate(212, 166)">
                      <rect
                        x="-148"
                        y="-16"
                        width="296"
                        height="36"
                        rx="12"
                        fill="#04101E"
                        transform="translate(0, 5)"
                      />
                      <rect
                        x="-148"
                        y="-16"
                        width="296"
                        height="36"
                        rx="12"
                        fill="url(#sixgun_ribbon_grad)"
                        stroke="#38BDF8"
                        strokeWidth="3.2"
                      />
                      <circle cx="-126" cy="2" r="4" fill="#FACC15" />
                      <circle cx="126" cy="2" r="4" fill="#FACC15" />
                      <text
                        x="0"
                        y="9"
                        textAnchor="middle"
                        fontFamily="'Rubik', 'Outfit', sans-serif"
                        fontWeight="900"
                        fontSize="20"
                        letterSpacing="3.5"
                        fill="#FFFFFF"
                      >
                        BUMP · SET · SPIKE!
                      </text>
                    </g>
                  </g>
                </svg>
              </div>

              {/* BOTTOM-LEFT CUSTOM MULTIPLAYER DOCK (Styled to match Reference Image 3!) */}
              <div
                className={`title-custom pointer-events-auto ${
                  isWideLayout
                    ? `w-full mt-auto ${isShortLandscape ? 'p-2 gap-1.5 rounded-2xl' : 'p-3 gap-2.5 rounded-3xl'}`
                    : 'w-full max-w-[380px] mt-1 p-2 gap-1.5 rounded-2xl'
                } bg-[#051426]/95 backdrop-blur-md border border-[#38BDF8]/40 shadow-[0_8px_24px_rgba(2,8,23,0.75)] flex flex-col`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-display text-[11px] sm:text-xs font-black uppercase tracking-wider text-white truncate">
                      CUSTOM MULTIPLAYER
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#062C24] border border-emerald-400/50 font-display text-[8px] sm:text-[9px] font-black text-emerald-300 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {mpRoom ? mpRoom.code : mpConnected ? `${mpOnlineCount} ONLINE` : 'PLAY WITH FRIENDS'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#091E38] border border-[#38BDF8]/35 font-display text-[8px] font-black uppercase text-[#FACC15] shrink-0">
                    HOST STUDIO
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={roomCodeInput}
                    maxLength={6}
                    placeholder="E.G. K7X9P"
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && roomCodeInput.trim()) {
                        crayonAudio.playMenuClick();
                        await multiplayerClient.joinCustomRoom(roomCodeInput);
                        setGameState('CUSTOM_LOBBY');
                      }
                    }}
                    className={`flex-1 min-w-0 px-2.5 ${
                      isShortLandscape || !isWideLayout ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
                    } rounded-xl bg-[#041020] border border-[#38BDF8]/45 focus:border-[#84CC16] font-mono font-black uppercase tracking-widest text-slate-200 placeholder:text-slate-500 outline-none text-center`}
                  />
                  <button
                    onClick={async () => {
                      crayonAudio.playMenuClick();
                      if (roomCodeInput.trim()) {
                        await multiplayerClient.joinCustomRoom(roomCodeInput);
                      }
                      setGameState('CUSTOM_LOBBY');
                    }}
                    className={`px-3.5 ${
                      isShortLandscape || !isWideLayout ? 'py-1.5 text-[10px]' : 'py-2 text-xs'
                    } rounded-xl bg-gradient-to-b from-[#38BDF8] to-[#0284C7] hover:from-[#7DD3FC] hover:to-[#0369A1] font-display font-black uppercase text-white cursor-pointer active:translate-y-0.5 shrink-0`}
                  >
                    ENTER
                  </button>
                </div>

                <div className="custom-weather-row"><WeatherControl /><button
                  onClick={() => {
                    crayonAudio.playMenuClick();
                    multiplayerClient.refreshStateHttp();
                    setGameState('CUSTOM_LOBBY');
                  }}
                  className={`w-full ${
                    isShortLandscape || !isWideLayout ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
                  } rounded-xl bg-gradient-to-b from-[#FEF08A] via-[#BEF264] to-[#84CC16] hover:from-[#FEF9C3] hover:to-[#A3E635] border border-[#04101E] font-display font-black uppercase tracking-wider text-[#04101E] flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5 shadow-sm`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>CREATE CUSTOM ROOM</span>
                </button></div>
              </div>
            </div>

            {/* Center Open 3D Hero Showcase Window */}
            <div className="title-hero-space flex-1 min-h-0 pointer-events-none">
              {!showSplashScreen && <CharacterPreview3D character={activePlayerChar} animated />}
            </div>

            {/* Bottom (Portrait) / Right (PC & Landscape): 4-Mode Quick Switcher + PLAY + 3 Menu Bars */}
            <div
              className={`title-column flex flex-col ${
                isWideLayout
                  ? isShortLandscape
                    ? 'items-stretch justify-center gap-1.5 w-[34%] max-w-[320px]'
                    : 'items-stretch justify-center gap-2.5 w-[34%] max-w-[356px]'
                  : 'items-stretch gap-1.5 w-full max-w-[380px]'
              } pointer-events-auto shrink-0`}
            >
              {/* Clean 4-Mode Quick Switcher right above PLAY (Gun Fight | Nuke | 1v1 | 2v2) */}
              <div className="title-mode-switch w-full grid grid-cols-4 gap-1 bg-[#051527]/95 backdrop-blur-md border-2 border-[#38BDF8]/55 rounded-2xl p-1.5 shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.12)]">
                {(
                  [
                    {
                      id: 'rush',
                      label: 'GUN FIGHT',
                      active: gameMode === 'obstacle_rush',
                      onSelect: () => setGameMode('obstacle_rush'),
                    },
                    {
                      id: 'lava',
                      label: 'NUKE',
                      active: gameMode === 'floor_is_lava',
                      onSelect: () => setGameMode('floor_is_lava'),
                    },
                    {
                      id: '1v1',
                      label: '1V1',
                      active:
                        gameMode !== 'obstacle_rush' &&
                        gameMode !== 'floor_is_lava' &&
                        matchFormat === '1v1',
                      onSelect: () => {
                        if (
                          gameMode === 'obstacle_rush' ||
                          gameMode === 'floor_is_lava'
                        ) {
                          setGameMode('duo_2v2');
                        }
                        setMatchFormat('1v1');
                      },
                    },
                    {
                      id: '2v2',
                      label: '2V2',
                      active:
                        gameMode !== 'obstacle_rush' &&
                        gameMode !== 'floor_is_lava' &&
                        matchFormat === '2v2',
                      onSelect: () => {
                        if (
                          gameMode === 'obstacle_rush' ||
                          gameMode === 'floor_is_lava'
                        ) {
                          setGameMode('duo_2v2');
                        }
                        setMatchFormat('2v2');
                      },
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      crayonAudio.playMenuClick();
                      item.onSelect();
                    }}
                    className={`py-2 rounded-xl font-display text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer truncate px-1 ${
                      item.active
                        ? item.id === 'lava'
                          ? 'bg-gradient-to-b from-[#FDE047] via-[#FB923C] to-[#EA580C] text-[#04101E] border border-[#04101E] shadow-[0_2px_0_#04101E]'
                          : 'bg-gradient-to-b from-[#FEF08A] to-[#84CC16] text-[#04101E] border border-[#04101E] shadow-[0_2px_0_#04101E]'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Giant Arcade PLAY Button for Selected Mode & Arena */}
              <button
                onClick={() => handleStartMatch()}
                className={`title-play group relative w-full ${
                  isShortLandscape ? 'py-2.5 px-4' : 'py-3 sm:py-3.5 px-5'
                } rounded-2xl ${
                  gameMode === 'floor_is_lava'
                    ? 'bg-gradient-to-b from-[#FEF08A] via-[#FB923C] to-[#EA580C] hover:from-[#FEF9C3] hover:via-[#FDBA74] hover:to-[#F97316]'
                    : 'bg-gradient-to-b from-[#FEF08A] via-[#BEF264] to-[#65A30D] hover:from-[#FEF9C3] hover:via-[#D9F99D] hover:to-[#84CC16]'
                } border-[3px] border-[#04101E] shadow-[0_6px_0_#04101E] flex items-center justify-between gap-3 text-[#04101E] transition-all active:translate-y-1 active:shadow-[0_2px_0_#04101E] cursor-pointer overflow-hidden`}
              >
                <div className="pointer-events-none absolute inset-x-4 top-1.5 h-1.5 rounded-full bg-white/65" />
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#04101E]/15 border border-[#04101E]/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Play
                      className={`${
                        isShortLandscape ? 'w-5 h-5' : 'w-6 h-6'
                      } fill-[#04101E] text-[#04101E] ml-0.5`}
                    />
                  </div>
                  <div className="flex flex-col items-start leading-none min-w-0">
                    <span
                      className={`font-display ${
                        isShortLandscape ? 'text-base' : 'text-lg sm:text-2xl'
                      } font-black uppercase tracking-wide truncate`}
                    >
                      {gameMode === 'obstacle_rush'
                        ? 'PLAY GUN FIGHT'
                        : gameMode === 'floor_is_lava'
                          ? 'PLAY NUKE'
                          : `PLAY ${matchFormat}`}
                    </span>
                    <span className="font-display text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#04101E]/85 mt-1 truncate max-w-full">
                      {gameMode === 'obstacle_rush'
                        ? `${activeRushMap.name} · 4P Solo · ${rushTimerMinutes}:00`
                        : gameMode === 'floor_is_lava'
                          ? `${activeLavaMap.name} · 4P · 3 Rounds`
                          : `${activeTheme.name} · First to ${winScore}`}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#04101E] stroke-[3] shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 3 Menu Action Buttons: Vertical stack on PC/Landscape, 3-col row on Portrait */}
              <div
                className={`title-actions w-full grid ${
                  isWideLayout ? 'grid-cols-1 gap-2' : 'grid-cols-3 gap-2'
                }`}
              >
                {/* 1. MODES & MAPS */}
                <button
                  onClick={() => {
                    crayonAudio.playMenuClick();
                    setGameState('MODE_SELECT');
                  }}
                  className={`group w-full flex ${
                    isWideLayout
                      ? `flex-row items-center justify-between ${isShortLandscape ? 'px-3 py-2' : 'px-3.5 py-2.5'}`
                      : 'flex-col items-center justify-center px-2 py-2.5'
                  } rounded-2xl bg-[#071D35]/95 hover:bg-[#0D2C4D] backdrop-blur-md border-2 border-[#38BDF8]/50 hover:border-[#38BDF8] text-white shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.14)] transition-all active:translate-y-0.5 active:shadow-[0_2px_0_#04101E] cursor-pointer`}
                >
                  <div
                    className={`flex ${
                      isWideLayout ? 'flex-row items-center gap-3 min-w-0' : 'flex-col items-center gap-1.5'
                    }`}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0D2B4D] border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FACC15] fill-[#FACC15]" />
                    </div>
                    <div className={`${isWideLayout ? 'text-left min-w-0' : 'text-center'}`}>
                      <div
                        className={`font-display ${
                          isShortLandscape
                            ? 'text-xs'
                            : isWideLayout
                              ? 'text-xs sm:text-sm'
                              : 'text-[11px] sm:text-xs'
                        } font-black uppercase tracking-wider leading-tight truncate`}
                      >
                        MODES & MAPS
                      </div>
                      {isWideLayout && !isShortLandscape && (
                        <div className="text-[11px] font-bold text-[#7DD3FC] mt-0.5 truncate">
                          {gameMode === 'obstacle_rush'
                            ? `Gun Fight · ${activeRushMap.name}`
                            : gameMode === 'floor_is_lava'
                              ? `4P Nuke · ${activeLavaMap.name}`
                              : `${activeModeInfo.title} · ${activeTheme.name}`}
                        </div>
                      )}
                    </div>
                  </div>
                  {isWideLayout && (
                    <ChevronRight className="w-4 h-4 text-[#7DD3FC] group-hover:text-white group-hover:translate-x-0.5 transition-all stroke-[3] shrink-0" />
                  )}
                </button>

                {/* 2. CUSTOMIZE ATHLETE > */}
                <button
                  onClick={() => {
                    crayonAudio.playMenuClick();
                    setGameState('CHARACTER_SELECT');
                  }}
                  className={`group w-full flex ${
                    isWideLayout
                      ? `flex-row items-center justify-between ${isShortLandscape ? 'px-3 py-2' : 'px-3.5 py-2.5'}`
                      : 'flex-col items-center justify-center px-2 py-2.5'
                  } rounded-2xl bg-[#071D35]/95 hover:bg-[#0D2C4D] backdrop-blur-md border-2 border-[#38BDF8]/50 hover:border-[#38BDF8] text-white shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.14)] transition-all active:translate-y-0.5 active:shadow-[0_2px_0_#04101E] cursor-pointer`}
                >
                  <div
                    className={`flex ${
                      isWideLayout ? 'flex-row items-center gap-3 min-w-0' : 'flex-col items-center gap-1.5'
                    }`}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0D2B4D] border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#A3E635] fill-[#A3E635]" />
                    </div>
                    <div className={`${isWideLayout ? 'text-left min-w-0' : 'text-center'}`}>
                      <div
                        className={`font-display ${
                          isShortLandscape
                            ? 'text-xs'
                            : isWideLayout
                              ? 'text-xs sm:text-sm'
                              : 'text-[11px] sm:text-xs'
                        } font-black uppercase tracking-wider leading-tight truncate`}
                      >
                        CUSTOMIZE
                      </div>
                      {isWideLayout && !isShortLandscape && (
                        <div className="text-[11px] font-bold text-[#7DD3FC] mt-0.5 truncate">
                          {CRAYON_CHARACTERS.length} Athletes · Outfits & Faces
                        </div>
                      )}
                    </div>
                  </div>
                  {isWideLayout && (
                    <ChevronRight className="w-4 h-4 text-[#7DD3FC] group-hover:text-white group-hover:translate-x-0.5 transition-all stroke-[3] shrink-0" />
                  )}
                </button>

                {/* 3. GAME SETTINGS > */}
                <button
                  onClick={() => {
                    crayonAudio.playMenuClick();
                    setSettingsTab('gameplay');
                    setGameState('SETTINGS');
                  }}
                  className={`group w-full flex ${
                    isWideLayout
                      ? `flex-row items-center justify-between ${isShortLandscape ? 'px-3 py-2' : 'px-3.5 py-2.5'}`
                      : 'flex-col items-center justify-center px-2 py-2.5'
                  } rounded-2xl bg-[#071D35]/95 hover:bg-[#0D2C4D] backdrop-blur-md border-2 border-[#38BDF8]/50 hover:border-[#38BDF8] text-white shadow-[0_4px_0_#04101E,inset_0_1px_0_rgba(255,255,255,0.14)] transition-all active:translate-y-0.5 active:shadow-[0_2px_0_#04101E] cursor-pointer`}
                >
                  <div
                    className={`flex ${
                      isWideLayout ? 'flex-row items-center gap-3 min-w-0' : 'flex-col items-center gap-1.5'
                    }`}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0D2B4D] border border-[#38BDF8]/40 flex items-center justify-center shrink-0">
                      <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FDE047]" />
                    </div>
                    <div className={`${isWideLayout ? 'text-left min-w-0' : 'text-center'}`}>
                      <div
                        className={`font-display ${
                          isShortLandscape
                            ? 'text-xs'
                            : isWideLayout
                              ? 'text-xs sm:text-sm'
                              : 'text-[11px] sm:text-xs'
                        } font-black uppercase tracking-wider leading-tight truncate`}
                      >
                        SETTINGS
                      </div>
                      {isWideLayout && !isShortLandscape && (
                        <div className="text-[11px] font-bold text-[#7DD3FC] mt-0.5 truncate">
                          Difficulty · Camera · Audio
                        </div>
                      )}
                    </div>
                  </div>
                  {isWideLayout && (
                    <ChevronRight className="w-4 h-4 text-[#7DD3FC] group-hover:text-white group-hover:translate-x-0.5 transition-all stroke-[3] shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANEL 2: CUSTOMIZE SCREEN (Unobstructed 3D Podium + Clean Dock/Grid)  */}
      {/* ===================================================================== */}
      {gameState === 'CHARACTER_SELECT' && (
        <CharacterStudio character={activePlayerChar} selectedCharacter={selectedCharId}
          outfit={selectedOutfitId} face={selectedFaceId} head={selectedHeadShape}
          wide={isWideLayout}
          onCharacter={handleSelectCharacter} onOutfit={setSelectedOutfitId}
          onFace={(face, head) => { setSelectedFaceId(face); setSelectedHeadShape(head); }}
          onHead={setSelectedHeadShape}
          onBack={() => setGameState('TITLE_MENU')}
          portrait={(character, face, head) => <ChibiCharacterPortrait char={character} faceOverride={face} headShapeOverride={head} size={60} />}
          outfitPreview={outfit => <OutfitPreviewSvg outfit={outfit} />}
        />
      )}

      {/* ===================================================================== */}
      {/* PANEL 3: SELECT MODE & ARENA / MAP (Gun Fight, Dodgeball & Volleyball)*/}
      {/* ===================================================================== */}
      {gameState === 'MODE_SELECT' && (
        <ModesAndMaps
          mode={gameMode} difficulty={difficulty} duration={rushTimerMinutes} winScore={winScore} matchFormat={matchFormat}
          maps={gameMode === 'obstacle_rush'
            ? OBSTACLE_RUSH_MAPS.map(map => ({ id: map.id, name: map.name, subtitle: map.subtitle, preview: <RushMapThumbnailPreview rushMap={map} view="ingame" /> }))
            : gameMode === 'floor_is_lava'
              ? FLOOR_IS_LAVA_MAPS.map(map => ({ id: map.id, name: map.name, subtitle: map.environmentTag, preview: <LavaMapThumbnailPreview lavaMap={map} /> }))
              : modeAvailableThemes.slice(0, 6).map(map => ({ id: map.id, name: map.name, subtitle: '', preview: <MapThumbnailPreview theme={map} /> }))}
          selectedMap={gameMode === 'obstacle_rush' ? selectedRushMapId : gameMode === 'floor_is_lava' ? selectedLavaMapId : selectedThemeId}
          autoMap={gameMode !== 'obstacle_rush' && gameMode !== 'floor_is_lava' && autoVolleyballMap}
          onAutoMap={setAutoVolleyballMap}
          onMode={id => {
            const mode = SUB_GAMES_LIST.find(item => item.id === id);
            if (!mode) return;
            crayonAudio.playMenuClick(); setGameMode(id);
            if (id === 'survival') setMatchFormat('1v1');
            if (id === 'hoop_volley') setMatchFormat('2v2');
            if (id !== 'obstacle_rush' && id !== 'floor_is_lava' && mode.modeThemes.length && !mode.modeThemes.includes(selectedThemeId)) setSelectedThemeId(mode.defaultTheme);
          }}
          onMap={id => {
            crayonAudio.playMenuClick();
            if (gameMode === 'obstacle_rush') { const map = OBSTACLE_RUSH_MAPS.find(map => map.id === id); if (map) setSelectedRushMapId(map.id); }
            else if (gameMode === 'floor_is_lava') { const map = FLOOR_IS_LAVA_MAPS.find(map => map.id === id); if (map) setSelectedLavaMapId(map.id); }
            else { const map = COURT_THEMES.find(map => map.id === id); if (map) { setAutoVolleyballMap(false); setSelectedThemeId(map.id); } }
          }}
          onDifficulty={setDifficulty} onDuration={setRushTimerMinutes} onWinScore={setWinScore} onFormat={setMatchFormat}
          onBack={() => { crayonAudio.playMenuClick(); setGameState('TITLE_MENU'); }}
          onPlay={() => handleStartMatch()}
          ballSkinControl={gameMode !== 'obstacle_rush' && gameMode !== 'floor_is_lava' ? <button className="menu-ball-skin" onClick={handleCycleBallSkinSetting} aria-label="Change ball skin"><BallSkinSwatchIcon skin={ballSkinSetting === 'auto' ? activeBallSkin : BALL_SKINS.find(skin => skin.id === ballSkinSetting) || BALL_SKINS[0]} size={20} /><span>{ballSkinSetting === 'auto' ? 'Automatic ball skin' : (BALL_SKINS.find(skin => skin.id === ballSkinSetting)?.name ?? 'Ball skin')}</span></button> : undefined}
        />
      )}

      {gameState === 'CUSTOM_LOBBY' && (
        <CustomLobby
          client={multiplayerClient} connected={mpConnected} room={mpRoom} rooms={mpPublicRooms}
          error={mpError} playerName={playerName} selectedCharacter={selectedCharId}
          mic={mpMicEnabled} listen={mpListenEnabled} speaking={mpIsSpeaking}
          maps={{
            obstacle_rush: OBSTACLE_RUSH_MAPS.map(map => ({ id: map.id, name: map.name, subtitle: map.subtitle, preview: <RushMapThumbnailPreview rushMap={map} view="ingame" /> })),
            floor_is_lava: FLOOR_IS_LAVA_MAPS.map(map => ({ id: map.id, name: map.name, subtitle: map.environmentTag, preview: <LavaMapThumbnailPreview lavaMap={map} /> })),
            volleyball_1v1: COURT_THEMES.slice(0, 6).map(map => ({ id: map.id, name: map.name, subtitle: '', preview: <MapThumbnailPreview theme={map} /> })),
            volleyball_2v2: COURT_THEMES.slice(0, 6).map(map => ({ id: map.id, name: map.name, subtitle: '', preview: <MapThumbnailPreview theme={map} /> })),
          }}
          renderPortrait={slot => <ChibiCharacterPortrait char={{ ...(CRAYON_CHARACTERS.find(c => c.id === slot.charId) || CRAYON_CHARACTERS[0]), outfitId: slot.outfitId, faceId: slot.faceId }} size={76} />}
          onCharacter={handleSelectCharacter}
          onName={() => { setNameInputDraft(playerName); setHasConfirmedName(false); }}
          onBack={() => setGameState('TITLE_MENU')}
          onDismissError={() => { multiplayerClient.lastError = null; setMpError(null); }}
          onResume={() => setGameState('PLAYING')}
        />
      )}

      {/* ===================================================================== */}
      {/* PANEL 4: IN-GAME HUD (Gun Fight, 12P Floor is Lava & Volleyball)      */}
      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* PANEL 4: COMPACT PURE-GLASSMORPHIC IN-GAME HUD (Non-Colorful, Smaller)*/}
      {/* ===================================================================== */}
      {gameState === 'PLAYING' && (
        <div className="gameplay-hud fixed inset-0 z-30 flex flex-col justify-between p-2 sm:p-3 safe-pad pointer-events-none">
          {/* TOP BAR: Compact Neutral Frosted Glassmorphic HUD */}
          <div className="gameplay-topbar relative z-10">
            {/* Top-Left: Compact Glassmorphic Audio + Voice Mic Controls */}
            <div className="hud-audio pointer-events-auto flex items-center">
              <button
                onClick={handleToggleMute}
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="w-8 h-8 rounded-xl bg-slate-950/40 hover:bg-slate-900/55 border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center text-white/90 backdrop-blur-md cursor-pointer transition-all active:scale-95"
              >
                {muted ? (
                  <VolumeX className="w-3.5 h-3.5 text-white/70" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                )}
              </button>

              <VoiceMicControl inRoom={Boolean(mpRoom)} enabled={mpMicEnabled} speaking={mpIsSpeaking} />
            </div>

            {/* Top-Center Compact Pure Glassmorphic HUD by Active Mode */}
            {gameMode === 'obstacle_rush' ? (
              <GunFightScore hud={rushHud} />
            ) : gameMode === 'floor_is_lava' ? (
              /* Dodgeball / Nuke HUD: ONLY Round & Active Players in Pure Compact Glassmorphic Style (NO Health Bar!) */
              <div className="hud-nuke flex flex-col items-center gap-1">
                <div className="hud-pill flex items-center justify-center rounded-xl bg-slate-950/40 border border-white/20 text-white">
                  <span className="font-display text-[11px] sm:text-xs font-black uppercase tracking-wider text-white shrink-0">
                    {lavaHud.isExtraRound
                      ? 'FINAL DUEL'
                      : `ROUND ${lavaHud.currentRound ?? 1}/${lavaHud.maxRounds ?? 3}`}
                  </span>

                  <div className="w-px h-3.5 bg-white/25 shrink-0" />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Users className="w-3.5 h-3.5 text-white/85" />
                    <span className="font-display text-[11px] sm:text-xs font-black uppercase tracking-wider text-white tabular-nums">
                      {lavaHud.aliveCount ?? 4}/{lavaHud.roundStandings?.length || 4} ACTIVE
                    </span>
                  </div>
                </div>

                {lavaHud.eliminationBanner && (
                  <div className="hud-banner px-3 py-0.5 rounded-full bg-slate-950/45 border border-white/20 font-display text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                    {lavaHud.eliminationBanner}
                  </div>
                )}
              </div>
            ) : (
              /* Compact Pure Glassmorphic Volleyball Scoreboard */
              <div className="hud-pill hud-volleyball flex items-center rounded-xl bg-slate-950/40 border border-white/20 text-white">
                <div className="flex items-center gap-1.5 min-w-0">
                  {stats.servingSide === 'player' && (
                    <span
                      title="Your Serve"
                      className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#FFFFFF] shrink-0"
                    />
                  )}
                  <span className="font-display text-[11px] sm:text-xs font-black uppercase text-white truncate max-w-[68px] sm:max-w-[110px]">
                    {playerName}
                  </span>
                </div>

                <div className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/20 font-display text-sm sm:text-base font-black tracking-wider shrink-0 tabular-nums text-white">
                  <span>{stats.playerScore}</span>
                  <span className="text-white/70 mx-1">:</span>
                  <span>{stats.aiScore}</span>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-display text-[11px] sm:text-xs font-black uppercase text-white truncate max-w-[68px] sm:max-w-[110px]">
                    {activeOpponentChar.name}
                  </span>
                  {stats.servingSide === 'ai' && (
                    <span
                      title="Rival Serve"
                      className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#FFFFFF] shrink-0"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Top-Right: Compact Glassmorphic Pause Button */}
            <div className="hud-pause pointer-events-auto flex items-center">
              <button
                onClick={() => {
                  crayonAudio.playMenuClick();
                  setGameState('PAUSED');
                }}
                title="Pause Match"
                aria-label="Pause match"
                className="w-8 h-8 rounded-xl bg-slate-950/40 hover:bg-slate-900/55 border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center text-white backdrop-blur-md cursor-pointer shrink-0 transition-all active:scale-95"
              >
                <Pause className="w-3.5 h-3.5 fill-white text-white" />
              </button>
            </div>
          </div>

          {/* Center Numeric Pure Glassmorphic Countdown */}
          {((gameMode === 'obstacle_rush' && rushHud.countdown > 0) ||
            (gameMode === 'floor_is_lava' && lavaHud.countdown > 0)) && (
            <div className="relative z-10 flex items-center justify-center my-auto">
              <div className="w-16 h-16 rounded-2xl bg-slate-950/40 border border-white/25 shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl flex items-center justify-center">
                <span className="font-display text-4xl font-black text-white">
                  {gameMode === 'floor_is_lava' ? lavaHud.countdown : rushHud.countdown}
                </span>
              </div>
            </div>
          )}

          {/* Bottom Spacer */}
          <div />
        </div>
      )}

      {/* ===================================================================== */}
      {gameState === 'PLAYING' && matchTransition && <div className="match-start-banner" role="status"><strong>{matchTransition.title}</strong><span>{matchTransition.subtitle}</span></div>}

      {/* ===================================================================== */}
      {/* REAL-TIME LAUNCH PLAYER CALLSIGN / NAME ENTRY MODAL                   */}
      {/* ===================================================================== */}
      {!hasConfirmedName && !showSplashScreen && <NameEntry
        name={nameInputDraft} height={viewport.h} touch={isTouchDevice}
        portrait={<ChibiCharacterPortrait char={activePlayerChar} outfitOverride={selectedOutfitId} faceOverride={selectedFaceId} size={68} />}
        onName={setNameInputDraft}
        onConfirm={() => {
          const clean = nameInputDraft.trim().slice(0, 16) || 'LEO_PRO';
          crayonAudio.playMenuClick();
          setPlayerName(clean);
          try { localStorage.setItem('sixgun_player_name', clean); localStorage.setItem('sixgun_name_confirmed_v1', '1'); } catch {}
          multiplayerClient.syncProfile(clean, selectedCharId, selectedOutfitId, selectedFaceId);
          setHasConfirmedName(true);
        }}
      />}

      {/* ===================================================================== */}
      {/* PAUSE MODAL (True Frosted Glassmorphism)                              */}
      {/* ===================================================================== */}
      {gameState === 'PAUSED' && (
        <PausePanel
          mapName={gameMode === 'obstacle_rush' ? activeRushMap.name : gameMode === 'floor_is_lava' ? activeLavaMap.name : activeTheme.name}
          onResume={() => { crayonAudio.playMenuClick(); setGameState('PLAYING'); }}
          onMenu={() => { crayonAudio.playMenuClick(); setGameState('TITLE_MENU'); }}
          onControls={() => setReplayControls(true)}
        />
      )}

      {gameState === 'PROFILE' && <ProfilePanel height={viewport.h} name={playerName} characterName={activePlayerChar.name} characterTitle={activePlayerChar.title} character={activePlayerChar} onName={setPlayerName} onBack={() => { crayonAudio.playMenuClick(); setGameState('TITLE_MENU'); }} />}

      {gameState === 'SETTINGS' && (
        <GameSettings mode={gameMode} initialTab={settingsTab}
          onControls={() => setReplayControls(true)}
          values={{ matchFormat, winScore, duration: rushTimerMinutes, difficulty, tempo: gameSpeedMultiplier, modifier: activeModifier, fov: cameraFov, landingRing: landingCircleStyle, vfx: enableVfx, shake: enableScreenShake, callouts: showCallouts, muted, music: musicVol, sfx: sfxVol }}
          onChange={handleSettingsChange}
          onBack={() => { crayonAudio.playMenuClick(); setGameState('TITLE_MENU'); }}
          onReset={() => {
            crayonAudio.playMenuClick();
            handleSettingsChange({ matchFormat: '2v2', winScore: 5, duration: 3, difficulty: 'breezy', tempo: 1, modifier: 'none', fov: 45, landingRing: 'classic', vfx: true, shake: true, callouts: true, muted: false, music: 30, sfx: 80 });
            setCameraPreset('dynamic_follow');
          }}
        />
      )}

      {gameState === 'GAME_OVER' && (
        <MatchResults
          stats={stats} mode={gameMode} playerName={playerName} opponentName={resultRivalName}
          playerPortrait={<ChibiCharacterPortrait char={matchCharacters.player} size={94} />}
          opponentPortrait={<ChibiCharacterPortrait char={resultRivalChar} size={94} />}
          playerPartner={gameMode !== 'obstacle_rush' && gameMode !== 'floor_is_lava' && is2v2Match ? { name: roomPartner?.playerName || activePartnerChar.name, portrait: <ChibiCharacterPortrait char={{ ...activePartnerChar, ...(roomPartner ? { outfitId: roomPartner.outfitId, faceId: roomPartner.faceId } : {}) }} size={32} /> } : undefined}
          opponentPartner={gameMode !== 'obstacle_rush' && gameMode !== 'floor_is_lava' && is2v2Match ? { name: roomRivals[1]?.playerName || activeOpponentPartnerChar.name, portrait: <ChibiCharacterPortrait char={{ ...activeOpponentPartnerChar, ...(roomRivals[1] ? { outfitId: roomRivals[1].outfitId, faceId: roomRivals[1].faceId } : {}) }} size={32} /> } : undefined}
          onRestart={handleRestartMatch}
          roomCode={mpRoom?.code}
          leaving={leavingResultRoom}
          onMenu={() => void handleResultExit()}
        />
      )}

      {showControls && !needsLandscape && !showSplashScreen && <GameTutorial key={controlFamily} mode={controlMode} onClose={closeControls} />}
      {showSplashScreen && <LoadingScreen progress={loadingProgress} onReady={handleLoadingReady} />}
    </div>
    {needsLandscape && <LandscapePrompt />}
    <FullscreenControl autoHide={gameState === 'PLAYING' && !needsLandscape} />
    </>
  );
}

export default App;
