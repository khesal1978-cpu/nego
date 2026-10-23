import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const bundle = (entry) => buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, loader: { '.css': 'empty' } }).outputFiles[0].text;
function load(entry, globals = {}, mocks = {}) {
  const context = { module: { exports: {} }, require: name => mocks[name] ?? require(name), ...globals };
  vm.runInNewContext(bundle(entry), context);
  return context.module.exports;
}
let time = 1000, jumps = 0;
const gun = load('src/components/gunTouchControls.ts').createGunTouchActions(() => jumps++, () => time);
const pointer = (id, extra = {}) => ({ pointerId: id, pointerType: 'touch', button: 0, clientX: 750, clientY: 200, ...extra });
const tap = id => { gun.start(pointer(id)); time += 50; gun.end(pointer(id, { type: 'pointerup' })); };
tap(1); assert.equal(jumps, 0, 'Single tap leaves automatic firing alone');
time += 100; tap(2); assert.equal(jumps, 1, 'Completed double-tap jumps');
time += 500; tap(3); assert.equal(jumps, 1);
gun.start(pointer(4)); time += 700; gun.end(pointer(4, { type: 'pointerup' }));
tap(5); assert.equal(jumps, 1, 'Holds do not complete double-taps');
gun.reset(); tap(6); gun.start(pointer(7)); gun.move(pointer(7, { clientX: 800 })); gun.end(pointer(7, { type: 'pointerup' })); tap(8);
assert.equal(jumps, 1, 'Drag cancels the tap streak');
gun.reset(); tap(9); gun.start(pointer(10)); gun.end(pointer(10, { type: 'pointercancel' })); tap(11);
assert.equal(jumps, 1, 'Cancelled actions never jump');
gun.reset(); gun.start(pointer(12)); assert.equal(gun.start(pointer(13)), false, 'Extra fingers do not replace the action owner');
gun.end(pointer(13, { type: 'pointerup' })); gun.end(pointer(12, { type: 'pointerup' }));
assert.equal(jumps, 1); gun.reset();
gun.start(pointer(14, { pointerType: 'mouse' })); gun.end(pointer(14, { pointerType: 'mouse', type: 'pointerup' })); assert.equal(jumps, 1);
gun.start(pointer(15, { pointerType: 'mouse', button: 2 })); assert.equal(jumps, 2);

let nukeTime = 1000, throws = 0, dodges = 0, nukeTimerId = 0;
const nukeTimers = new Map();
const nuke = load('src/components/nukeTouchControls.ts', {
  setTimeout: (callback, delay) => { const id = ++nukeTimerId; nukeTimers.set(id, { callback, at: nukeTime + delay }); return id; },
  clearTimeout: id => nukeTimers.delete(id),
}).createNukeTouchActions(() => throws++, () => dodges++, () => nukeTime);
const advanceNuke = ms => { nukeTime += ms; for (const [id, timer] of nukeTimers) if (timer.at <= nukeTime) { nukeTimers.delete(id); timer.callback(); } };
const nukeTap = id => { nuke.start(pointer(id)); advanceNuke(40); nuke.end(pointer(id, { type: 'pointerup' })); };
nukeTap(101); assert.equal(throws, 0); advanceNuke(240); assert.equal(throws, 1);
nukeTap(102); advanceNuke(80); nukeTap(103); advanceNuke(400);
assert.equal(dodges, 1); assert.equal(throws, 1, 'Double-tap never throws the held ball first');
nukeTap(104); nuke.dodge(); advanceNuke(400);
assert.equal(dodges, 2); assert.equal(throws, 1, 'Dodge button acts immediately and cancels pending throw');
nukeTap(105); nuke.start(pointer(106)); nuke.move(pointer(106, { clientX: 810 })); nuke.end(pointer(106, { type: 'pointerup', clientX: 810 })); advanceNuke(400);
assert.equal(throws, 1); assert.equal(dodges, 2, 'Aiming drag does not trigger a second tap');
nukeTap(107); nuke.reset(); advanceNuke(400); assert.equal(throws, 1, 'Pause/unmount clears delayed actions');
nuke.start(pointer(108)); assert.equal(nuke.start(pointer(109)), false); nuke.end(pointer(108, { type: 'pointercancel' }));
assert.equal(nukeTimers.size, 0);
console.log('PASS: Nuke single throw, double-tap dodge without throwing, immediate dodge, drag/cancel and pause cleanup.');

