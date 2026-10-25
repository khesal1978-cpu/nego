import type { TouchGameActions } from './touchControlLayout';
import { createFramePacer } from '../three/framePacing';
import { createWeather } from '../three/weather';
import { remoteMovement } from '../network/playerControl';
import { applyNumericState, createMatchSync, numericState } from '../network/matchSync';
import { createMasonryTexture, createFortGate } from '../three/fortDetail';
import { batchStaticScenery, disposeSceneGeometry, freezeStaticWorldTransforms, updateCharacterGroundShadow } from '../three/scenePerformance';
import { approachingThreat, reactionChance } from './enemyBehavior';
import { createBloodFeedback } from '../three/combatFeedback';
import { createCharacterRagdolls } from '../three/characterRagdoll';
import { assistedNukeDirection, movementBlend, nukeAimPoint, nukeThrowVelocity, advanceNukeThrow, nukeLookDelta, nukeRoundSurvivors, nukeAimAssistStep, nukeHitAllowed, NUKE_HIT_RADIUS, NUKE_AIM_ACQUIRE, NUKE_AIM_RELEASE } from './nukeControls';
import { createOverheadHealthBar, hitHealthVisible, updateOverheadHealth } from '../three/overheadHealth';
import { NUKE_FLOOR_RADIUS, clampToNukeArena, bounceAtNukeBoundary, nukeSpawnPosition } from './nukeArena';
import { createRoundNukeFloorGeometry, createRoundNukeFloorTexture } from '../three/roundArenaGeometry';
import { createNukeStadium } from '../three/nukeStadium';
import { compactNukeCoast } from '../three/nukeLandscape';
import { applyExteriorFog } from '../three/exteriorFog';
import { arenaPalette } from '../three/arenaPalette';
import { getCrayonPaperTexture } from '../three/crayonMaterials';
import { renderMapPreview } from '../three/mapPreview';
import { createArenaMedkit } from '../three/arenaProps';
import { smoothRemotePosition, useHostMotion } from '../network/remoteMotion';
import { stepCharacterSpring } from '../three/characterSpring';
import { createNukeTouchActions } from './nukeTouchControls';
import { beginNukeDodge, nukeDodgeDirection } from './nukeControls';
import { characterSceneKey } from '../three/characterSceneKey';
import { createNukeHealthKits, updateNukeHealthKits, collectNukeHealthKit, NUKE_KIT_SPOTS } from './nukeHealthKits';
import { createFortCoastShape, createFortSurfGeometry, createFortHills, createFortSurfaceTexture, applyFortMasonryScale } from '../three/gunFightEnvironment';
import React, { useEffect, useRef } from 'react';
import { createCombatVisualPool, createImpactGate } from '../three/combatVisualPool';
import { createMotionTrail } from '../three/motionTrail';
import * as THREE from 'three';
import {
  AIDifficulty,
  CameraPreset,
  CharacterConfig,
  CHARACTER_OUTFITS,
  CRAYON_CHARACTERS,
  DIFFICULTY_LEVELS,
  FloorIsLavaMapId,
  FLOOR_IS_LAVA_MAPS,
  GameState,
} from '../types/game';
import {
  createCrayonCharacter,
  createLushGrassBorderCluster,
  createSculptedAlpineMountainPeak,
  createStylizedSkyVehicle,
} from '../three/crayonModels';
import {
  addCrayonOutline,
  createCourtFloorTexture,
  createCrayonToonMaterial,
  createCrayonWoodTexture,
  createLushGrassTurfTexture,
  createStylizedRoofTileTexture,
  createStylizedSkyDomeTexture,
  createStylizedStoneWallTexture,
  createStylizedWaterTexture,
  createWaterfallStreamTexture,
  getToonGradientMap,
} from '../three/crayonMaterials';
import { createStylizedPostPipeline } from '../three/postProcessing';
import { crayonAudio } from '../audio/crayonAudio';
import { CustomSlotInfo, multiplayerClient } from '../network/multiplayerClient';

export interface FloorIsLavaHudState {
  countdown: number;
  aliveCount: number;
  totalPlayers: number;
  survivalTimeSec: number;
  timeRemainingSec?: number;
  playerLives?: number;
  playerHp?: number;
  playerMaxHp?: number;
  blueAliveCount?: number;
  redAliveCount?: number;
  playerKills?: number;
  holdingBallType?: 'none' | 'crimson' | 'gold' | 'turbo';
  superReady?: boolean;
  currentRound?: number;
  maxRounds?: number;
  isExtraRound?: boolean;
  playerRoundWins?: number;
  roundStandings?: Array<{
    id: string;
    name: string;
    roundWins: number;
    kills: number;
    hp?: number;
    maxHp?: number;
    alive: boolean;
    isPlayer: boolean;
    colorHex: string;
  }>;
  lavaLevelMeters: number;
  lavaWarningState: 'STABLE' | 'RISING!' | 'ERUPTING!';
  tilesCrumbled: number;
  currentTier: number;
  eliminationBanner: string | null;
}

interface FloorIsLavaCanvasProps {
  actionTriggerRef?: React.MutableRefObject<TouchGameActions>;
  onPreview?: (image: string) => void;
  gameState: GameState;
  playerCharacter: CharacterConfig;
  playerDisplayName?: string;
  customSlots?: CustomSlotInfo[];
  aiDifficulty: AIDifficulty;
  cameraPreset: CameraPreset;
  lavaMapId?: FloorIsLavaMapId;
  matchDurationSec?: number;
  gameSpeedMultiplier?: number;
  cameraFov?: number;
  onHudUpdate: (hud: FloorIsLavaHudState) => void;
  onCallout?: (text: string, color?: string) => void;
  onGameOver: (
    winner: 'player' | 'ai',
    stats: {
      playerScore: number;
      aiScore: number;
      bestRally: number;
      perfectSpikes: number;
      lastPointWinner: 'player' | 'ai';
      lastPointReason: string;
      raceTimeSec: number;
      raceMaxFalls: number;
      raceProgressPct: number;
      nukeStandings: NonNullable<import('../types/game').MatchStats['nukeStandings']>;
    }
  ) => void;
}

type DodgeballKind = 'crimson' | 'gold' | 'turbo';

interface DodgeballObject {
  id: number;
  kind: DodgeballKind;
  mesh: THREE.Group;
  ballSphere: THREE.Mesh;
  floorRing: THREE.Mesh;
  beaconArrow: THREE.Mesh;
  trailMeshes: THREE.Mesh[];
  motionTrail: ReturnType<typeof createMotionTrail>;
  state: 'free' | 'held' | 'thrown';
  holderId: string | null;
  targetId: string | null;
  isSuperThrow: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  homeX: number;
  homeZ: number;
  idleTimer: number;
  pickupCooldown: number;
  lastHitVictimId: string | null;
}

interface DodgeballAthlete {
  id: string;
  name: string;
  colorHex: string;
  isPlayer: boolean;
  config: CharacterConfig;
  rig: ReturnType<typeof createCrayonCharacter>;
  group: THREE.Group;
  hpBarBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  heldBallId: number | null;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  x: number;
  y: number;
  z: number;
  visualY: number;
  vx: number;
  vy: number;
  vz: number;
  knockVx: number;
  knockVz: number;
  grounded: boolean;
  hp: number;
  maxHp: number;
  eliminated: boolean;
  roundWins: number;
  kills: number;
  hitsScored: number;
  catchesMade: number;
  superCharge: number;
  throwSwingTimer: number;
  dodgeCooldown: number;
  dodgeActiveTimer: number;
  catchWindowTimer: number;
  invulnTimer: number;
  hitFlashTimer: number;
  facingYaw: number;
  targetYaw: number;
  walkCycle: number;
  jiggleY: number;
  jiggleVelY: number;
  jiggleRoll: number;
  jiggleVelRoll: number;
  aiThinkTimer: number;
  aiHoldTimer: number;
  aiStrafeDir: number;
  aiRole: 'rusher' | 'flanker' | 'tactician';
  aiGoalX: number;
  aiGoalZ: number;
  aiGoalTimer: number;
  aiThrowDelay: number;
  aiSpeedVar: number;
  aiSpeedTrait?: number;
  slotIndex?: number;
  remotePlayerId?: string | null;
  lastRemoteTickAt?: number;
}

interface VfxBurst {
  mesh: THREE.Object3D;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  kind: 'ring' | 'star' | 'blood_drop' | 'blood_mist' | 'blood_splat';
  floorY?: number;
}

function createCleanToonMaterial(hexColor: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(hexColor),
    gradientMap: getToonGradientMap(),
  });
}

const nukeStoneTexCache = new Map<string, THREE.CanvasTexture>();

/**
 * Smooth, Zero-Glitter Hand-Inked Stone Wall Texture (No procedural grain or mipmap shimmer!)
 */
const createCleanCastleStoneTexture = createMasonryTexture;