const { characterSceneKey } = load('src/three/characterSceneKey.ts');
const { CRAYON_CHARACTERS } = load('src/types/game.ts');
const character = { ...CRAYON_CHARACTERS[0], faceId: 'goofy_smirk' };
assert.equal(characterSceneKey(character), characterSceneKey(Object.fromEntries(Object.entries(character).reverse())), 'Equivalent profile objects keep the running scene');
assert.notEqual(characterSceneKey(character), characterSceneKey({ ...character, faceId: 'fierce_pro' }));
assert.notEqual(characterSceneKey(character), characterSceneKey({ ...character, headShape: 'bean' }));

// Run the real component handlers/effects with a deterministic clock and native-event stand-ins.
function mountFullscreen(initial = false, autoHide = false, webkit = false, options = {}) {
  let clock = 0, nextTimer = 0, dirty = false, hook = 0, tree, requests = 0, exits = 0, unlocks = 0;
  const slots = [], effects = [], timers = new Map();
  const listeners = new Map();
  const doc = {
    fullscreenElement: !webkit && initial ? {} : null,
    webkitFullscreenElement: webkit && initial ? {} : null,
    documentElement: {},
    addEventListener(name, cb) { const set = listeners.get(name) || new Set(); set.add(cb); listeners.set(name, set); },
    removeEventListener(name, cb) { listeners.get(name)?.delete(cb); },
  };
  const dispatch = () => { for (const cb of listeners.get(webkit ? 'webkitfullscreenchange' : 'fullscreenchange') || []) cb(); };
  const enter = async () => { requests++; doc[webkit ? 'webkitFullscreenElement' : 'fullscreenElement'] = {}; dispatch(); };
  const exit = async () => { exits++; doc.fullscreenElement = null; doc.webkitFullscreenElement = null; dispatch(); };
  doc.documentElement[webkit ? 'webkitRequestFullscreen' : 'requestFullscreen'] = enter;
  doc[webkit ? 'webkitExitFullscreen' : 'exitFullscreen'] = exit;
  const schedule = (cb, delay) => { const id = ++nextTimer; timers.set(id, { cb, at: clock + delay }); return id; };
  const react = {
    useState(initial) { const i = hook++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; } }]; },
    useRef(value) { const i = hook++; if (!slots[i]) slots[i] = { current: value }; return slots[i]; },
    useEffect(cb, deps) { const i = hook++; if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i].deps[j]))) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = cb(); }); } },
  };
  const { FullscreenControl } = load('src/components/FullscreenControl.tsx', {
    document: doc, window: { dispatchEvent() {}, matchMedia: query => ({ matches: query === '(pointer: coarse)' }) },
    navigator: options.apple ? { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 } : {},
    screen: { orientation: { lock: options.lock || (async () => {}), unlock: () => unlocks++ } }, Event,
    setTimeout: schedule, clearTimeout: id => timers.delete(id),
  }, { react });
  const render = () => { let count = 0; do { dirty = false; hook = 0; tree = FullscreenControl({ autoHide }); for (const effect of effects.splice(0)) effect(); assert(++count < 20); } while (dirty); return tree; };
  const button = () => tree.props.children[0];
  const event = (extra = {}) => ({ button: 0, detail: 1, pointerId: 1, clientX: 800, clientY: 20, stopPropagation() {}, preventDefault() {}, currentTarget: { setPointerCapture() {}, matches: () => false }, ...extra });
  const advance = ms => { const target = clock + ms; while (true) { const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; clock = due[1].at; timers.delete(due[0]); due[1].cb(); render(); } clock = target; render(); };
  const tap = async () => { button().props.onPointerDown(event()); render(); button().props.onPointerUp(event()); render(); button().props.onClick(event()); await settle(); render(); };
  const hold = () => { button().props.onPointerDown(event()); render(); advance(550); button().props.onPointerUp(event()); render(); button().props.onClick(event()); render(); };
  render();
  return { render, button, tap, hold, advance, doc, exit, get guide() { return tree.props.children[3]; }, get visible() { return tree.props['data-visible']; }, get options() { return tree.props.children[1]; }, get requests() { return requests; }, get exits() { return exits; }, get unlocks() { return unlocks; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); assert.equal(timers.size, 0); for (const set of listeners.values()) assert.equal(set.size, 0); } };
}
for (const webkit of [false, true]) {
  const app = mountFullscreen(false, false, webkit);
  assert(app.visible); await app.tap(); assert.equal(app.requests, 1); assert(!app.visible, 'Entering fullscreen hides the icon immediately');
  app.advance(4000); await app.tap(); assert(app.visible && app.exits === 0, 'Hidden fullscreen corner reveals on a short tap without exiting');
  app.hold(); assert(app.visible && app.options, `550ms hold reveals On/Off without exiting (${webkit}, ${app.visible}, ${Boolean(app.options)}, ${app.exits})`);
  assert.equal(app.exits, 0);
  app.options.props.children[2].props.onClick({ stopPropagation() {} }); await settle(); app.render();
  assert(app.visible && app.exits === 1 && !app.button().props['aria-pressed']);
  await app.tap(); assert(!app.visible); await app.exit(); app.render(); assert(app.visible, 'System exit synchronizes icon and visibility');
  app.unmount();
}
const fullscreen = mountFullscreen(true); assert(!fullscreen.visible); fullscreen.advance(10000); assert(!fullscreen.visible); fullscreen.unmount();
const revealExit = mountFullscreen(true, true); await revealExit.tap(); assert(revealExit.visible && revealExit.exits === 0); await revealExit.tap(); assert.equal(revealExit.exits, 1, 'Second revealed tap toggles fullscreen'); revealExit.unmount();
const gameplay = mountFullscreen(false, true); gameplay.advance(3500); assert(!gameplay.visible); await gameplay.tap(); assert(gameplay.visible && gameplay.requests === 0, 'First hidden normal corner tap only reveals'); await gameplay.tap(); assert.equal(gameplay.requests, 1); gameplay.unmount();
console.log('PASS: Gun auto-fire touch actions, short double-tap jump, holds/drags/cancellation, stable appearance snapshots, standard/WebKit fullscreen, hold reveal, system exit and timer/listener cleanup.');
const hungLock = mountFullscreen(false, false, false, { lock: () => new Promise(() => {}) });
await hungLock.tap(); assert(!hungLock.button().props.disabled, 'Orientation-lock hang cannot disable fullscreen control');
await hungLock.tap(); await hungLock.tap(); assert.equal(hungLock.exits, 1); hungLock.unmount();
const hungRequest = mountFullscreen();
const workingRequest = hungRequest.doc.documentElement.requestFullscreen;
hungRequest.doc.documentElement.requestFullscreen = () => new Promise(() => {});
await hungRequest.tap(); assert(hungRequest.button().props.disabled);
hungRequest.advance(2001); assert(!hungRequest.button().props.disabled, 'Missing browser response releases the button');
hungRequest.doc.documentElement.requestFullscreen = workingRequest;
await hungRequest.tap(); assert.equal(hungRequest.requests, 1); hungRequest.unmount();
const iphone = mountFullscreen(false, false, false, { apple: true });
delete iphone.doc.documentElement.requestFullscreen;
await iphone.tap(); assert(iphone.guide && !iphone.button().props.disabled, 'Unsupported iPhone Safari offers Home Screen instructions'); iphone.unmount();
console.log('PASS: stuck fullscreen/orientation recovery, retry and iPhone Home Screen fallback.');