function createRoundedRectShape(
  width: number,
  height: number,
  radius: number
): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createDodgeballTexture(
  primaryHex: string,
  stripeHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 256, 256);

    // Classic Pro Nuke Equatorial Core Band & Seam Lines
    ctx.fillStyle = stripeHex;
    ctx.fillRect(0, 102, 256, 52);

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 102);
    ctx.lineTo(256, 102);
    ctx.moveTo(0, 154);
    ctx.lineTo(256, 154);
    ctx.stroke();

    // Grip Dimple Dots
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    for (let x = 24; x < 256; x += 48) {
      ctx.beginPath();
      ctx.arc(x, 62, 9, 0, Math.PI * 2);
      ctx.arc(x, 194, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function lerpAngleShortest(a: number, b: number, t: number): number {
  const diff =
    THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + diff * t;
}

export const FloorIsLavaCanvas: React.FC<FloorIsLavaCanvasProps> = ({
  actionTriggerRef,
  gameState,
  playerCharacter,
  onPreview,
  playerDisplayName,
  customSlots,
  aiDifficulty,
  lavaMapId = 'volcano_summit',
  matchDurationSec = 180,
  gameSpeedMultiplier = 1.0,
  cameraFov = 45,
  onHudUpdate,
  onCallout,
  onGameOver,
}) => {
  const crosshairRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  const speedMultRef = useRef<number>(gameSpeedMultiplier);
  speedMultRef.current = gameSpeedMultiplier;

  const fovRef = useRef<number>(cameraFov);
  fovRef.current = cameraFov;

  const onHudUpdateRef = useRef(onHudUpdate);
  onHudUpdateRef.current = onHudUpdate;

  const onCalloutRef = useRef(onCallout);
  onCalloutRef.current = onCallout;

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Controls:
  // Left Half = Floating Movement Joystick | Right Half / Mouse = Screen Rotation (camYaw & camPitch) + Throw/Catch
  const joystickRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const rightActionQueuedRef = useRef<boolean>(false);
  const dodgeQueuedRef = useRef<boolean>(false);
  const jumpQueuedRef = useRef<boolean>(false);
  const screenHeldRef = useRef<boolean>(false);
  const camYawOffsetRef = useRef<number>(0);
  const camPitchOffsetRef = useRef<number>(0.18);

  const joyContainerRef = useRef<HTMLDivElement | null>(null);
  const inputSurfaceRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);

  const joyPointerIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookPointerRef = useRef<{
    id: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    maxDrag: number;
    downTime: number;
  }>({
    id: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    maxDrag: 0,
    downTime: 0,
  });
  const lastMousePosRef = useRef<{ x: number; y: number; initialized: boolean }>({
    x: 0,
    y: 0,
    initialized: false,
  });
  const touchActionsRef = useRef<ReturnType<typeof createNukeTouchActions> | null>(null);
  if (!touchActionsRef.current) touchActionsRef.current = createNukeTouchActions(
    () => { if (gameStateRef.current === 'PLAYING') rightActionQueuedRef.current = true; },
    () => { if (gameStateRef.current === 'PLAYING') dodgeQueuedRef.current = true; }
  );
  useEffect(() => { touchActionsRef.current?.reset(); return () => touchActionsRef.current?.reset(); }, [gameState]);

  // Compact Pro-Shooter Micro Crosshair Refs

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mapConfig =
      FLOOR_IS_LAVA_MAPS.find((m) => m.id === lavaMapId) ||
      FLOOR_IS_LAVA_MAPS[0];
    const isJungleMap = mapConfig.id === 'hex_colosseum';

    const diffObj =
      DIFFICULTY_LEVELS.find((d) => d.id === aiDifficulty) ||
      DIFFICULTY_LEVELS[1];

    const width = container.clientWidth || window.innerWidth;
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    const scene = new THREE.Scene();
    const fogHex = arenaPalette(isJungleMap).fog;
    scene.background = new THREE.Color(fogHex);
    scene.fog = new THREE.FogExp2(fogHex, 0.0036);

    const camera = new THREE.PerspectiveCamera(
      fovRef.current,
      width / height,
      0.5,
      260
    );
    camera.position.set(0, 6.8, 16.5);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // Edge smoothing is handled once, in the post pipeline.
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(width, height);
    renderer.setPixelRatio(1); // Live quality settings set the final framebuffer size.
    // Five percent wider framing keeps the same character and collision scale.
    camera.zoom = onPreview ? 1 : .95;
    camera.updateProjectionMatrix();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;

    const maxAnisotropy = Math.min(
      16,
      renderer.capabilities.getMaxAnisotropy() || 8
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    let frameNeedsRender = true;
    const postPipeline = createStylizedPostPipeline(
      renderer,
      scene,
      camera,
      width,
      height,
      {
        bloomStrength: 0.2,
        bloomRadius: 0.4,
        bloomThreshold: 0.88,
        vignetteIntensity: 0.08, colorGrade: true, preview: Boolean(onPreview), saturation: 1.1, contrast: 1.025,
      }
    );

    // 3D Stylized Painted Sky Dome with Sunbeams & Cirrus Clouds
    const skyTexture = createStylizedSkyDomeTexture(
      isJungleMap ? '#0284C7' : '#1D4ED8',
      isJungleMap ? '#A7F3D0' : '#93C5FD',
      '#FEF08A'
    );
    const skyDomeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(230, 24, 16),
      new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    skyDomeMesh.position.y = -8;
    scene.add(skyDomeMesh);

    // Cool sky fill and directional daylight.
    const hemiLight = new THREE.HemisphereLight(
      isJungleMap ? 0xdcfce7 : 0xcbd5e1,
      isJungleMap ? 0x15803d : 0x64748b,
      0.88
    );
    hemiLight.position.set(0, 32, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xf8fafc, 1.26);
    dirLight.position.set(22, 46, 28);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 130;
    const d = 32;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    // Separate the shadow lookup from nearly coplanar masonry surfaces.
    dirLight.shadow.bias = -0.0006;
    dirLight.shadow.normalBias = 0.065;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x8acfe4, 0.3);
    rimLight.position.set(-26, 22, -22);
    scene.add(rimLight);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Filtered textures and cel-shaded materials.
    const castleWallMat = new THREE.MeshToonMaterial({
      map: createCleanCastleStoneTexture(
        isJungleMap ? '#78716C' : '#94A3B8',
        isJungleMap ? '#44403C' : '#475569'
      ),
      gradientMap: getToonGradientMap(),
    });
    const darkStoneMat = new THREE.MeshToonMaterial({
      map: createCleanCastleStoneTexture(
        isJungleMap ? '#57534E' : '#64748B',
        isJungleMap ? '#292524' : '#334155'
      ),
      gradientMap: getToonGradientMap(),
    });
    const warmStoneMat = new THREE.MeshToonMaterial({
      map: createCleanCastleStoneTexture(
        isJungleMap ? '#A8A29E' : '#CBD5E1',
        isJungleMap ? '#57534E' : '#64748B'
      ),
      gradientMap: getToonGradientMap(),
    });

    const foliage1 = createCleanToonMaterial(isJungleMap ? '#398459' : '#5AAB72');
    const foliage2 = createCleanToonMaterial(isJungleMap ? '#24694B' : '#388359');
    const woodMat = createCleanToonMaterial('#854D0E');
    const alpineRockMat = createCleanToonMaterial(isJungleMap ? '#57534E' : '#475569');
    const lightGraniteMat = createCleanToonMaterial(isJungleMap ? '#78716C' : '#64748B');
    const islandGrassTex = getCrayonPaperTexture(
      isJungleMap ? '#56886A' : '#689C77',
      maxAnisotropy,
      1 / 7
    );
    islandGrassTex.generateMipmaps = true;
    islandGrassTex.minFilter = THREE.LinearMipmapLinearFilter;
    const islandGrassMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: islandGrassTex,
      gradientMap: getToonGradientMap(),
    });
    const whiteMat = createCleanToonMaterial('#D7E7E7');
    const redMat = createCleanToonMaterial('#EF4444');
    const blueMat = createCleanToonMaterial('#2563EB');
    const goldMat = createCleanToonMaterial('#C4A855');
    const slateIronMat = createCleanToonMaterial('#1E293B');

    // =========================================================================
    // 1. SAME PRO COURT GROUND TEXTURE AS OTHER GAMES + SCENIC OUTER ENVIRONMENT
    //    A circular court, connected promenade, curved stands and coastal hills.
    // =========================================================================

    // A. Deep Sapphire Ocean & Glowing Turquoise Lagoon Shelf
    const deepOceanGeo = new THREE.PlaneGeometry(460, 460, 1, 1);
    deepOceanGeo.rotateX(-Math.PI / 2);
    const deepOceanTex = createStylizedWaterTexture(
      isJungleMap ? '#0D9488' : '#0284C7',
      maxAnisotropy,
      16
    );
    const deepOceanMesh = new THREE.Mesh(
      deepOceanGeo,
      new THREE.MeshToonMaterial({
        color: 0xffffff,
        map: deepOceanTex,
        gradientMap: getToonGradientMap(),
      })
    );
    deepOceanMesh.position.y = -4.2;
    deepOceanMesh.matrixAutoUpdate = false;
    deepOceanMesh.updateMatrix();
    worldGroup.add(deepOceanMesh);

    const lagoonShape = createRoundedRectShape(92, 86, 22);
    const lagoonGeo = new THREE.ShapeGeometry(lagoonShape, 28);
    lagoonGeo.rotateX(-Math.PI / 2);
    const lagoonTex = createStylizedWaterTexture(
      isJungleMap ? '#2DD4BF' : '#38BDF8',
      maxAnisotropy,
      5
    );
    const lagoonMesh = new THREE.Mesh(
      lagoonGeo,
      new THREE.MeshBasicMaterial({
        map: lagoonTex,
        transparent: true,
        opacity: 0.74,
      })
    );
    lagoonMesh.position.y = -3.92;
    worldGroup.add(lagoonMesh);

    const animatedWaveRings: THREE.Mesh[] = [];
    [0, 1, 2].forEach((idx) => {
      const surfGeo = compactNukeCoast(createFortSurfGeometry(1.04 + idx * 0.04));
      const surfMesh = new THREE.Mesh(
        surfGeo,
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0xe0f2fe : idx === 1 ? 0xbae6fd : 0x7dd3fc,
          transparent: true,
          opacity: idx === 0 ? 0.68 : idx === 1 ? 0.42 : 0.24,
        })
      );
      surfMesh.position.y = -3.82 + idx * 0.03;
      worldGroup.add(surfMesh);
      animatedWaveRings.push(surfMesh);
    });

    // B. Sculpted Rounded-Rectangle Island Cliff Base & Lush Emerald Turf Plateau (Well below y = 0.0 for zero Z-fighting!)
    const cliffShape = createFortCoastShape(1.03);
    const cliffGeo = new THREE.ExtrudeGeometry(cliffShape, {
      depth: 3.0,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 1.0,
      bevelSegments: 3,
      curveSegments: 20,
    });
    cliffGeo.rotateX(Math.PI / 2);
    compactNukeCoast(cliffGeo);
    const cliffMesh = new THREE.Mesh(cliffGeo, lightGraniteMat);
    cliffMesh.position.y = -1.2;
    cliffMesh.receiveShadow = true;
    worldGroup.add(cliffMesh);

    const turfShape = createFortCoastShape();
    const turfGeo = new THREE.ExtrudeGeometry(turfShape, {
      depth: 1.2,
      bevelEnabled: false,
      curveSegments: 20,
    });
    turfGeo.rotateX(Math.PI / 2);
    compactNukeCoast(turfGeo);
    const turfMesh = new THREE.Mesh(turfGeo, islandGrassMat);
    turfMesh.position.y = -0.35;
    turfMesh.receiveShadow = true;
    worldGroup.add(turfMesh);

    // C. EXACT SAME GROUND TEXTURE AS VOLLEYBALL & GUN FIGHT (`createCourtFloorTexture`)!
    const courtBaseSlab = new THREE.Mesh(
      new THREE.CylinderGeometry(NUKE_FLOOR_RADIUS + .65, NUKE_FLOOR_RADIUS + .8, .38, 128),
      createCleanToonMaterial(isJungleMap ? '#637D66' : '#567C88')
    );
    courtBaseSlab.position.set(0, -0.25, 0);
    courtBaseSlab.receiveShadow = true;
    worldGroup.add(courtBaseSlab);

    const courtDeckTex = createCourtFloorTexture(
      isJungleMap ? '#22C55E' : '#38BDF8',
        isJungleMap ? '#15803D' : '#10B981',
        isJungleMap ? '#ECFDF5' : '#E2E8F0',
      maxAnisotropy
    );
    const courtPlaneGeo = createRoundNukeFloorGeometry();
    const roundDeckTex = createRoundNukeFloorTexture(courtDeckTex, maxAnisotropy);
    const courtPlaneMat = new THREE.MeshToonMaterial({
      color: 0xffffff,
      map: roundDeckTex,
      gradientMap: getToonGradientMap(),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const courtPlane = new THREE.Mesh(courtPlaneGeo, courtPlaneMat);
    courtPlane.position.set(0, 0.018, 0);
    courtPlane.receiveShadow = true;
    worldGroup.add(courtPlane);

    // Crisp Center Nuke Pedestal Ring on the Court
    const centerShowdownRing = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.72, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      })
    );
    centerShowdownRing.rotation.x = -Math.PI / 2;
    centerShowdownRing.position.set(0, 0.026, 0);
    worldGroup.add(centerShowdownRing);

    const hills = createFortHills(islandGrassMat);
    compactNukeCoast(hills.geometry, .44);
    worldGroup.add(hills);

    // 3D Sculpted Grass Blade Tufts & Wildflowers around the Outer Lawn Perimeter
    [
      [-21.5, -16.2],
      [21.5, -16.2],
      [-22.2, -6.5],
      [22.2, -6.5],
      [-22.2, 6.5],
      [22.2, 6.5],
      [-21.2, 16.5],
      [21.2, 16.5],
      [-11.5, 20.2],
      [11.5, 20.2],
      [0.0, 20.8],
    ].forEach(([gx, gz], gIdx) => {
      const grassCluster = createLushGrassBorderCluster(
        isJungleMap,
        gIdx % 2 === 0
      );
      grassCluster.position.set(gx, -0.32, gz);
      grassCluster.scale.setScalar(1.35 + (gIdx % 3) * 0.18);
      grassCluster.rotation.y = gIdx * 1.1;
      worldGroup.add(grassCluster);
    });

    // G. Tropical Coconut Palms & Puffy Canopy Trees Around the Outer Island
    const buildPalmTree = (
      x: number,
      y: number,
      z: number,
      scale = 1,
      leanDir = 1
    ) => {
      const palm = new THREE.Group();
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.22 - t * 0.06,
            0.26 - t * 0.05,
            0.62,
            10
          ),
          woodMat
        );
        seg.position.set(leanDir * t * t * 0.58, 0.3 + i * 0.55, 0);
        seg.rotation.z = -leanDir * t * 0.25;
        seg.castShadow = true;
        addCrayonOutline(seg, 0.024);
        palm.add(seg);
      }
      const topX = leanDir * 0.58;
      const topY = 2.7;
      for (let f = 0; f < 7; f++) {
        const angle = (f / 7) * Math.PI * 2;
        const frondPivot = new THREE.Group();
        frondPivot.position.set(topX, topY, 0);
        frondPivot.rotation.y = angle;
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.68, 12, 10),
          f % 2 === 0 ? foliage1 : foliage2
        );
        leaf.scale.set(1.38, 0.22, 0.54);
        leaf.rotation.z = -0.36;
        leaf.position.set(0.72, -0.1, 0);
        leaf.castShadow = true;
        addCrayonOutline(leaf, 0.022);
        frondPivot.add(leaf);
        palm.add(frondPivot);
      }
      palm.position.set(x, y, z);
      palm.scale.setScalar(scale);
      worldGroup.add(palm);
    };

    const buildPuffyTree = (x: number, y: number, z: number, scale = 1) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22 * scale, 0.32 * scale, 2.1 * scale, 10),
        woodMat
      );
      trunk.position.y = 1.05 * scale;
      trunk.castShadow = true;
      addCrayonOutline(trunk, 0.026);
      g.add(trunk);

      [
        { ox: 0, oy: 2.55, oz: 0, r: 1.15, mat: foliage1 },
        { ox: -0.62, oy: 2.12, oz: 0.25, r: 0.86, mat: foliage2 },
        { ox: 0.64, oy: 2.15, oz: -0.2, r: 0.88, mat: foliage2 },
        { ox: 0.1, oy: 2.08, oz: 0.62, r: 0.82, mat: foliage1 },
      ].forEach((pf) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(pf.r * scale, 14, 12),
          pf.mat
        );
        m.position.set(pf.ox * scale, pf.oy * scale, pf.oz * scale);
        m.scale.set(1.08, 0.92, 1.05);
        m.castShadow = true;
        addCrayonOutline(m, 0.024);
        g.add(m);
      });
      worldGroup.add(g);
    };

    buildPalmTree(-24.5, -0.35, -17.5, 1.35, -1);
    buildPalmTree(24.5, -0.35, -17.5, 1.35, 1);
    buildPalmTree(-25.5, -0.35, 16.5, 1.35, -1);
    buildPalmTree(25.5, -0.35, 16.5, 1.35, 1);
    buildPuffyTree(-25.8, -0.35, -4.0, 1.3);
    buildPuffyTree(25.8, -0.35, -4.0, 1.3);
    buildPuffyTree(-25.0, -0.35, 7.5, 1.25);
    buildPuffyTree(25.0, -0.35, 7.5, 1.25);
    buildPuffyTree(-15.5, -0.35, 22.0, 1.2);
    buildPuffyTree(15.5, -0.35, 22.0, 1.2);

    // H. Slow-moving coastal clouds above the low, misty hills.
    const weatherClouds: Array<{ group: THREE.Group; x: number }> = [];
    [
      [-38, 25, -48, 2.5],
      [0, 28, -56, 2.9],
      [38, 25, -48, 2.5],
      [-48, 21, -12, 2.2],
      [48, 21, -12, 2.2],
    ].forEach(([cx, cy, cz, sc]) => {
      const cg = new THREE.Group();
      const p1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 14, 12),
        whiteMat
      );
      addCrayonOutline(p1, 0.028);
      const p2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.74, 12, 10),
        whiteMat
      );
      p2.position.set(0.78, -0.1, 0.1);
      addCrayonOutline(p2, 0.028);
      const p3 = new THREE.Mesh(
        new THREE.SphereGeometry(0.68, 12, 10),
        whiteMat
      );
      p3.position.set(-0.74, -0.12, -0.1);
      addCrayonOutline(p3, 0.028);
      cg.add(p1, p2, p3);
      cg.position.set(cx, cy, cz);
      cg.scale.setScalar(sc);
      worldGroup.add(cg);
      weatherClouds.push({ group: cg, x: cx });
    });

    // Low, curved stands and railings follow the round court on both maps.
    const terraceMat = new THREE.MeshToonMaterial({ map: createFortSurfaceTexture(isJungleMap ? '#ACB494' : '#ACCAD0', 'deck', maxAnisotropy), gradientMap: getToonGradientMap() });
    const pavilionMat = createCleanToonMaterial(isJungleMap ? '#347C65' : '#287F9F');
    worldGroup.add(createNukeStadium({ wall: castleWallMat, trim: warmStoneMat, dark: darkStoneMat, deck: terraceMat, accent: pavilionMat, foliage: foliage1 }, isJungleMap));

    // =========================================================================
    // 3. DUAL CHAMPIONSHIP DODGEBALLS IN ALL 3 ROUNDS ("2 ball rakhe hai round 1 me round 2 me bhi 2 and round 3 me")
    // =========================================================================
    applyFortMasonryScale(worldGroup, [castleWallMat, darkStoneMat, warmStoneMat]);
    for (const cloud of weatherClouds) batchStaticScenery(cloud.group);
    batchStaticScenery(worldGroup, [...animatedWaveRings, ...weatherClouds.map(cloud => cloud.group)]);
    freezeStaticWorldTransforms(worldGroup, [...animatedWaveRings, ...weatherClouds.map(cloud => cloud.group)]);
    applyExteriorFog(worldGroup, new THREE.Vector4(-29, -29, 29, 29), 29);

    const healthKits = createNukeHealthKits();
    const kitMeshes = healthKits.map(kit => {
      const mesh = createArenaMedkit();
      const spot = NUKE_KIT_SPOTS[kit.spotIndex];
      mesh.visible = kit.active;
      mesh.position.set(spot.x, .58, spot.z);
      worldGroup.add(mesh);
      return mesh;
    });
    const isKitAuthority = () => !multiplayerClient.currentRoom || multiplayerClient.currentRoom.hostId === multiplayerClient.playerId;
    const publishKits = (athlete?: DodgeballAthlete) => multiplayerClient.sendGameEvent('nuke:health-kits', {
      round: currentRound, kits: healthKits,
      slotIndex: athlete?.slotIndex, hp: athlete?.hp,
    });
    const collectKit = (index: number, athlete: DodgeballAthlete) => {
      if (gameStateRef.current !== 'PLAYING' || matchEnded || countdownSec > 0 || roundTransitionTimer > 0) return;
      const healed = collectNukeHealthKit(healthKits[index], athlete);
      if (!healed) return;
      athlete.jiggleVelY += 2;
      if (athlete.isPlayer) {
        crayonAudio.playMedkitPickup();
        onCalloutRef.current?.(`HEALTH +${healed}`, '#86EFAC');
      }
      publishKits(athlete);
    };

    const crimsonBallTex = createDodgeballTexture('#EF4444', '#FEF08A');
    const goldBallTex = createDodgeballTexture('#F59E0B', '#FEF9C3');

    const dodgeballs: DodgeballObject[] = [];
    const TRAIL_LEN = 7;

    const BALL_CONFIGS: Array<{
      id: number;
      kind: DodgeballKind;
      homeX: number;
      homeZ: number;
      tex: THREE.CanvasTexture;
      ringHex: number;
    }> = [
      {
        id: 0,
        kind: 'crimson',
        homeX: -2.2,
        homeZ: 0.0,
        tex: crimsonBallTex,
        ringHex: 0xfacc15,
      },
      {
        id: 1,
        kind: 'gold',
        homeX: 2.2,
        homeZ: 0.0,
        tex: goldBallTex,
        ringHex: 0x38bdf8,
      },
    ];

    BALL_CONFIGS.forEach((bCfg) => {
      const bMat = new THREE.MeshToonMaterial({
        color: 0xffffff,
        map: bCfg.tex,
        gradientMap: getToonGradientMap(),
      });

      const ballGrp = new THREE.Group();
      ballGrp.position.set(bCfg.homeX, 0.54, bCfg.homeZ);

      const ballSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 24),
        bMat
      );
      ballSphere.castShadow = true;
      addCrayonOutline(ballSphere, 0.015);
      ballGrp.add(ballSphere);

      const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(0.67, 0.74, 40),
        new THREE.MeshBasicMaterial({
          color: bCfg.ringHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.64,
        })
      );
      floorRing.rotation.x = -Math.PI / 2;
      floorRing.position.set(bCfg.homeX, 0.042, bCfg.homeZ);
      scene.add(floorRing);

      const beaconArrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.48, 12),
        new THREE.MeshBasicMaterial({ color: bCfg.ringHex })
      );
      beaconArrow.rotation.x = Math.PI;
      beaconArrow.position.set(bCfg.homeX, 1.65, bCfg.homeZ);
      addCrayonOutline(beaconArrow, 0.028);
      beaconArrow.visible = false;
      scene.add(beaconArrow);

      const trailMeshes: THREE.Mesh[] = [];
      const motionTrail = createMotionTrail(TRAIL_LEN);
      motionTrail.reset(bCfg.homeX, 0.54, bCfg.homeZ);
      for (let t = 0; t < TRAIL_LEN; t++) {
        const tm = new THREE.Mesh(
          new THREE.SphereGeometry(0.32 * (1 - t / TRAIL_LEN), 8, 6),
          new THREE.MeshBasicMaterial({
            color: bCfg.kind === 'gold' ? 0xf4c75d : 0xf17778,
            transparent: true,
            opacity: 0.48 * (1 - t / TRAIL_LEN),
          })
        );
        tm.visible = false;
        scene.add(tm);
        trailMeshes.push(tm);
      }

      scene.add(ballGrp);
      dodgeballs.push({
        id: bCfg.id,
        kind: bCfg.kind,
        mesh: ballGrp,
        ballSphere,
        floorRing,
        beaconArrow,
        trailMeshes,
        motionTrail,
        state: 'free',
        holderId: null,
        targetId: null,
        isSuperThrow: false,
        x: bCfg.homeX,
        y: 0.54,
        z: bCfg.homeZ,
        vx: 0,
        vy: 0,
        vz: 0,
        homeX: bCfg.homeX,
        homeZ: bCfg.homeZ,
        idleTimer: 0,
        pickupCooldown: 0,
        lastHitVictimId: null,
      });
    });

    if (onPreview) return renderMapPreview(renderer, scene, camera, postPipeline, onPreview, false);
    const weather = createWeather(scene);

    // =========================================================================
    // 4. SPAWN 4 SOLO DODGEBALL ATHLETES WITH DISTINCT AI PERSONALITIES
    // =========================================================================
    const athletes: DodgeballAthlete[] = [];
    const aiPool = CRAYON_CHARACTERS.filter((c) => c.id !== playerCharacter.id);

    const spawnCount = customSlots ? Math.max(2, Math.min(5, customSlots.filter(s => s.occupiedBy !== 'empty').length)) : 4;
    const spawnSlots = customSlots ? customSlots.filter(s => s.occupiedBy !== 'empty').map(s => s.slotIndex) : [0, 1, 2, 3];
    const SPAWN_POSITIONS_POOL = Array.from({ length: 5 }, (_, slotIndex) => ({
      ...nukeSpawnPosition(Math.max(0, spawnSlots.indexOf(slotIndex)), spawnCount),
      outfitIdx: [0, 3, 5, 2, 4][slotIndex], colorHex: ['#4ADE80', '#FB7185', '#38BDF8', '#FACC15', '#C084FC'][slotIndex],
    }));

    const activeCustomSlots = customSlots
      ? customSlots.filter((s) => s.occupiedBy !== 'empty').slice(0, 5)
      : null;
    const myCustomSlot = activeCustomSlots
      ? activeCustomSlots.find((s) => s.playerId === multiplayerClient.playerId) ||
        activeCustomSlots.find((s) => s.playerName === playerDisplayName)
      : null;
    const mySlotIdx = myCustomSlot ? myCustomSlot.slotIndex : 0;
    const otherCustomSlots = activeCustomSlots
      ? activeCustomSlots.filter((s) =>
          myCustomSlot
            ? s.slotIndex !== myCustomSlot.slotIndex
            : s.playerId !== multiplayerClient.playerId
        )
      : [];

    const FOUR_PLAYER_SPAWNS: Array<{
      id: string;
      isPlayer: boolean;
      slotIndex: number;
      remotePlayerId: string | null;
      playerNameOverride?: string;
      x: number;
      z: number;
      yaw: number;
      charConfig: CharacterConfig;
      outfitIdx: number;
      colorHex: string;
    }> = [
      {
        id: 'p1_you',
        isPlayer: true,
        slotIndex: mySlotIdx,
        remotePlayerId: null,
        x: SPAWN_POSITIONS_POOL[mySlotIdx % SPAWN_POSITIONS_POOL.length].x,
        z: SPAWN_POSITIONS_POOL[mySlotIdx % SPAWN_POSITIONS_POOL.length].z,
        yaw: SPAWN_POSITIONS_POOL[mySlotIdx % SPAWN_POSITIONS_POOL.length].yaw,
        charConfig: playerCharacter,
        outfitIdx: 0,
        colorHex: '#4ADE80',
      },
      ...(activeCustomSlots
        ? otherCustomSlots.map((s, idx) => {
            const pos =
              SPAWN_POSITIONS_POOL[s.slotIndex % SPAWN_POSITIONS_POOL.length];
            const baseC =
              CRAYON_CHARACTERS.find((c) => c.id === s.charId) ||
              aiPool[idx % aiPool.length] ||
              CRAYON_CHARACTERS[(idx + 1) % CRAYON_CHARACTERS.length];
            return {
              id: s.playerId ? `remote_${s.playerId}` : `p${idx + 2}_rival`,
              isPlayer: false,
              slotIndex: s.slotIndex,
              remotePlayerId: s.occupiedBy === 'human' ? s.playerId : null,
              playerNameOverride: s.playerName,
              x: pos.x,
              z: pos.z,
              yaw: pos.yaw,
              charConfig: {
                ...baseC,
                faceId: s.faceId || baseC.faceId,
                outfitId: s.outfitId || baseC.outfitId,
              },
              outfitIdx: pos.outfitIdx,
              colorHex: pos.colorHex,
            };
          })
        : [
            {
              id: 'p2_rival',
              isPlayer: false,
              slotIndex: 1,
              remotePlayerId: null,
              ...nukeSpawnPosition(1, 4),
              charConfig: aiPool[0] || CRAYON_CHARACTERS[1],
              outfitIdx: 3,
              colorHex: '#FB7185',
            },
            {
              id: 'p3_rival',
              isPlayer: false,
              slotIndex: 2,
              remotePlayerId: null,
              ...nukeSpawnPosition(2, 4),
              charConfig: aiPool[1] || CRAYON_CHARACTERS[2],
              outfitIdx: 5,
              colorHex: '#38BDF8',
            },
            {
              id: 'p4_rival',
              isPlayer: false,
              slotIndex: 3,
              remotePlayerId: null,
              ...nukeSpawnPosition(3, 4),
              charConfig: aiPool[2] || CRAYON_CHARACTERS[3],
              outfitIdx: 2,
              colorHex: '#FACC15',
            },
          ]),
    ];

    FOUR_PLAYER_SPAWNS.forEach((sp) => {
      const outfit =
        CHARACTER_OUTFITS[sp.outfitIdx % CHARACTER_OUTFITS.length];
      const customizedChar: CharacterConfig = sp.isPlayer
        ? sp.charConfig
        : {
            ...sp.charConfig,
            outfitId: sp.charConfig.outfitId || outfit.id,
          };
      const resolvedName = sp.isPlayer
        ? playerDisplayName
          ? `${playerDisplayName} (YOU)`
          : `${sp.charConfig.name} (YOU)`
        : sp.playerNameOverride || customizedChar.name;

      const rig = createCrayonCharacter(
        customizedChar,
        maxAnisotropy,
        1,
        sp.isPlayer,
        'match'
      );
      const charGroup = rig.root;
      charGroup.scale.setScalar(1.46);
      charGroup.position.set(sp.x, 0.02, sp.z);
      charGroup.rotation.y = sp.yaw;

      // Subtle Clean Ground Marker Ring (No additive glow)
      const ringGeo = new THREE.RingGeometry(
        sp.isPlayer ? 0.54 : 0.45,
        sp.isPlayer ? 0.72 : 0.58,
        28
      );
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sp.colorHex),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: sp.isPlayer ? 0.85 : 0.68,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.03;
      charGroup.add(ringMesh);

      // Overhead 3D Health Bar — ONLY visible when hit!
      const { background: hpBarBg, fill: hpBarFill } = createOverheadHealthBar(charGroup);

      // Shield Mesh (Kept hidden at start — never shown on game start)
      const shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.88, 16, 14),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(sp.colorHex),
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        })
      );
      shieldMesh.position.y = 0.78;
      shieldMesh.visible = false;
      charGroup.add(shieldMesh);

      scene.add(charGroup);

      const startHp = 160;
      athletes.push({
        id: sp.id,
        name: resolvedName,
        colorHex: sp.colorHex,
        isPlayer: sp.isPlayer,
        config: customizedChar,
        rig,
        group: charGroup,
        hpBarBg,
        hpBarFill,
        shieldMesh,
        heldBallId: null,
        spawnX: sp.x,
        spawnZ: sp.z,
        spawnYaw: sp.yaw,
        x: sp.x,
        y: 0.02,
        z: sp.z,
        visualY: 0.02,
        vx: 0,
        vy: 0,
        vz: 0,
        knockVx: 0,
        knockVz: 0,
        grounded: true,
        hp: startHp,
        maxHp: startHp,
        eliminated: false,
        roundWins: 0,
        kills: 0,
        hitsScored: 0,
        catchesMade: 0,
        superCharge: 0,
        throwSwingTimer: 0,
        dodgeCooldown: 0,
        dodgeActiveTimer: 0,
        catchWindowTimer: 0,
        invulnTimer: 0,
        hitFlashTimer: 0,
        facingYaw: sp.yaw,
        targetYaw: sp.yaw,
        walkCycle: Math.random() * Math.PI * 2,
        jiggleY: 0,
        jiggleVelY: 0,
        jiggleRoll: 0,
        jiggleVelRoll: 0,
        aiThinkTimer: Math.random() * 0.25,
        aiHoldTimer: 0,
        aiStrafeDir: sp.id === 'p2_rival' ? 1 : sp.id === 'p3_rival' ? -1 : 1,
        aiRole:
          sp.id === 'p2_rival'
            ? 'rusher'
            : sp.id === 'p3_rival'
              ? 'flanker'
              : 'tactician',
        aiGoalX: sp.x,
        aiGoalZ: sp.z,
        aiGoalTimer: 0.2 + Math.random() * 0.6,
        aiThrowDelay:
          sp.id === 'p2_rival' ? 0.28 : sp.id === 'p3_rival' ? 0.45 : 0.36,
        aiSpeedVar:
          sp.id === 'p2_rival' ? 1.07 : sp.id === 'p3_rival' ? 1.02 : 0.97,
        slotIndex: sp.slotIndex,
        remotePlayerId: sp.remotePlayerId,
        lastRemoteTickAt: 0,
      });
    });

    const playerAthlete = athletes[0];
    const cameraFollow = new THREE.Vector3(playerAthlete.x, playerAthlete.visualY, playerAthlete.z);
    const matchSync = createMatchSync('floor_is_lava', Boolean(activeCustomSlots) && !onPreview);
    const remoteDodges = new Map<string, { x: number; z: number }>();
    const remoteControlled = (a: DodgeballAthlete) => Boolean(a.remotePlayerId || (matchSync.active() && !matchSync.authority() && !a.isPlayer));

    const vfxBursts: VfxBurst[] = [];
    let screenShakeMag = 0;
    const combatVisuals = createCombatVisualPool();
    const allowImpact = createImpactGate();

    const bloodFeedback = createBloodFeedback(scene);
    const ragdolls = createCharacterRagdolls(scene, () => .02);
    const spawnImpactBurst = (x: number, y: number, z: number, dx = 0, dz = 0, intensity = 1) => {
      bloodFeedback.hit(x, y, z, .02, dx, dz, intensity);
    };

    const spawnHitExplosion = (
      hx: number,
      hy: number,
      hz: number,
      colorHex: string,
      isBig = false
    ) => {
      if (!allowImpact(hx, hy, hz, performance.now())) return;
      const ringMesh = combatVisuals.take(isBig ? 'nuke-big-ring' : 'nuke-ring', colorHex);
      ringMesh.position.set(hx, Math.max(0.05, hy), hz);
      scene.add(ringMesh);
      vfxBursts.push({
        mesh: ringMesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0.28,
        maxLife: 0.28,
        kind: 'ring',
      });
    };

    const findBestEnemyTarget = (
      thrower: DodgeballAthlete
    ): DodgeballAthlete | null => {
      let bestTarget: DodgeballAthlete | null = null;
      let bestScore = -9999;
      const fwdX = Math.sin(thrower.facingYaw);
      const fwdZ = Math.cos(thrower.facingYaw);

      for (const other of athletes) {
        if (other.id === thrower.id || other.eliminated) {
          continue;
        }
        const dx = other.x - thrower.x;
        const dz = other.z - thrower.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.01) continue;
        const dot = (dx / dist) * fwdX + (dz / dist) * fwdZ;
        const score = dot * 5.5 - dist * 0.32 - (other.hp / other.maxHp) * 1.5;
        if (score > bestScore) {
          bestScore = score;
          bestTarget = other;
        }
      }
      return bestTarget;
    };

    const aimProjection = new THREE.Vector3();
    const cameraAim = new THREE.Vector3();
    let assistedTargetId: string | null = null;
    const getCrosshairLockedEnemy = (): DodgeballAthlete | null => {
      let target: DodgeballAthlete | null = null;
      let best = NUKE_AIM_ACQUIRE;
      for (const other of athletes) {
        if (other.id === playerAthlete.id || other.eliminated) continue;
        const distance = Math.hypot(other.x - playerAthlete.x, other.z - playerAthlete.z);
        if (distance < .4 || distance > 34) continue;
        aimProjection.set(other.x, other.y + 1.2, other.z).project(camera);
        if (aimProjection.z < -1 || aimProjection.z > 1) continue;
        const screenDistance = Math.hypot(aimProjection.x * camera.aspect, aimProjection.y);
        const score = other.id === assistedTargetId && screenDistance < NUKE_AIM_RELEASE ? screenDistance * .65 : screenDistance;
        if (score < best) { best = score; target = other; }
      }
      assistedTargetId = target?.id ?? null;
      return target;
    };

    // Helper: Throw whichever of the 2 Dodgeballs the Athlete is currently holding!
    const performThrowBall = (thrower: DodgeballAthlete) => {
      if (thrower.heldBallId === null) return false;
      const ball = dodgeballs.find((b) => b.id === thrower.heldBallId);
      if (!ball || ball.holderId !== thrower.id) {
        thrower.heldBallId = null;
        return false;
      }

      const isSuper = thrower.superCharge >= 100;
      if (isSuper) {
        thrower.superCharge = 0;
      } else {
        thrower.superCharge = Math.min(100, thrower.superCharge + 35);
      }

      const baseSpeed = isSuper ? 33.0 : 28.5;
      const throwSpeed =
        baseSpeed *
        (thrower.isPlayer ? 1.12 : 0.92 + diffObj.rushSpeedMult * 0.08);

      let aimX = Math.sin(thrower.facingYaw);
      let aimZ = Math.cos(thrower.facingYaw);
      let targetDist = 14.0;
      let targetY = thrower.y + 1.12;

      if (thrower.isPlayer) {
        camera.getWorldDirection(cameraAim);
        const lockedEnemy = getCrosshairLockedEnemy();
        const aimPoint = nukeAimPoint(camera.position, cameraAim, thrower, lockedEnemy ? { x: lockedEnemy.x, y: lockedEnemy.y + 1.12, z: lockedEnemy.z } : undefined);
        const aimPointX = aimPoint.x;
        const aimPointZ = aimPoint.z;
        const aimLength = Math.max(.01, Math.hypot(aimPointX - thrower.x, aimPointZ - thrower.z));
        targetDist = aimLength;
        targetY = aimPoint.y;
        const rawAimX = (aimPointX - thrower.x) / aimLength;
        const rawAimZ = (aimPointZ - thrower.z) / aimLength;
        aimX = rawAimX;
        aimZ = rawAimZ;

        if (lockedEnemy) {
          const rawDist = Math.hypot(
            lockedEnemy.x - thrower.x,
            lockedEnemy.z - thrower.z
          );
          const flightTime = rawDist / Math.max(18, throwSpeed);
          const leadX = lockedEnemy.x + lockedEnemy.vx * flightTime * 0.7;
          const leadZ = lockedEnemy.z + lockedEnemy.vz * flightTime * 0.7;
          const toEnemyX = leadX - thrower.x;
          const toEnemyZ = leadZ - thrower.z;
          const toLen = Math.max(0.01, Math.hypot(toEnemyX, toEnemyZ));
          const dirEnemyX = toEnemyX / toLen;
          const dirEnemyZ = toEnemyZ / toLen;

          const assisted = assistedNukeDirection(rawAimX, rawAimZ, dirEnemyX, dirEnemyZ);
          aimX = assisted.x; aimZ = assisted.z;
          targetDist = toLen;
          targetY = lockedEnemy.y + 1.12;
        }
        thrower.facingYaw = Math.atan2(aimX, aimZ);
        thrower.targetYaw = thrower.facingYaw;
      } else {
        const target = findBestEnemyTarget(thrower);
        if (target) {
          const rawDist = Math.hypot(target.x - thrower.x, target.z - thrower.z);
          const flightTime = rawDist / Math.max(18, throwSpeed);
          const leadMult =
            thrower.aiRole === 'tactician'
              ? 0.52
              : thrower.aiRole === 'flanker'
                ? 0.36
                : 0.2;
          const tx = target.x + target.vx * flightTime * leadMult;
          const tz = target.z + target.vz * flightTime * leadMult;
          const dx = tx - thrower.x;
          const dz = tz - thrower.z;
          const len = Math.max(0.01, Math.hypot(dx, dz));
          const baseAngle = Math.atan2(dx, dz);
          const spread = (Math.random() - 0.5) * 0.14;
          aimX = Math.sin(baseAngle + spread);
          aimZ = Math.cos(baseAngle + spread);
          targetDist = THREE.MathUtils.clamp(len, 4.0, 26.0);
          targetY = target.y + 1.12;
          thrower.facingYaw = Math.atan2(aimX, aimZ);
          thrower.targetYaw = thrower.facingYaw;
        }
      }

      thrower.heldBallId = null;
      thrower.throwSwingTimer = 0.34;
      thrower.jiggleVelY += 3.8;

      const velocity = nukeThrowVelocity(
        { x: thrower.x + aimX * .85, y: thrower.y + 1.12, z: thrower.z + aimZ * .85 },
        { x: thrower.x + aimX * targetDist, y: targetY, z: thrower.z + aimZ * targetDist }, throwSpeed);

      ball.state = 'thrown';
      ball.holderId = thrower.id;
      ball.targetId = null;
      ball.isSuperThrow = isSuper;
      ball.pickupCooldown = 0.28;
      ball.lastHitVictimId = null;
      ball.x = thrower.x + aimX * 0.85;
      ball.y = thrower.y + 1.12;
      ball.z = thrower.z + aimZ * 0.85;
      ball.vx = velocity.x;
      ball.vy = velocity.y;
      ball.vz = velocity.z;
      ball.idleTimer = 0;
      ball.floorRing.visible = false;
      ball.beaconArrow.visible = false;

      ball.motionTrail.reset(ball.x, ball.y, ball.z);

      crayonAudio.playDodgeballThrow(isSuper);
      matchSync.invalidate();
      if (thrower.isPlayer && isSuper) onCalloutRef.current?.('SUPER NUKE SMASH!', '#FACC15');
      if (thrower.isPlayer || matchSync.authority()) {
        multiplayerClient.sendGameEvent('nuke:throw', {
          slotIndex: thrower.slotIndex ?? 0,
          ballId: ball.id,
          x: ball.x,
          y: ball.y,
          z: ball.z,
          vx: ball.vx,
          vy: ball.vy,
          vz: ball.vz,
          isSuper,
        });
      }
      return true;
    };

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jumpQueuedRef.current = true; }
      if (e.code === 'KeyF' || e.code === 'Enter') {
        e.preventDefault();
        rightActionQueuedRef.current = true;
      }
      if (
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.code === 'KeyC'
      ) {
        e.preventDefault();
        dodgeQueuedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const resetInput = () => {
      if (inputSurfaceRef.current && document.pointerLockElement === inputSurfaceRef.current) document.exitPointerLock();
      for (const key of Object.keys(keys)) keys[key] = false;
      joystickRef.current = { x: 0, y: 0, active: false };
      joyPointerIdRef.current = null; lookPointerRef.current.id = null;
      screenHeldRef.current = false; rightActionQueuedRef.current = false;
      dodgeQueuedRef.current = false; jumpQueuedRef.current = false;
      touchActionsRef.current?.reset();
      lastMousePosRef.current.initialized = false;
      if (joyContainerRef.current) joyContainerRef.current.style.display = 'none';
    };
    window.addEventListener('blur', resetInput);
    const onInputVisibility = () => { if (document.hidden) resetInput(); };
    document.addEventListener('visibilitychange', onInputVisibility);

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = Math.max(
        1,
        containerRef.current.clientHeight || window.innerHeight
      );
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      postPipeline.setSize(w, h);
      frameNeedsRender = true;
    };
    window.addEventListener('resize', onResize);
    const sizeObserver = new ResizeObserver(onResize);
    sizeObserver.observe(container);

    // =========================================================================
    // 6. ELIMINATION-DRIVEN 3-ROUND SURVIVAL TOURNAMENT STATE:
    //    - Round 1: 4 Players -> Plays until 1 player is eliminated (3 survive)
    //    - Round 2: 3 Survivors -> Plays until 1 player is eliminated (2 survive)
    //    - Round 3: Final 2 Survivors -> Plays until 1 is eliminated & Survivor Wins!
    // =========================================================================
    const MAX_REGULATION_ROUNDS = 3;
    let currentRound = 1;
    let isExtraRound = false;
    let roundTransitionTimer = 0;
    let countdownSec = 3.0;
    let roundTimeSec = 0;
    let totalMatchTimeSec = 0;
    let matchEnded = false;
    let overtimeAnnounced = false;
    let bannerText: string | null = 'ROUND 1 OF 3 · ELIMINATE 1 RIVAL!';
    let bannerTimer = 2.6;
    let lastHudKey = '';
    let netSyncAccum = 0;
    let kitSyncAccum = 0;
    let kitRequestCooldown = 0;
    let lastTime = performance.now();
    let animFrameId = 0;
    const sharedFields = ['hp', 'maxHp', 'roundWins', 'kills', 'hitsScored', 'catchesMade', 'superCharge', 'invulnTimer', 'dodgeActiveTimer', 'catchWindowTimer'] as const;
    const motionFields = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'targetYaw'] as const;
    const captureMatch = () => ({
      currentRound, countdownSec, roundTransitionTimer, roundTimeSec, totalMatchTimeSec, matchEnded, bannerText,
      athletes: athletes.map(a => ({ slot: a.slotIndex, ...numericState(a, sharedFields), ...numericState(a, motionFields), eliminated: a.eliminated, heldBallId: a.heldBallId })),
      balls: dodgeballs.map(b => ({ id: b.id, ...numericState(b, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'pickupCooldown']), state: b.state, isSuperThrow: b.isSuperThrow, holderSlot: athletes.find(a => a.id === b.holderId)?.slotIndex ?? null })),
    });
    const finishReplica = () => {
      matchEnded = true; resetInput();
      const champion = [...athletes].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.roundWins - a.roundWins || b.kills - a.kills)[0];
      const won = champion.isPlayer && !champion.eliminated;
      onGameOverRef.current(won ? 'player' : 'ai', {
        nukeStandings: athletes.map(a => ({ id: a.id, name: a.name, charId: a.config.id, roundWins: a.roundWins, kills: a.kills, hits: a.hitsScored, catches: a.catchesMade, hp: Math.max(0, a.hp), alive: !a.eliminated, isPlayer: a.isPlayer })),
        playerScore: playerAthlete.roundWins, aiScore: Math.max(0, ...athletes.filter(a => !a.isPlayer).map(a => a.roundWins)),
        bestRally: playerAthlete.kills, perfectSpikes: playerAthlete.hitsScored + playerAthlete.catchesMade,
        lastPointWinner: won ? 'player' : 'ai', lastPointReason: `${champion.name} won the Nuke championship!`,
        raceTimeSec: Number(totalMatchTimeSec.toFixed(1)), raceMaxFalls: playerAthlete.kills, raceProgressPct: won ? 100 : 35 + (currentRound - 1) * 25,
      });
    };

    const ownerTickTimes = new WeakMap<DodgeballAthlete, number>();
    const unsubRemoteTick = multiplayerClient.onRemoteTick((pkt) => {
      const remoteAt = athletes.find((a) => !a.isPlayer && a.remotePlayerId === pkt.senderId);
      if (!remoteAt || remoteAt.eliminated) return;
      remoteAt.lastRemoteTickAt = performance.now();
      ownerTickTimes.set(remoteAt, remoteAt.lastRemoteTickAt);
      remoteAt.x = pkt.x;
      remoteAt.y = pkt.y;
      remoteAt.z = pkt.z;
      clampToNukeArena(remoteAt, .9);
      remoteAt.vx = pkt.vx;
      remoteAt.vy = pkt.vy;
      remoteAt.vz = pkt.vz;
      remoteAt.targetYaw = pkt.yaw;
      // Remote humans pick up through their own controls, then share possession.
      if (!matchSync.authority()) return;
      if (remoteAt.heldBallId === null && typeof pkt.holdingBallId === 'number') {
        const heldBall = dodgeballs.find(b => b.id === pkt.holdingBallId);
        if (heldBall && heldBall.state === 'free' && Math.hypot(heldBall.x - remoteAt.x, heldBall.z - remoteAt.z) <= 3.85) {
          heldBall.state = 'held';
          heldBall.holderId = remoteAt.id;
          remoteAt.heldBallId = heldBall.id;
        }
      }
    });

    const unsubRemoteEvent = multiplayerClient.onRemoteEvent((evt) => {
      if (matchSync.receive(evt.senderId, evt.eventKind, evt.payload)) {
        const p = evt.payload;
        if (!Array.isArray(p.athletes) || !Array.isArray(p.balls)) return;
        const newRound = p.currentRound !== currentRound;
        currentRound = p.currentRound; countdownSec = p.countdownSec; roundTransitionTimer = p.roundTransitionTimer;
        roundTimeSec = p.roundTimeSec; totalMatchTimeSec = p.totalMatchTimeSec;
        bannerText = p.bannerText; bannerTimer = bannerText ? .3 : 0;
        for (const state of p.athletes) {
          const a = athletes.find(item => item.slotIndex === state.slot); if (!a) continue;
          if (state.hp < a.hp) {
            a.hitFlashTimer = 2.2;
            spawnImpactBurst(a.x, a.y + .9, a.z);
            crayonAudio.playDodgeballHit(a.config.id, a.hp - state.hp > 40, Boolean(state.eliminated));
          }
          if (!a.eliminated && state.eliminated) ragdolls.spawn(a.rig, a.vx, a.vz);
          const predictedDodge = a.dodgeActiveTimer, predictedCatch = a.catchWindowTimer;
          applyNumericState(a, state, sharedFields);
          if (a.isPlayer && !newRound) {
            a.dodgeActiveTimer = predictedDodge; a.catchWindowTimer = predictedCatch;
          }
          if (newRound || (!a.isPlayer && useHostMotion(ownerTickTimes.get(a), performance.now()))) {
            applyNumericState(a, state, motionFields);
            a.lastRemoteTickAt = performance.now();
          }
          if (newRound) {
            ownerTickTimes.delete(a);
            a.visualY = a.y;
            a.group.position.set(a.x, a.y, a.z);
          }
          a.eliminated = Boolean(state.eliminated); a.group.visible = !a.eliminated;
          a.heldBallId = state.heldBallId;
        }
        for (const state of p.balls) {
          const ball = dodgeballs.find(b => b.id === state.id); if (!ball) continue;
          const previousState = ball.state;
          applyNumericState(ball, state, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'pickupCooldown']);
          if (['free', 'held', 'thrown'].includes(state.state)) ball.state = state.state;
          if (newRound || previousState !== ball.state) ball.motionTrail.reset(ball.x, ball.y, ball.z);
          ball.holderId = athletes.find(a => a.slotIndex === state.holderSlot)?.id ?? null;
          ball.isSuperThrow = Boolean(state.isSuperThrow);
        }
        if (p.matchEnded && !matchEnded) finishReplica();
        return;
      }
      if (evt.eventKind === 'nuke:dodge' && matchSync.authority() && [evt.payload.x, evt.payload.z].every(Number.isFinite)) {
        remoteDodges.set(evt.senderId, nukeDodgeDirection(evt.payload.x, evt.payload.z, 0));
      }
      if (evt.eventKind === 'nuke:collect-kit' && isKitAuthority() && evt.payload.round === currentRound) {
        const athlete = athletes.find(a => a.remotePlayerId === evt.senderId);
        const index = evt.payload.index;
        if (athlete && Number.isInteger(index) && healthKits[index]) collectKit(index, athlete);
      }
      if (evt.eventKind === 'nuke:health-kits' && evt.senderId === multiplayerClient.currentRoom?.hostId && evt.payload.round === currentRound) {
        const incoming = evt.payload.kits;
        if (Array.isArray(incoming) && incoming.length === healthKits.length) incoming.forEach((kit, index) => {
          if (Number.isInteger(kit.spotIndex) && NUKE_KIT_SPOTS[kit.spotIndex] && typeof kit.active === 'boolean' && Number.isFinite(kit.cooldown)) Object.assign(healthKits[index], { spotIndex: kit.spotIndex, active: kit.active, cooldown: Math.max(0, kit.cooldown) });
        });
        const athlete = athletes.find(a => a.slotIndex === evt.payload.slotIndex);
        if (athlete && Number.isFinite(evt.payload.hp) && !athlete.eliminated) {
          const previous = athlete.hp;
          athlete.hp = THREE.MathUtils.clamp(evt.payload.hp, 0, athlete.maxHp);
          if (athlete.isPlayer && athlete.hp > previous) {
            crayonAudio.playMedkitPickup();
            onCalloutRef.current?.(`HEALTH +${Math.round(athlete.hp - previous)}`, '#86EFAC');
          }
        }
      }
      if (evt.eventKind === 'nuke:throw' && evt.payload) {
        const fromHost = evt.senderId === multiplayerClient.currentRoom?.hostId;
        const remoteAt = athletes.find(a => !a.isPlayer && (fromHost ? a.slotIndex === evt.payload.slotIndex : a.remotePlayerId === evt.senderId));
        const ball = dodgeballs.find((b) => b.id === evt.payload.ballId) || dodgeballs[0];
        if (remoteAt && !remoteAt.eliminated && ball && [evt.payload.x, evt.payload.y, evt.payload.z, evt.payload.vx, evt.payload.vy, evt.payload.vz].every(Number.isFinite)) {
          remoteAt.heldBallId = null;
          remoteAt.throwSwingTimer = 0.34;
          ball.state = 'thrown';
          ball.holderId = remoteAt.id;
          ball.isSuperThrow = Boolean(evt.payload.isSuper);
          ball.pickupCooldown = 0.28;
          ball.x = evt.payload.x; ball.y = evt.payload.y; ball.z = evt.payload.z;
          ball.vx = evt.payload.vx; ball.vy = evt.payload.vy; ball.vz = evt.payload.vz;
          ball.motionTrail.reset(ball.x, ball.y, ball.z);
          matchSync.invalidate();
          crayonAudio.playDodgeballThrow(Boolean(evt.payload.isSuper));
        }
      }
    });

    const resetForNextRound = (nextRoundNum: number) => {
      currentRound = nextRoundNum;
      isExtraRound = false;
      roundTimeSec = 0;
      countdownSec = 2.4;
      overtimeAnnounced = false;
      createNukeHealthKits().forEach((kit, index) => Object.assign(healthKits[index], kit));

      // Only reset SURVIVING athletes (eliminated athletes stay eliminated!)
      for (const a of athletes) {
        if (a.eliminated) {
          a.heldBallId = null;
          a.group.visible = false;
          a.hpBarBg.visible = false;
          a.hpBarFill.visible = false;
          continue;
        }
        a.hp = a.maxHp;
        a.heldBallId = null;
        a.x = a.spawnX;
        a.y = 0.02;
        a.z = a.spawnZ;
        a.visualY = 0.02;
        a.vx = 0;
        a.vy = 0;
        a.vz = 0;
        a.knockVx = 0;
        a.knockVz = 0;
        a.grounded = true;
        a.facingYaw = a.spawnYaw;
        a.targetYaw = a.spawnYaw;
        a.dodgeCooldown = 0;
        a.dodgeActiveTimer = 0;
        a.catchWindowTimer = 0;
        a.invulnTimer = 0;
        a.hitFlashTimer = 0;
        a.hpBarBg.visible = false;
        a.hpBarFill.visible = false;
        a.shieldMesh.visible = false;
        a.aiHoldTimer = 0;
        a.aiGoalTimer = 0;
        a.group.visible = true;
        a.group.position.set(a.x, a.visualY, a.z);
        a.group.rotation.y = a.facingYaw;
        updateCharacterGroundShadow(a.group, a.rig.shadowMesh);
      }

      // Reset BOTH Dodgeballs onto their pedestals for Round 1, Round 2, and Round 3!
      for (const b of dodgeballs) {
        b.state = 'free';
        b.holderId = null;
        b.targetId = null;
        b.isSuperThrow = false;
        b.x = b.homeX;
        b.y = 0.54;
        b.z = b.homeZ;
        b.vx = 0;
        b.vy = 0;
        b.vz = 0;
        b.idleTimer = 0;
        b.pickupCooldown = 0;
        b.lastHitVictimId = null;
        b.mesh.visible = true;
        b.mesh.position.set(b.homeX, 0.54, b.homeZ);
        b.floorRing.visible = true;
        b.floorRing.position.set(b.homeX, 0.042, b.homeZ);
        b.beaconArrow.visible = false;
        b.beaconArrow.position.set(b.homeX, 1.65, b.homeZ);
        b.motionTrail.reset(b.x, b.y, b.z);
        b.trailMeshes.forEach((tm) => {
          tm.visible = false;
        });
      }

      const aliveCountNow = athletes.filter((a) => !a.eliminated).length;
      bannerText =
        nextRoundNum === 3
          ? `FINAL ROUND 3 · 1v1 SHOWDOWN (${aliveCountNow} LEFT)!`
          : `ROUND ${nextRoundNum} OF ${MAX_REGULATION_ROUNDS} · ${aliveCountNow} SURVIVORS LEFT!`;
      bannerTimer = 3.0;
      onCalloutRef.current?.(
        nextRoundNum === 3
          ? 'FINAL 1v1 SHOWDOWN!'
          : `ROUND ${nextRoundNum} · ${aliveCountNow} LEFT!`,
        nextRoundNum === 3 ? '#FACC15' : '#38BDF8'
      );
    };

    const touchDisplay = window.matchMedia('(pointer: coarse)').matches;
    const paceFrame = createFramePacer();
    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      if (document.hidden) { lastTime = now; return; }
      if (!paceFrame(now, touchDisplay ? 60 : 0)) return;
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (keys['KeyQ']) camYawOffsetRef.current += 2.2 * rawDt;
      if (keys['KeyE']) camYawOffsetRef.current -= 2.2 * rawDt;

      if (gameStateRef.current === 'PAUSED') {
        resetInput();
        if (frameNeedsRender) { postPipeline.render(); frameNeedsRender = false; }
        return;
      }

      weather.update(rawDt, camera, gameStateRef.current === 'PLAYING');
      const dt = rawDt * speedMultRef.current;
      const tSec = now * 0.001;

      lagoonTex.offset.x = Math.sin(tSec * 0.35) * 0.04;
      lagoonTex.offset.y = Math.cos(tSec * 0.28) * 0.04;
      deepOceanTex.offset.x = (tSec * 0.02) % 1;
      weatherClouds.forEach((cloud, i) => {
        cloud.group.position.x = cloud.x + Math.sin(tSec * .035 + i * 1.6) * 2.4;
      });
      animatedWaveRings.forEach((wave, i) => {
        wave.position.y = -3.82 + i * .03 + Math.sin(tSec * .55 + i) * .025;
      });

      if (bannerTimer > 0) {
        bannerTimer -= rawDt;
        if (bannerTimer <= 0 && !matchEnded) bannerText = null;
      }

      // Handle Inter-Round Transition after an Elimination
      if (roundTransitionTimer > 0 && !matchEnded) {
        roundTransitionTimer -= rawDt;
        if (roundTransitionTimer <= 0 && matchSync.authority()) {
          resetForNextRound(currentRound + 1);
        }
      } else if (countdownSec > 0 && !matchEnded) {
        const prevCeil = Math.ceil(countdownSec);
        countdownSec = Math.max(0, countdownSec - rawDt);
        const nextCeil = Math.ceil(countdownSec);
        if (nextCeil !== prevCeil) {
          crayonAudio.playCountdownBeep(nextCeil === 0);
        }
      } else if (!matchEnded) {
        roundTimeSec += dt;
        totalMatchTimeSec += dt;
      }

      const GRAVITY = -26.5;
      if (!matchEnded && countdownSec <= 0 && roundTransitionTimer <= 0) {
        kitRequestCooldown = Math.max(0, kitRequestCooldown - rawDt);
        if (isKitAuthority()) {
          const spawned = updateNukeHealthKits(healthKits, dt);
          kitSyncAccum += rawDt;
          if (spawned || kitSyncAccum >= 2) { kitSyncAccum = 0; publishKits(); }
        }
      }
      healthKits.forEach((kit, index) => {
        const mesh = kitMeshes[index], spot = NUKE_KIT_SPOTS[kit.spotIndex];
        mesh.visible = kit.active;
        mesh.position.set(spot.x, .58 + Math.sin(tSec * 3 + index) * .1, spot.z);
        mesh.rotation.y = tSec * 1.2 + index;
      });
      const MOVE_SPEED = 7.25;
      const JUMP_VY = 9.8;

      // Helper to find closest free dodgeball to a given coordinate
      const findNearestFreeBall = (px: number, pz: number): DodgeballObject | null => {
        let bestBall: DodgeballObject | null = null;
        let bestDist = 99999;
        for (const b of dodgeballs) {
          if (b.state !== 'free' || b.pickupCooldown > 0) continue;
          const d = Math.hypot(b.x - px, b.z - pz);
          if (d < bestDist) {
            bestDist = d;
            bestBall = b;
          }
        }
        return bestBall;
      };

      // Assign up to 2 AI bots to chase the 2 free dodgeballs without clumping on the same ball
      const ballChaserMap = new Map<number, string>();
      for (const b of dodgeballs) {
        if (b.state !== 'free') continue;
        let bestBotId: string | null = null;
        let bestDist = 99999;
        for (const bot of athletes) {
          if (!matchSync.authority() || bot.isPlayer || bot.remotePlayerId || bot.eliminated || bot.heldBallId !== null) continue;
          if ([...ballChaserMap.values()].includes(bot.id)) continue;
          const d = Math.hypot(b.x - bot.x, b.z - bot.z);
          const weightedD = bot.aiRole === 'rusher' ? d * 0.82 : d;
          if (weightedD < bestDist) {
            bestDist = weightedD;
            bestBotId = bot.id;
          }
        }
        if (bestBotId) {
          ballChaserMap.set(b.id, bestBotId);
        }
      }

      for (const a of athletes) {
        if (a.eliminated) continue;

        if (a.invulnTimer > 0) {
          a.invulnTimer = Math.max(0, a.invulnTimer - dt);
        }
        if (a.catchWindowTimer > 0) {
          a.catchWindowTimer = Math.max(0, a.catchWindowTimer - dt);
        }

        a.shieldMesh.visible = false;

        if (a.dodgeCooldown > 0)
          a.dodgeCooldown = Math.max(0, a.dodgeCooldown - dt);
        if (a.dodgeActiveTimer > 0)
          a.dodgeActiveTimer = Math.max(0, a.dodgeActiveTimer - dt);
        if (a.throwSwingTimer > 0)
          a.throwSwingTimer = Math.max(0, a.throwSwingTimer - dt);
        if (a.hitFlashTimer > 0)
          a.hitFlashTimer = Math.max(0, a.hitFlashTimer - dt);

        a.superCharge = Math.min(100, a.superCharge + dt * 5.0);

        let inputX = 0;
        let inputZ = 0;
        let wantsAction = false;
        let wantsDodge = false;
        let wantsJump = false;

        if (
          countdownSec <= 0 &&
          roundTransitionTimer <= 0 &&
          !matchEnded
        ) {
          if (a.isPlayer) {
            let rawRight = 0;
            let rawForward = 0;
            if (keys['KeyA'] || keys['ArrowLeft']) rawRight -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) rawRight += 1;
            if (keys['KeyW'] || keys['ArrowUp']) rawForward += 1;
            if (keys['KeyS'] || keys['ArrowDown']) rawForward -= 1;

            if (actionTriggerRef?.current.joystickActive) {
              rawRight += actionTriggerRef.current.joystickX || 0;
              rawForward -= actionTriggerRef.current.joystickY || 0;
            } else if (joystickRef.current.active) {
              rawRight += joystickRef.current.x;
              rawForward -= joystickRef.current.y;
            }

            const len = Math.hypot(rawRight, rawForward);
            if (len > 0.01) {
              const nr = rawRight / Math.max(1, len);
              const nf = rawForward / Math.max(1, len);
              const yaw = camYawOffsetRef.current;
              const fwdX = -Math.sin(yaw);
              const fwdZ = -Math.cos(yaw);
              const rgtX = Math.cos(yaw);
              const rgtZ = -Math.sin(yaw);
              inputX = fwdX * nf + rgtX * nr;
              inputZ = fwdZ * nf + rgtZ * nr;
            }

            const nearestFree = findNearestFreeBall(a.x, a.z);
            if (
              a.heldBallId === null &&
              nearestFree
            ) {
              const distToBall = Math.hypot(nearestFree.x - a.x, nearestFree.z - a.z);
              if (distToBall <= 3.2 && nearestFree.y <= a.y + 2.15 && (nearestFree.lastHitVictimId !== a.id || nearestFree.idleTimer > .38)) {
                nearestFree.state = 'held';
                nearestFree.holderId = a.id;
                nearestFree.lastHitVictimId = null;
                nearestFree.floorRing.visible = false;
                nearestFree.beaconArrow.visible = false;
                nearestFree.trailMeshes.forEach((tm) => {
                  tm.visible = false;
                });
                a.heldBallId = nearestFree.id;
                a.aiHoldTimer = 0;
                a.jiggleVelY += 3.2;
                crayonAudio.playWeaponPickup();
                onCalloutRef.current?.('NUKE PICKED UP!', '#FACC15');
              }
            }

            if (rightActionQueuedRef.current || actionTriggerRef?.current.throwRequested) {
              if (actionTriggerRef) actionTriggerRef.current.throwRequested = false;
              wantsAction = true;
              rightActionQueuedRef.current = false;
            }
            if (dodgeQueuedRef.current || actionTriggerRef?.current.dodgeRequested) {
              if (actionTriggerRef) actionTriggerRef.current.dodgeRequested = false;
              wantsDodge = true;
              dodgeQueuedRef.current = false;
            }
            if (jumpQueuedRef.current || actionTriggerRef?.current.jumpRequested) {
              if (actionTriggerRef) actionTriggerRef.current.jumpRequested = false;
              wantsJump = true;
              jumpQueuedRef.current = false;
            }
          } else if (remoteControlled(a)) {
            const motion = remoteMovement('remote', a.lastRemoteTickAt, performance.now(), a.vx, a.vz, 7.25)!;
            inputX = motion.x;
            inputZ = motion.z;
            if (inputX === 0 && inputZ === 0) a.vx = a.vz = 0;
          } else {
            a.aiThinkTimer -= dt;
            a.aiGoalTimer -= dt;
            if (a.aiThinkTimer <= 0) {
              a.aiThinkTimer =
                a.aiRole === 'rusher'
                  ? 0.22 + Math.random() * 0.25
                  : a.aiRole === 'flanker'
                    ? 0.3 + Math.random() * 0.35
                    : 0.35 + Math.random() * 0.4;
              if (Math.random() < 0.32) a.aiStrafeDir = -a.aiStrafeDir;
            }

            if (a.aiGoalTimer <= 0) {
              a.aiGoalTimer = 1.6 + Math.random() * 1.8;
              if (a.aiRole === 'rusher') {
                const ang = Math.random() * Math.PI * 2;
                const rad = 3.5 + Math.random() * 5.5;
                a.aiGoalX = Math.cos(ang) * rad;
                a.aiGoalZ = Math.sin(ang) * rad;
              } else if (a.aiRole === 'flanker') {
                const side = Math.random() < 0.5 ? -1 : 1;
                a.aiGoalX = side * (7.5 + Math.random() * 5.0);
                a.aiGoalZ = (Math.random() - 0.5) * 18.0;
              } else {
                const refTarget = playerAthlete.eliminated ? a : playerAthlete;
                a.aiGoalX = THREE.MathUtils.clamp(
                  -refTarget.x * 0.7 + (Math.random() - 0.5) * 7.0,
                  -12,
                  12
                );
                a.aiGoalZ = THREE.MathUtils.clamp(
                  -refTarget.z * 0.7 + (Math.random() - 0.5) * 7.0,
                  -12,
                  12
                );
              }
            }

            const goal = { x: a.aiGoalX, z: a.aiGoalZ };
            clampToNukeArena(goal, 2.2);
            a.aiGoalX = goal.x; a.aiGoalZ = goal.z;

            // 1. Incoming Thrown Ball Evasion across BOTH dodgeballs
            let evadingIncoming = false;
            for (const b of dodgeballs) {
              if (b.state === 'thrown' && b.holderId !== a.id) {
                if (Math.abs(b.y - (a.y + .8)) > 1.6) continue;
                const threat = approachingThreat(a.x, a.z, b, 1.15, .55);
                if (threat) {
                  evadingIncoming = true;
                  const outward = threat.x * a.x + threat.z * a.z;
                  const side = Math.hypot(a.x, a.z) > 12 ? (outward > 0 ? -1 : 1) : a.aiStrafeDir;
                  inputX = threat.x * side; inputZ = threat.z * side;
                  if (a.dodgeCooldown <= 0 && threat.time < .3 && Math.random() < reactionChance(5 * diffObj.rushSpeedMult, dt)) wantsDodge = true;
                  break;
                }
              }
            }

            if (!evadingIncoming) {
              const assignedBall = dodgeballs.find(
                (b) => b.state === 'free' && ballChaserMap.get(b.id) === a.id
              );

              if (a.heldBallId !== null) {
                a.aiHoldTimer += dt;
                const enemy = findBestEnemyTarget(a);
                if (enemy) {
                  const dx = enemy.x - a.x;
                  const dz = enemy.z - a.z;
                  const dist = Math.max(0.1, Math.hypot(dx, dz));
                  a.targetYaw = Math.atan2(dx, dz);

                  const idealDist =
                    a.aiRole === 'rusher'
                      ? 5.5
                      : a.aiRole === 'flanker'
                        ? 8.5
                        : 10.5;
                  if (dist > idealDist) {
                    inputX =
                      (dx / dist) * 0.82 +
                      (-dz / dist) * a.aiStrafeDir * 0.35;
                    inputZ =
                      (dz / dist) * 0.82 +
                      (dx / dist) * a.aiStrafeDir * 0.35;
                  } else if (dist < idealDist - 2) {
                    inputX = -dx / dist + (-dz / dist) * a.aiStrafeDir * .3;
                    inputZ = -dz / dist + (dx / dist) * a.aiStrafeDir * .3;
                  } else {
                    inputX = (-dz / dist) * a.aiStrafeDir * 0.85;
                    inputZ = (dx / dist) * a.aiStrafeDir * 0.85;
                  }
                }
                if (enemy && enemy.invulnTimer <= 0 && a.aiHoldTimer >= a.aiThrowDelay) {
                  wantsAction = true;
                  a.aiHoldTimer = 0;
                  a.aiThrowDelay =
                    a.aiRole === 'rusher'
                      ? 0.34 + Math.random() * 0.24
                      : a.aiRole === 'flanker'
                        ? 0.48 + Math.random() * 0.32
                        : 0.6 + Math.random() * 0.36;
                }
              } else if (assignedBall) {
                const dx = assignedBall.x - a.x;
                const dz = assignedBall.z - a.z;
                const dist = Math.max(0.1, Math.hypot(dx, dz));
                inputX = dx / dist;
                inputZ = dz / dist;
                if (
                  dist <= 2.35 &&
                  assignedBall.pickupCooldown <= 0 &&
                  assignedBall.y <= 1.85 &&
                  (assignedBall.lastHitVictimId !== a.id ||
                    assignedBall.idleTimer > 0.45) &&
                  a.dodgeCooldown <= 0
                ) {
                  wantsDodge = true;
                }
              } else {
                const activeHolder = athletes.find(
                  (o) => !o.eliminated && o.id !== a.id && o.heldBallId !== null
                );
                const gx = a.aiGoalX - a.x;
                const gz = a.aiGoalZ - a.z;
                const gDist = Math.hypot(gx, gz);
                if (activeHolder) {
                  const hx = a.x - activeHolder.x;
                  const hz = a.z - activeHolder.z;
                  const hDist = Math.max(0.1, Math.hypot(hx, hz));
                  const perpX = -hz / hDist;
                  const perpZ = hx / hDist;
                  const retreatWeight = hDist < 7.5 ? 0.65 : 0.15;
                  const goalWeight = gDist > 1.5 ? 0.45 : 0.0;
                  inputX =
                    perpX * a.aiStrafeDir * 0.75 +
                    (hx / hDist) * retreatWeight +
                    (gx / Math.max(1, gDist)) * goalWeight;
                  inputZ =
                    perpZ * a.aiStrafeDir * 0.75 +
                    (hz / hDist) * retreatWeight +
                    (gz / Math.max(1, gDist)) * goalWeight;
                  a.targetYaw = Math.atan2(
                    activeHolder.x - a.x,
                    activeHolder.z - a.z
                  );
                } else if (gDist > 1.1) {
                  inputX = gx / gDist;
                  inputZ = gz / gDist;
                } else {
                  inputX = -Math.sin(tSec * 2 + a.spawnYaw) * 0.45;
                  inputZ = Math.cos(tSec * 2 + a.spawnYaw) * 0.45;
                }
              }
            }
            if (!evadingIncoming && a.hp <= a.maxHp * .6) {
              const nearestKit = healthKits.filter(kit => kit.active).sort((left, right) => {
                const l = NUKE_KIT_SPOTS[left.spotIndex], r = NUKE_KIT_SPOTS[right.spotIndex];
                return Math.hypot(l.x - a.x, l.z - a.z) - Math.hypot(r.x - a.x, r.z - a.z);
              })[0];
              if (nearestKit) {
                const spot = NUKE_KIT_SPOTS[nearestKit.spotIndex];
                const dx = spot.x - a.x, dz = spot.z - a.z;
                const distance = Math.max(.01, Math.hypot(dx, dz));
                inputX = dx / distance; inputZ = dz / distance;
              }
            }
          }
        }

        if (wantsAction && !wantsDodge && a.heldBallId !== null) performThrowBall(a);

        const remoteDodge = a.remotePlayerId ? remoteDodges.get(a.remotePlayerId) : undefined;
        if (a.remotePlayerId) remoteDodges.delete(a.remotePlayerId);
        if (remoteDodge) wantsDodge = true;
        const dodgeDirection = remoteDodge || nukeDodgeDirection(inputX, inputZ, a.targetYaw);
        if (wantsDodge && beginNukeDodge(a, dodgeDirection)) {
          if (a.isPlayer) multiplayerClient.sendGameEvent('nuke:dodge', dodgeDirection);
          a.jiggleVelY -= 3.0;
          a.jiggleVelRoll += dodgeDirection.x * 4;
          if (a.isPlayer) crayonAudio.playDive();

          const freeBallNearby =
            a.heldBallId === null
              ? dodgeballs.find(
                  (b) =>
                    b.state === 'free' &&
                    b.pickupCooldown <= 0 &&
                    Math.hypot(b.x - a.x, b.z - a.z) <= 3.2 &&
                    b.y <= 2.15
                )
              : undefined;

          const thrownBallNearby =
            a.heldBallId === null
              ? dodgeballs.find(
                  (b) =>
                    b.state === 'thrown' &&
                    b.holderId !== a.id &&
                    Math.hypot(b.x - a.x, b.z - a.z) <= 2.95
                )
              : undefined;

          if (freeBallNearby) {
            freeBallNearby.state = 'held';
            freeBallNearby.holderId = a.id;
            freeBallNearby.lastHitVictimId = null;
            freeBallNearby.floorRing.visible = false;
            freeBallNearby.beaconArrow.visible = false;
            freeBallNearby.trailMeshes.forEach((tm) => {
              tm.visible = false;
            });
            a.heldBallId = freeBallNearby.id;
            a.aiHoldTimer = 0;
            a.jiggleVelY += 3.2;
            if (a.isPlayer) {
              crayonAudio.playWeaponPickup();
              onCalloutRef.current?.('NUKE PICKED UP!', '#FACC15');
            }
          } else if (
            thrownBallNearby &&
            (a.isPlayer || Boolean(a.remotePlayerId) || Math.random() < 0.25)
          ) {
            thrownBallNearby.state = 'held';
            thrownBallNearby.holderId = a.id;
            thrownBallNearby.isSuperThrow = false;
            thrownBallNearby.floorRing.visible = false;
            thrownBallNearby.beaconArrow.visible = false;
            thrownBallNearby.trailMeshes.forEach((tm) => {
              tm.visible = false;
            });
            a.heldBallId = thrownBallNearby.id;
            a.catchesMade += 1;
            a.hp = Math.min(a.maxHp, a.hp + 35);
            a.superCharge = 100;
            spawnHitExplosion(a.x, a.y + 1.0, a.z, '#38BDF8', true);
            crayonAudio.playDodgeballCatch();
            if (a.isPlayer) {
              onCalloutRef.current?.('SUPER CATCH! +35 HP', '#38BDF8');
            } else {
              bannerText = `${a.name} CAUGHT THE NUKE!`;
              bannerTimer = 2.0;
            }
          }
        }

        if (wantsJump && a.grounded) {
          a.vy = JUMP_VY;
          a.grounded = false;
          a.jiggleVelY += 3.8;
          if (a.isPlayer) crayonAudio.playJumpBoing();
        }

        const airSpeedMult = a.grounded ? 1.0 : 0.88;
        const charSpeed =
          MOVE_SPEED *
          airSpeedMult *
          a.aiSpeedVar *
          (a.isPlayer ? 1.1 : 0.92 + diffObj.rushSpeedMult * 0.08);
        a.vx = remoteControlled(a) ? inputX * MOVE_SPEED : THREE.MathUtils.lerp(
          a.vx,
          inputX * charSpeed,
          movementBlend(dt, Math.hypot(inputX, inputZ) > .05, a.grounded)
        );
        a.vz = remoteControlled(a) ? inputZ * MOVE_SPEED : THREE.MathUtils.lerp(
          a.vz,
          inputZ * charSpeed,
          movementBlend(dt, Math.hypot(inputX, inputZ) > .05, a.grounded)
        );
        a.knockVx *= Math.pow(0.025, dt);
        a.knockVz *= Math.pow(0.025, dt);

        if (a.isPlayer) {
          if (a.heldBallId !== null) {
            const camYaw = camYawOffsetRef.current;
            a.targetYaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
          } else if (Math.hypot(inputX, inputZ) > 0.08) {
            a.targetYaw = Math.atan2(inputX, inputZ);
          } else {
            const camYaw = camYawOffsetRef.current;
            a.targetYaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
          }
        } else if (!a.remotePlayerId && Math.hypot(inputX, inputZ) > 0.08 && a.heldBallId === null) {
          a.targetYaw = Math.atan2(inputX, inputZ);
        } else if (!a.remotePlayerId && a.heldBallId !== null) {
          const enemy = findBestEnemyTarget(a);
          if (enemy) {
            a.targetYaw = Math.atan2(enemy.x - a.x, enemy.z - a.z);
          }
        }

        a.vy += GRAVITY * dt;
        a.x += (a.vx + a.knockVx) * dt;
        a.z += (a.vz + a.knockVz) * dt;
        a.y += a.vy * dt;

        if (a.y <= 0.02) {
          if (!a.grounded && a.vy < -3.0) {
            a.jiggleVelY -= Math.min(4.5, Math.abs(a.vy) * 0.32);
          }
          a.y = 0.02;
          a.vy = 0;
          a.grounded = true;
        }

        clampToNukeArena(a, .9);

        if (!matchEnded && countdownSec <= 0 && roundTransitionTimer <= 0 && a.hp < a.maxHp) {
          healthKits.forEach((kit, index) => {
            if (isKitAuthority()) collectKit(index, a);
            else if (a.isPlayer && kit.active && kitRequestCooldown <= 0 && Math.hypot(a.x - NUKE_KIT_SPOTS[kit.spotIndex].x, a.z - NUKE_KIT_SPOTS[kit.spotIndex].z) <= 1.5 && a.y < 1.4) {
              kitRequestCooldown = .3;
              multiplayerClient.sendGameEvent('nuke:collect-kit', { round: currentRound, index });
            }
          });
        }

        // Automatic Touch Pickup for either of the 2 loose Nuke balls
        if (
          a.heldBallId === null &&
          !a.remotePlayerId &&
          countdownSec <= 0 &&
          roundTransitionTimer <= 0 &&
          !matchEnded
        ) {
          const pickupRadius = a.isPlayer ? 3.2 : 1.65;
          for (const b of dodgeballs) {
            if (b.state !== 'free' || b.pickupCooldown > 0) continue;
            const canVictimTouch =
              b.lastHitVictimId !== a.id || b.idleTimer > 0.38;
            if (
              canVictimTouch &&
              Math.hypot(b.x - a.x, b.z - a.z) <= pickupRadius &&
              b.y <= 2.15
            ) {
              b.state = 'held';
              b.holderId = a.id;
              b.lastHitVictimId = null;
              b.floorRing.visible = false;
              b.beaconArrow.visible = false;
              b.trailMeshes.forEach((tm) => {
                tm.visible = false;
              });
              a.heldBallId = b.id;
              a.aiHoldTimer = 0;
              a.jiggleVelY += 3.0;
              if (a.isPlayer) {
                crayonAudio.playWeaponPickup();
                onCalloutRef.current?.('NUKE PICKED UP!', '#FACC15');
              }
              break;
            }
          }
        }
      }

      // 2. Athlete-to-Athlete Separation
      for (let i = 0; i < athletes.length; i++) {
        const a = athletes[i];
        if (a.eliminated) continue;
        for (let j = i + 1; j < athletes.length; j++) {
          const b = athletes[j];
          if (b.eliminated) continue;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const dist = Math.hypot(dx, dz);
          const minSep = !a.isPlayer && !b.isPlayer ? 2.4 : 1.5;
          if (dist > 0.001 && dist < minSep) {
            const push = (minSep - dist) * 0.5;
            const nx = dx / dist;
            const nz = dz / dist;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
          }
        }
      }

      // 3. Update BOTH Dodgeballs (Held in Hand, Swept Ballistic Flight, Ricochet & Rolling Physics!)
      for (const ball of dodgeballs) {
        if (ball.pickupCooldown > 0) {
          ball.pickupCooldown = Math.max(0, ball.pickupCooldown - dt);
        }

        if (ball.state === 'held') {
          const holder = athletes.find(
            (a) => a.id === ball.holderId && !a.eliminated
          );
          if (!holder) {
            ball.state = 'free';
            ball.holderId = null;
            ball.y = 0.54;
            ball.floorRing.visible = true;
            ball.beaconArrow.visible = false;
          } else {
            const rightX =
              Math.sin(holder.facingYaw) * 0.56 +
              Math.cos(holder.facingYaw) * 0.4;
            const rightZ =
              Math.cos(holder.facingYaw) * 0.56 -
              Math.sin(holder.facingYaw) * 0.4;
            ball.x = holder.x + rightX;
            ball.y = holder.visualY + 0.98;
            ball.z = holder.z + rightZ;
            ball.mesh.position.set(ball.x, ball.y, ball.z);
            ball.ballSphere.rotation.y += dt * 2.8;
            ball.floorRing.visible = false;
            ball.beaconArrow.visible = false;
          }
        } else if (ball.state === 'thrown') {
          const prevX = ball.x;
          const prevY = ball.y;
          const prevZ = ball.z;

          advanceNukeThrow(ball, dt);
          ball.ballSphere.rotation.x += dt * 20;
          ball.ballSphere.rotation.y += dt * 15;

          let hitOrCaught = false;
          const segDx = ball.x - prevX;
          const segDz = ball.z - prevZ;
          const segLenSq = segDx * segDx + segDz * segDz;

          for (const victim of athletes) {
            if (!matchSync.authority() || victim.id === ball.holderId || victim.eliminated) {
              continue;
            }
            let tProj = 1.0;
            if (segLenSq > 0.00001) {
              tProj = THREE.MathUtils.clamp(
                ((victim.x - prevX) * segDx + (victim.z - prevZ) * segDz) /
                  segLenSq,
                0,
                1
              );
            }
            const closestX = prevX + segDx * tProj;
            const closestY = prevY + (ball.y - prevY) * tProj;
            const closestZ = prevZ + segDz * tProj;
            const hDist = Math.hypot(victim.x - closestX, victim.z - closestZ);

            if (
              hDist <= NUKE_HIT_RADIUS &&
              closestY >= victim.y - 0.3 &&
              closestY <= victim.y + 2.35
            ) {
              const thrower = athletes.find((a) => a.id === ball.holderId);

              if (!nukeHitAllowed(victim.dodgeActiveTimer, victim.invulnTimer)) {
                if (victim.isPlayer) {
                  onCalloutRef.current?.('DODGED!', '#4ADE80');
                }
                continue;
              }

              hitOrCaught = true;

              const dmg = ball.isSuperThrow ? 55 : 40;
              victim.hp = Math.max(0, victim.hp - dmg);
              victim.invulnTimer = .45;
              matchSync.invalidate();
              // Show Health Bar ONLY for 2.2s after getting hit!
              victim.hitFlashTimer = 2.2;

              const spd = Math.max(1, Math.hypot(ball.vx, ball.vz));
              const dirX = ball.vx / spd;
              const dirZ = ball.vz / spd;
              const kb = ball.isSuperThrow ? 11.5 : 8.5;
              victim.knockVx = dirX * kb;
              victim.knockVz = dirZ * kb;
              victim.vy = 4.2;
              victim.grounded = false;
              victim.jiggleVelY += 5.0;
              victim.jiggleVelRoll += dirX * 6.2;

              if (thrower) {
                thrower.hitsScored += 1;
              }

              const isKo = victim.hp <= 0;
              spawnImpactBurst(
                victim.x,
                victim.y + 0.95,
                victim.z,
                dirX,
                dirZ,
                isKo ? 1.65 : ball.isSuperThrow ? 1.35 : 1.1
              );
              spawnHitExplosion(
                victim.x,
                victim.y + 0.95,
                victim.z,
                '#DC2626',
                ball.isSuperThrow
              );

              crayonAudio.playDodgeballHit(
                victim.config.id,
                ball.isSuperThrow,
                isKo
              );

              if (victim.isPlayer || thrower?.isPlayer) {
                screenShakeMag = ball.isSuperThrow ? 0.2 : 0.1;
              }

              if (isKo) {
                victim.eliminated = true;
                ragdolls.spawn(victim.rig, victim.knockVx, victim.knockVz);
                victim.group.visible = false;
                victim.hpBarBg.visible = false;
                victim.hpBarFill.visible = false;
                // If victim was holding the other ball, drop it immediately
                if (victim.heldBallId !== null) {
                  const dropped = dodgeballs.find(
                    (db) => db.id === victim.heldBallId
                  );
                  if (dropped) {
                    dropped.state = 'free';
                    dropped.holderId = null;
                    dropped.floorRing.visible = true;
                    dropped.beaconArrow.visible = false;
                  }
                  victim.heldBallId = null;
                }
                if (thrower) thrower.kills += 1;
                // Local kill count gets the shared one-second red confirmation.
                // Round information continues through the existing round HUD.
                bannerText = null;
                bannerTimer = 0;
              } else {
                const hitsLeft = Math.ceil(victim.hp / 40);
                if (victim.isPlayer) {
                  onCalloutRef.current?.(
                    `HIT! (${hitsLeft} HITS LEFT)`,
                    '#FB7185'
                  );
                } else if (thrower?.isPlayer) {
                  onCalloutRef.current?.(`NUKE HIT! -${dmg} HP`, '#FEF08A');
                }
              }

              ball.state = 'free';
              ball.holderId = null;
              ball.targetId = null;
              ball.pickupCooldown = 0.36;
              ball.lastHitVictimId = victim.id;
              ball.idleTimer = 0;

              const incomingAngle = Math.atan2(dirX, dirZ);
              const deflectOffset =
                (Math.random() < 0.5 ? -1 : 1) *
                (Math.PI * 0.42 + Math.random() * Math.PI * 0.42);
              const bounceAngle = incomingAngle + deflectOffset;
              const bounceSpeed = 11.0 + Math.random() * 4.0;
              ball.vx = Math.sin(bounceAngle) * bounceSpeed;
              ball.vz = Math.cos(bounceAngle) * bounceSpeed;
              ball.vy = 7.6 + Math.random() * 2.2;
              ball.trailMeshes.forEach((tm) => {
                tm.visible = false;
              });
              break;
            }
          }

          if (!hitOrCaught) {
            if (ball.y <= 0.54) {
              ball.y = 0.54;
              const horizSpd = Math.hypot(ball.vx, ball.vz);
              if (horizSpd > 15.5) {
                ball.vx *= 0.72;
                ball.vz *= 0.72;
                ball.vy = 4.8;
                crayonAudio.playBallBounce(0.75);
              } else {
                ball.state = 'free';
                ball.holderId = null;
                ball.targetId = null;
                ball.pickupCooldown = 0.14;
                ball.vx *= 0.78;
                ball.vz *= 0.78;
                ball.vy = Math.max(4.4, Math.abs(ball.vy) * 0.7);
                ball.trailMeshes.forEach((tm) => {
                  tm.visible = false;
                });
                crayonAudio.playBallBounce(0.72);
              }
            }
            if (bounceAtNukeBoundary(ball)) {
              ball.vy = Math.max(ball.vy, 4.2);
              ball.state = 'free'; ball.holderId = null; ball.targetId = null;
              ball.pickupCooldown = .16;
              ball.trailMeshes.forEach(tm => { tm.visible = false; });
              crayonAudio.playBallBounce(.7);
            }
          }

          ball.mesh.position.set(ball.x, ball.y, ball.z);
        } else {
          ball.vy -= 19.5 * dt;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          ball.z += ball.vz * dt;
          if (ball.y <= 0.54) {
            ball.y = 0.54;
            if (ball.vy < -1.8) {
              ball.vy = -ball.vy * 0.66;
              crayonAudio.playBallBounce(
                Math.min(0.85, Math.abs(ball.vy) / 9.0)
              );
            } else {
              ball.vy = 0;
            }
            ball.vx *= Math.pow(0.42, dt);
            ball.vz *= Math.pow(0.42, dt);
          }

          if (bounceAtNukeBoundary(ball)) crayonAudio.playBallBounce(.55);

          const rollSpeed = Math.hypot(ball.vx, ball.vz);
          if (rollSpeed < 0.8) {
            ball.idleTimer += dt;
            const distFromCenter = Math.hypot(ball.x - ball.homeX, ball.z - ball.homeZ);
            if (ball.idleTimer > 3.2 && distFromCenter > 6.5) {
              ball.idleTimer = 0;
              ball.vx = ((ball.homeX - ball.x) / distFromCenter) * 8.5;
              ball.vz = ((ball.homeZ - ball.z) / distFromCenter) * 8.5;
              ball.vy = 5.4;
              spawnHitExplosion(ball.x, 0.2, ball.z, '#FACC15', false);
            }
          } else {
            ball.idleTimer = 0;
          }

          const bob = rollSpeed < 0.6 ? Math.sin(tSec * 4.0 + ball.id) * 0.05 : 0;
          ball.mesh.position.set(ball.x, ball.y + bob, ball.z);
          ball.ballSphere.rotation.x += ball.vz * dt * 1.8;
          ball.ballSphere.rotation.z -= ball.vx * dt * 1.8;

          ball.floorRing.visible = true;
          ball.floorRing.position.set(ball.x, 0.042, ball.z);
          const ringPulse = 1 + Math.sin(tSec * 3.0 + ball.id) * 0.04;
          ball.floorRing.scale.setScalar(ringPulse);

          ball.beaconArrow.visible = false;
          ball.beaconArrow.position.set(
            ball.x,
            ball.y + 1.15 + Math.sin(tSec * 6.0 + ball.id) * 0.18,
            ball.z
          );
          ball.beaconArrow.rotation.y += dt * 3.0;
        }

        const trailActive = ball.state === 'thrown';
        ball.motionTrail.update(ball.x, ball.y, ball.z, dt, trailActive);
        for (let t = 0; t < TRAIL_LEN; t++) {
          const trailMesh = ball.trailMeshes[t];
          trailMesh.visible = trailActive;
          if (trailActive) {
            const point = ball.motionTrail.points[t];
            trailMesh.position.set(point.x, point.y, point.z);
          }
        }
      }

      bloodFeedback.update(dt);
      ragdolls.update(dt);
      // 5. Update 3D VFX Bursts & Crimson Blood Splatters
      for (let i = vfxBursts.length - 1; i >= 0; i--) {
        const p = vfxBursts[i];
        p.life -= dt;
        const prog = 1 - Math.max(0, p.life / p.maxLife);
        if (p.kind === 'ring') {
          p.mesh.scale.setScalar(1 + prog * 2.6);
          ((p.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
            (1 - prog) * 0.82;
        } else if (p.kind === 'blood_mist') {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.scale.setScalar(1 + prog * 2.5);
          ((p.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
            Math.max(0, (1 - prog) * 0.72);
        } else if (p.kind === 'blood_drop') {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 18.5 * dt;
          const fY = p.floorY ?? 0.035;
          if (p.mesh.position.y <= fY) {
            p.mesh.position.y = fY;
            p.vx *= 0.25;
            p.vz *= 0.25;
            p.vy = 0;
            p.mesh.scale.set(1.4, 0.25, 1.4);
          } else {
            p.mesh.scale.setScalar(Math.max(0.15, 1 - prog * 0.55));
          }
        } else if (p.kind === 'blood_splat') {
          const m = (p.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
          const fadeStart = 0.65;
          m.opacity =
            prog < fadeStart
              ? 0.85
              : Math.max(0, 0.85 * (1 - (prog - fadeStart) / (1 - fadeStart)));
        } else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 14.0 * dt;
          p.mesh.rotation.x += dt * 8;
          p.mesh.rotation.y += dt * 8;
          p.mesh.scale.setScalar(Math.max(0.05, 1 - prog));
        }
        if (p.life <= 0) {
          if (!combatVisuals.release(p.mesh) && p.mesh instanceof THREE.Mesh) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            for (const material of Array.isArray(p.mesh.material) ? p.mesh.material : [p.mesh.material]) material.dispose();
          }
          vfxBursts.splice(i, 1);
        }
      }

      // 6. Update Athlete Visual Transforms, Hit-Only Overhead HP Bars & Ragdoll Jiggle
      for (const a of athletes) {
        if (a.eliminated) continue;

        a.visualY = remoteControlled(a) ? a.y : a.visualY + (a.y - a.visualY) * (1 - Math.exp(-20 * dt));
        a.facingYaw = lerpAngleShortest(
          a.facingYaw,
          a.targetYaw,
          1 - Math.exp(-14 * dt)
        );
        if (remoteControlled(a)) smoothRemotePosition(a.group.position, { x: a.x, y: a.visualY, z: a.z }, dt);
        else a.group.position.set(a.x, a.visualY, a.z);
        a.group.rotation.y = a.facingYaw;
        updateCharacterGroundShadow(a.group, a.rig.shadowMesh);


        const bounce = stepCharacterSpring(a.jiggleY, a.jiggleVelY, 190, 10.5, dt, .28);
        a.jiggleY = bounce.position; a.jiggleVelY = bounce.velocity;
        const roll = stepCharacterSpring(a.jiggleRoll, a.jiggleVelRoll, 160, 9.5, dt, .24);
        a.jiggleRoll = roll.position; a.jiggleVelRoll = roll.velocity;

        const speed = Math.hypot(a.vx, a.vz);
        const runBounce =
          speed > 0.5 && a.grounded ? Math.sin(a.walkCycle * 2) * 0.04 : 0;
        const totJiggle = a.jiggleY + runBounce;

        if (a.rig.bodyGroup) {
          a.rig.bodyGroup.scale.set(
            1 - totJiggle * 0.22,
            1 + totJiggle * 0.3,
            1 - totJiggle * 0.22
          );
          a.rig.bodyGroup.rotation.z = a.jiggleRoll * 0.6;
        }
        if (a.rig.headGroup) {
          a.rig.headGroup.rotation.z = -a.jiggleRoll * 0.75;
        }

        if (speed > 0.45 && a.grounded) {
          if (a.isPlayer) crayonAudio.playFootstep();
          a.walkCycle += dt * speed * 2.1;
          const stride = Math.sin(a.walkCycle) * 0.48;
          if (a.rig.leftFoot) a.rig.leftFoot.rotation.x = stride;
          if (a.rig.rightFoot) a.rig.rightFoot.rotation.x = -stride;
          if (a.rig.leftArm) a.rig.leftArm.rotation.x = -stride * 0.65;
          if (a.rig.rightArm) {
            if (a.throwSwingTimer > 0) {
              a.rig.rightArm.rotation.x = -2.2;
            } else if (a.heldBallId !== null) {
              a.rig.rightArm.rotation.x = -1.25;
            } else {
              a.rig.rightArm.rotation.x = stride * 0.65;
            }
          }
        } else {
          if (a.rig.leftFoot) a.rig.leftFoot.rotation.x *= Math.exp(-12 * dt);
          if (a.rig.rightFoot) a.rig.rightFoot.rotation.x *= Math.exp(-12 * dt);
          if (a.rig.leftArm) a.rig.leftArm.rotation.x *= Math.exp(-12 * dt);
          if (a.rig.rightArm) {
            if (a.throwSwingTimer > 0) {
              a.rig.rightArm.rotation.x = -2.2;
            } else if (a.heldBallId !== null) {
              a.rig.rightArm.rotation.x = -1.25;
            } else {
              a.rig.rightArm.rotation.x *= Math.exp(-12 * dt);
            }
          }
        }
      }

      // 7. Check Elimination-Driven Round Progression:
      //    - Round 1 (starts with 4): advances ONLY when 1 player is eliminated (<= 3 alive)
      //    - Round 2 (starts with 3): advances ONLY when 1 more is eliminated (<= 2 alive)
      //    - Round 3 (starts with 2): ends when 1 is eliminated (1 Champion survivor wins!)
      const aliveAthletes = athletes.filter((a) => !a.eliminated);
      const roundLimitSec = Math.max(45, Math.floor(matchDurationSec / 3));

      if (
        !matchEnded &&
        countdownSec <= 0 &&
        roundTransitionTimer <= 0 &&
        roundTimeSec >= roundLimitSec &&
        !overtimeAnnounced
      ) {
        overtimeAnnounced = true;
        bannerText = 'OVERTIME! ROUND CONTINUES UNTIL AN ELIMINATION!';
        bannerTimer = 2.8;
        onCalloutRef.current?.('OVERTIME! ELIMINATE 1 RIVAL!', '#FACC15');
      }

      const targetSurvivorsForRound = nukeRoundSurvivors(athletes.length, currentRound);

      if (
        !matchEnded &&
        countdownSec <= 0 &&
        roundTransitionTimer <= 0 &&
        matchSync.authority() &&
        (aliveAthletes.length <= targetSurvivorsForRound ||
          (!matchSync.active() && playerAthlete.eliminated))
      ) {
        // Award a survival round point to all surviving athletes when a round concludes
        if (matchSync.active() || !playerAthlete.eliminated) {
          for (const surv of aliveAthletes) {
            surv.roundWins += 1;
          }
        }

        // Did the match reach the Final Champion (1 survivor left, Round 3 finished, or Local Player Eliminated)?
        if (
          (!matchSync.active() && playerAthlete.eliminated) ||
          currentRound >= (matchSync.active() ? athletes.length - 1 : MAX_REGULATION_ROUNDS) ||
          aliveAthletes.length <= 1
        ) {
          matchEnded = true;
          matchSync.publish(0, captureMatch, true);

          const champion =
            aliveAthletes.find((a) => a.isPlayer) ||
            [...aliveAthletes].sort(
              (a, b) => b.kills - a.kills || b.roundWins - a.roundWins
            )[0] ||
            [...athletes].sort(
              (a, b) => b.kills - a.kills || b.roundWins - a.roundWins
            )[0];
          const playerWon = !playerAthlete.eliminated && champion.isPlayer;
          const bestRivalWins = Math.max(
            0,
            ...athletes.filter((a) => !a.isPlayer).map((a) => a.roundWins)
          );

          if (playerWon) {
            crayonAudio.playVictoryFanfare();
            bannerText = `VICTORY! ${playerAthlete.name} IS THE NUKE CHAMPION!`;
            onCalloutRef.current?.('CHAMPION VICTORY!', '#4ADE80');
          } else {
            crayonAudio.playLoseStinger();
            bannerText = playerAthlete.eliminated
              ? `ELIMINATED IN ROUND ${currentRound}! ${champion.name} LEADS!`
              : `${champion.name} WON THE NUKE CHAMPIONSHIP!`;
            onCalloutRef.current?.(
              playerAthlete.eliminated
                ? `KNOCKED OUT IN ROUND ${currentRound}!`
                : `${champion.name.toUpperCase()} WINS!`,
              '#FB7185'
            );
          }
          bannerTimer = 2.6;

          resetInput();
          onGameOverRef.current(playerWon ? 'player' : 'ai', {
              nukeStandings: athletes.map(a => ({ id: a.id, name: a.name, charId: a.config.id, roundWins: a.roundWins, kills: a.kills, hits: a.hitsScored, catches: a.catchesMade, hp: Math.max(0, a.hp), alive: !a.eliminated, isPlayer: a.isPlayer })),
              playerScore: playerAthlete.roundWins,
              aiScore: bestRivalWins,
              bestRally: playerAthlete.kills,
              perfectSpikes: playerAthlete.hitsScored + playerAthlete.catchesMade,
              lastPointWinner: playerWon ? 'player' : 'ai',
              lastPointReason: playerWon
                ? `Nuke Champion! Survived all 3 Elimination Rounds (${playerAthlete.kills} KOs)!`
                : playerAthlete.eliminated
                  ? `Eliminated in Round ${currentRound} of 3 (${playerAthlete.kills} KOs)!`
                  : `${champion.name} won the Final Showdown!`,
              raceTimeSec: Number(totalMatchTimeSec.toFixed(1)),
              raceMaxFalls: playerAthlete.kills,
              raceProgressPct: playerWon
                ? 100
                : currentRound === 3
                  ? 85
                  : currentRound === 2
                    ? 60
                    : 35,
          });
        } else {
          // Advance to Next Elimination Round (Round 2 with 3 survivors, or Round 3 with 2 finalists!)
          crayonAudio.playScoreCheer();
          roundTransitionTimer = 2.6;
          const nextRound = currentRound + 1;
          bannerText =
            nextRound === 3
              ? `2 FINALISTS REMAIN! ADVANCING TO FINAL ROUND 3!`
              : `${aliveAthletes.length} SURVIVORS ADVANCE TO ROUND ${nextRound}!`;
          bannerTimer = 2.6;
          onCalloutRef.current?.(
            nextRound === 3
              ? 'FINAL 2 ADVANCE TO ROUND 3!'
              : `ROUND ${currentRound} COMPLETE!`,
            '#4ADE80'
          );
        }
      }

      matchSync.publish(rawDt, captureMatch);
      // 8. Third-Person Shooter-Style Rotatable Camera
      if (screenShakeMag > 0) {
        screenShakeMag = Math.max(0, screenShakeMag - rawDt * 2.4);
      }
      const shakeX = (Math.random() - 0.5) * screenShakeMag;
      const shakeY = (Math.random() - 0.5) * screenShakeMag;

      const aspect = camera.aspect || 1;
      const portraitFactor =
        aspect < 0.95
          ? THREE.MathUtils.clamp((0.95 - aspect) / 0.45, 0, 1.15)
          : 0;
      const effectiveFov = fovRef.current - 2 + portraitFactor * 10;
      if (Math.abs(camera.fov - effectiveFov) > 0.1) {
        camera.fov = effectiveFov;
        camera.updateProjectionMatrix();
      }

      const camFocusAthlete =
        !playerAthlete.eliminated
          ? playerAthlete
          : athletes.find((a) => !a.eliminated && a.heldBallId !== null) ||
            aliveAthletes[0] ||
            playerAthlete;

      if (!playerAthlete.eliminated && playerAthlete.heldBallId !== null && countdownSec <= 0) {
        const target = getCrosshairLockedEnemy();
        if (target) {
          aimProjection.set(target.x, target.y + 1.2, target.z).project(camera);
          const correction = nukeAimAssistStep(aimProjection.x, aimProjection.y, camera.aspect, camera.fov, rawDt);
          camYawOffsetRef.current += correction.yaw;
          camPitchOffsetRef.current = THREE.MathUtils.clamp(camPitchOffsetRef.current + correction.pitch, -.55, .7);
        }
      }
      const camYaw = camYawOffsetRef.current;
      const camPitch = THREE.MathUtils.clamp(
        camPitchOffsetRef.current,
        -0.55,
        0.7
      );
      const camDist = 6.8 + portraitFactor * 2.1;
      const camHeight =
        3.4 + portraitFactor * 1.15 + Math.sin(camPitch) * 3.2;
      cameraFollow.x = THREE.MathUtils.damp(cameraFollow.x, camFocusAthlete.x, 16, rawDt);
      cameraFollow.y = THREE.MathUtils.damp(cameraFollow.y, camFocusAthlete.visualY, 16, rawDt);
      cameraFollow.z = THREE.MathUtils.damp(cameraFollow.z, camFocusAthlete.z, 16, rawDt);

      const camTargetX =
        cameraFollow.x + Math.sin(camYaw) * camDist + Math.cos(camYaw) * .65;
      const camTargetY =
        cameraFollow.y + camHeight;
      const camTargetZ =
        cameraFollow.z + Math.cos(camYaw) * camDist - Math.sin(camYaw) * .65;

      const lookAheadDist = 11.0;
      const lookX =
        cameraFollow.x - Math.sin(camYaw) * lookAheadDist;
      const lookY =
        cameraFollow.y + 1.35 - Math.sin(camPitch) * 2.4;
      const lookZ =
        cameraFollow.z - Math.cos(camYaw) * lookAheadDist;

      camera.position.set(camTargetX + shakeX, camTargetY + shakeY, camTargetZ);
      camera.lookAt(lookX, lookY, lookZ);
      camera.updateMatrixWorld();
      if (crosshairRef.current) {
        crosshairRef.current.dataset.target = String(Boolean(getCrosshairLockedEnemy()));
        crosshairRef.current.dataset.ready = String(playerAthlete.heldBallId !== null);
        crosshairRef.current.style.visibility = playerAthlete.eliminated || countdownSec > 0 ? 'hidden' : 'visible';
      }
      for (const athlete of athletes) updateOverheadHealth(athlete.hpBarBg, athlete.hpBarFill, camera, athlete.hp, athlete.maxHp,
        hitHealthVisible(athlete.hp, 2.2 - athlete.hitFlashTimer, !athlete.eliminated));

      // 9. Smart Throttled HUD Sync (Only triggers React state update when displayed values actually change = ZERO lag!)
      const hasBall = playerAthlete.heldBallId !== null;
      const isSuperReady = playerAthlete.superCharge >= 100;
      const roundLimit = Math.max(45, Math.floor(matchDurationSec / 3));
      const ceilCountdown = Math.ceil(countdownSec);
      const ceilRemaining = Math.max(0, Math.ceil(roundLimit - roundTimeSec));
      const standingsSig = athletes
        .map(
          (at) =>
            `${at.id}:${at.eliminated ? 0 : 1}:${Math.ceil(at.hp)}:${at.roundWins}:${at.kills}`
        )
        .join('|');
      const nextHudKey = `${ceilCountdown}_${aliveAthletes.length}_${ceilRemaining}_${Math.ceil(playerAthlete.hp)}_${hasBall ? 1 : 0}_${isSuperReady ? 1 : 0}_${currentRound}_${isExtraRound ? 1 : 0}_${bannerText ?? ''}_${standingsSig}`;

      if (nextHudKey !== lastHudKey) {
        lastHudKey = nextHudKey;
        onHudUpdateRef.current({
          countdown: ceilCountdown,
          aliveCount: aliveAthletes.length,
          totalPlayers: athletes.length,
          survivalTimeSec: Math.floor(totalMatchTimeSec),
          timeRemainingSec: ceilRemaining,
          playerLives: Math.ceil((playerAthlete.hp / playerAthlete.maxHp) * 4),
          playerHp: Math.max(0, Math.ceil(playerAthlete.hp)),
          playerMaxHp: playerAthlete.maxHp,
          playerKills: playerAthlete.kills,
          holdingBallType: hasBall ? 'crimson' : 'none',
          superReady: isSuperReady,
          currentRound,
          maxRounds: MAX_REGULATION_ROUNDS,
          isExtraRound,
          playerRoundWins: playerAthlete.roundWins,
          roundStandings: athletes.map((at) => ({
            id: at.id,
            name: at.isPlayer
              ? playerDisplayName || 'YOU'
              : at.name.replace(' (YOU)', ''),
            roundWins: at.roundWins,
            kills: at.kills,
            hp: Math.max(0, Math.ceil(at.hp)),
            maxHp: at.maxHp,
            alive: !at.eliminated,
            isPlayer: at.isPlayer,
            colorHex: at.colorHex,
          })),
          lavaLevelMeters: playerAthlete.hitsScored + playerAthlete.catchesMade,
          lavaWarningState: isSuperReady
            ? 'ERUPTING!'
            : hasBall
              ? 'RISING!'
              : 'STABLE',
          tilesCrumbled: playerAthlete.kills,
          currentTier: currentRound,
          eliminationBanner: bannerText,
        });
      }

      netSyncAccum += rawDt;
      if (netSyncAccum >= 1 / 30 && !matchEnded) {
        netSyncAccum %= 1 / 30;
        multiplayerClient.sendPlayerTick({
          slotIndex: playerAthlete.slotIndex ?? 0,
          x: playerAthlete.x,
          y: playerAthlete.y,
          z: playerAthlete.z,
          vx: playerAthlete.vx,
          vy: playerAthlete.vy,
          vz: playerAthlete.vz,
          yaw: playerAthlete.facingYaw,
          hp: Math.round(playerAthlete.hp),
          maxHp: playerAthlete.maxHp,
          kills: playerAthlete.kills,
          holdingBallId: playerAthlete.heldBallId,
        });
      }

      postPipeline.render();
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      unsubRemoteTick();
      unsubRemoteEvent();
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', resetInput);
      document.removeEventListener('visibilitychange', onInputVisibility);
      resetInput();
      sizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      skyTexture.dispose();
      roundDeckTex.dispose(); courtDeckTex.dispose();
      deepOceanTex.dispose();
      lagoonTex.dispose();
      crimsonBallTex.dispose();
      bloodFeedback.dispose();
      combatVisuals.dispose();
      ragdolls.dispose();
      weather.dispose();
      postPipeline.dispose();
      disposeSceneGeometry(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [characterSceneKey(playerCharacter), aiDifficulty, lavaMapId, matchDurationSec]);

  // ===========================================================================
  // GUN-STYLE SCREEN ROTATION + HOLD SCREEN TO PICK BALL + AIM ASSIST THROW:
  // - Nearby loose balls are picked up automatically; no hold gesture is needed.
  // - Drag Right Side of Screen (or Move Mouse) = Rotate 3D Camera & Aim Crosshair!
  // - Tap Right Side / Left-Click = Throw along Crosshair with Aim Assist!
  // - Visible Dodge button / Right-Click = Dodge
  // - Visible left joystick = Movement
  // ===========================================================================
  const handleTouchAreaDown = (e: React.PointerEvent<HTMLDivElement>) => {
    screenHeldRef.current = true;
    const now = performance.now();
    if (e.pointerType === 'mouse') {
      if (e.button === 0) rightActionQueuedRef.current = true;
      if (e.button === 2) dodgeQueuedRef.current = true;
      if (e.button === 0 && !document.pointerLockElement) {
        try { void e.currentTarget.requestPointerLock()?.catch(() => {}); } catch { /* Drag aiming remains available. */ }
      }
      lastMousePosRef.current = { x: e.clientX, y: e.clientY, initialized: true };
      lookPointerRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, maxDrag: 0, downTime: now };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const bounds = e.currentTarget.getBoundingClientRect();
    const isRightHalf = e.clientX - bounds.left >= bounds.width * 0.48;
    const isSecondFingerTouch =
      joyPointerIdRef.current !== null &&
      joyPointerIdRef.current !== e.pointerId;

    // A third finger must not replace the finger that is already aiming.
    if ((isRightHalf || isSecondFingerTouch) && lookPointerRef.current.id !== null) return;

    // Right Half Touch = Hold to Pick Ball, Drag to Rotate Camera & Aim Crosshair, Tap to Throw!
    if (isRightHalf || isSecondFingerTouch) {
      touchActionsRef.current!.start(e);
      lookPointerRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        maxDrag: 0,
        downTime: now,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Movement comes from the visible joystick; left-screen taps have no action.
  };

  const handleTouchAreaMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Desktop Mouse Movement = Smoothly Rotate Camera & Aim Center Crosshair!
    if (e.pointerType === 'mouse') {
      if (lastMousePosRef.current.initialized) {
        const locked = document.pointerLockElement === e.currentTarget;
        const mdx = locked ? e.movementX : e.clientX - lastMousePosRef.current.x;
        const mdy = locked ? e.movementY : e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY, initialized: true };
        if (!locked && e.buttons === 0) return;
        const delta = nukeLookDelta(mdx, mdy, window.innerHeight, false);
        camYawOffsetRef.current += delta.yaw;
        camPitchOffsetRef.current = THREE.MathUtils.clamp(
          camPitchOffsetRef.current + delta.pitch,
          -0.55,
          0.7
        );
      }
      lookPointerRef.current.maxDrag = Math.max(lookPointerRef.current.maxDrag, Math.hypot(e.clientX - lookPointerRef.current.startX, e.clientY - lookPointerRef.current.startY));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY, initialized: true };
      return;
    }

    // Mobile/Touch Right Half Drag = Rotate Screen Camera & Aim Center Crosshair!
    if (lookPointerRef.current.id === e.pointerId) {
      touchActionsRef.current!.move(e);
      const dx = e.clientX - lookPointerRef.current.lastX;
      const dy = e.clientY - lookPointerRef.current.lastY;
      lookPointerRef.current.lastX = e.clientX;
      lookPointerRef.current.lastY = e.clientY;
      const totalDrag = Math.hypot(
        e.clientX - lookPointerRef.current.startX,
        e.clientY - lookPointerRef.current.startY
      );
      lookPointerRef.current.maxDrag = Math.max(
        lookPointerRef.current.maxDrag,
        totalDrag
      );

      const delta = nukeLookDelta(dx, dy, window.innerHeight, true);
      camYawOffsetRef.current += delta.yaw;
      camPitchOffsetRef.current = THREE.MathUtils.clamp(
        camPitchOffsetRef.current + delta.pitch,
        -0.55,
        0.7
      );
      return;
    }

    if (joyPointerIdRef.current !== e.pointerId) return;
    const maxR = 52;
    const rawDx = e.clientX - joyOriginRef.current.x;
    const rawDy = e.clientY - joyOriginRef.current.y;
    const dist = Math.hypot(rawDx, rawDy);
    const clamped = Math.min(dist, maxR);
    const angle = Math.atan2(rawDy, rawDx);
    const dx = dist > 4 ? Math.cos(angle) * clamped : 0;
    const dy = dist > 4 ? Math.sin(angle) * clamped : 0;

    joystickRef.current = {
      x: dx / maxR,
      y: dy / maxR,
      active: dist > 4,
    };
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }
  };

  const handleTouchAreaEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      lookPointerRef.current.id = null;
      screenHeldRef.current = false;
      return;
    }
    if (lookPointerRef.current.id === e.pointerId) {
      touchActionsRef.current!.end(e);
      lookPointerRef.current.id = null;
      if (joyPointerIdRef.current === null) {
        screenHeldRef.current = false;
      }
      return;
    }
    if (joyPointerIdRef.current !== e.pointerId) return;
    joyPointerIdRef.current = null;
    joystickRef.current = { x: 0, y: 0, active: false };
    if (lookPointerRef.current.id === null) {
      screenHeldRef.current = false;
    }
    if (joyContainerRef.current) {
      joyContainerRef.current.style.display = 'none';
    }
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full overflow-hidden select-none"
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Compact Precision Shooter Crosshair & Hold-Screen-to-Pick-Ball Touch Layer */}
      {gameState === 'PLAYING' && (
        <div
          ref={inputSurfaceRef}
          onPointerDown={handleTouchAreaDown}
          onPointerMove={handleTouchAreaMove}
          onPointerUp={handleTouchAreaEnd}
          onPointerCancel={handleTouchAreaEnd}
          onLostPointerCapture={handleTouchAreaEnd}
          className="fixed inset-0 z-10 pointer-events-auto touch-none select-none"
        >
          <div ref={crosshairRef} className="nuke-crosshair" aria-hidden="true"><svg viewBox="0 0 28 28"><path d="M14 3v5m0 12v5M3 14h5m12 0h5" /><circle cx="14" cy="14" r="1.3" fill="currentColor" stroke="none" /></svg></div>
          <div
            ref={joyContainerRef}
            style={{ display: 'none' }}
            className="pointer-events-none fixed -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/20 bg-white/[0.06] opacity-25 items-center justify-center"
          >
            <div
              ref={joyKnobRef}
              className="w-10 h-10 rounded-full bg-white/35 border border-white/40"
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default FloorIsLavaCanvas;

