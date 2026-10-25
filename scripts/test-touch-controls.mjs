import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url), saved = new Map(), listeners = new Map();
let hooks = [], effects = [], index = 0;
const react = { ...React,
  useRef(value) { const i = index++; return hooks[i] ??= { current: value }; },
  useState(value) { const i = index++; hooks[i] ??= { value: typeof value === 'function' ? value() : value }; return [hooks[i].value, next => { hooks[i].value = next; }]; },
  useEffect(callback, deps) { const i = index++, prior = hooks[i]; if (!prior || deps.some((v, j) => v !== prior.deps[j])) { prior?.cleanup?.(); hooks[i] = { deps }; effects.push(() => { hooks[i].cleanup = callback(); }); } },
};
const surface = { addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
const code = buildSync({ stdin: { contents: `export * from './src/components/TouchControls'; export * from './src/components/touchControlLayout'; export * from './src/components/volleyballShot'; export * from './src/components/volleyballNetCollision'; export * from './src/components/matchSession'; export * from './src/network/playerControl';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, write: false }).outputFiles[0].text;
const context = { module: { exports: {} }, require: name => name === 'react' ? react : require(name), structuredClone, window: surface, document: { ...surface, hidden: false }, localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } };
vm.runInNewContext(code, context);
const m = context.module.exports;
const layouts = m.readTouchLayouts();
layouts.gun.fire = { x: 76, y: 59, size: 85, opacity: .45 };
m.saveTouchLayouts(layouts);
assert.equal(JSON.stringify(m.readTouchLayouts()), JSON.stringify(layouts), 'All per-mode custom controls survive reopening');
const bad = m.normalizeTouchLayouts({ gun: { fire: { x: 500, y: -99, size: 1000, opacity: NaN }, move: null }, nuke: null });
assert.equal(bad.gun.fire.x, 95); assert.equal(bad.gun.fire.y, 15); assert.equal(bad.gun.fire.size, 100); assert.equal(bad.gun.fire.opacity, m.DEFAULT_TOUCH_LAYOUTS.gun.fire.opacity);
assert(bad.nuke.dodge);
saved.set('bonkup-touch-layouts-v2', '{broken'); assert(m.readTouchLayouts().volleyball.spike);
saved.clear();
const legacyButton = (x, y, size) => ({ x, y, size, opacity: .6 });
const legacy = {
  gun: { move: legacyButton(14, 76, 112), fire: legacyButton(86, 69, 74), jump: legacyButton(94, 43, 54) },
  nuke: { move: legacyButton(14, 76, 112), throw: legacyButton(84, 65, 70), dodge: legacyButton(94, 81, 60), jump: legacyButton(94, 43, 54) },
  volleyball: { move: legacyButton(14, 76, 112), spike: legacyButton(88, 65, 72), dive: legacyButton(77, 83, 56), lift: legacyButton(95, 42, 54), super: legacyButton(78, 43, 54) },
};
saved.set('bonkup-touch-layouts-v1', JSON.stringify(legacy));
assert.equal(JSON.stringify(m.readTouchLayouts()), JSON.stringify(m.DEFAULT_TOUCH_LAYOUTS), 'Saved old defaults get the updated thumb layout');
legacy.nuke.jump.x = 70;
saved.set('bonkup-touch-layouts-v1', JSON.stringify(legacy));
const migrated = m.readTouchLayouts();
assert.equal(JSON.stringify(migrated.nuke), JSON.stringify(legacy.nuke), 'A customized family keeps every saved position, size and opacity');
assert.equal(JSON.stringify(migrated.gun), JSON.stringify(m.DEFAULT_TOUCH_LAYOUTS.gun), 'Untouched families still migrate');
m.saveTouchLayouts(migrated);
assert.equal(JSON.stringify(m.readTouchLayouts()), JSON.stringify(migrated), 'Migrated custom controls survive the next reload');
saved.clear(); saved.set('bonkup-touch-layouts-v1', '{broken'); assert(m.readTouchLayouts().volleyball.spike);
const a = { current: { spikeRequested: false, diveRequested: false, superRequested: false } };
function render(family, extra = {}) { index = 0; const tree = m.TouchControls({ family, layouts, actions: a, ...extra }); effects.splice(0).forEach(effect => effect()); return tree; }
let tree = render('gun');
const byAction = action => tree.props.children.find(button => button.props.className.endsWith(`--${action}`));
let stops = 0, captures = 0;
const target = { dataset: {}, setPointerCapture() { captures++; }, getBoundingClientRect: () => ({ left: 20, top: 20, width: 112, height: 112 }), parentElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 280 }) } };
const pointer = (id, extra = {}) => ({ pointerId: id, clientX: 76, clientY: 76, currentTarget: target, stopPropagation() { stops++; }, preventDefault() {}, ...extra });
byAction('move').props.onPointerDown(pointer(1)); byAction('move').props.onPointerMove(pointer(1, { clientX: 120, clientY: 90 }));
assert(a.current.joystickActive && a.current.joystickX > .8);
byAction('fire').props.onPointerDown(pointer(2)); assert(a.current.fireRequested && a.current.firingHeld);
assert(m.gunFireRequested(false, a.current.firingHeld, false), 'Held button fires in solo');
byAction('fire').props.onPointerDown(pointer(3)); assert.equal(captures, 2, 'An extra finger cannot replace a held button');
byAction('fire').props.onPointerUp(pointer(3)); assert(a.current.firingHeld, 'Unowned finger cannot stop firing');
a.current.fireRequested = false; byAction('fire').props.onPointerUp(pointer(2));
assert(!m.gunFireRequested(false, a.current.firingHeld, false), 'Release stops firing even with a visible target');
assert(a.current.joystickActive, 'Releasing Fire does not cancel movement');
byAction('jump').props.onPointerDown(pointer(4)); assert(a.current.jumpRequested);
byAction('reload').props.onPointerDown(pointer(40)); assert(a.current.reloadRequested, 'Reload button requests an early refill');
byAction('reload').props.onPointerUp(pointer(40));
byAction('move').props.onPointerCancel(pointer(1)); assert(!a.current.joystickActive && a.current.joystickX === 0);
byAction('fire').props.onPointerDown(pointer(5)); listeners.get('blur')(); assert(!a.current.firingHeld && !a.current.reloadRequested);
tree = render('nuke');
for (const [action, field] of [['throw', 'throwRequested'], ['dodge', 'dodgeRequested'], ['jump', 'jumpRequested']]) { a.current[field] = false; byAction(action).props.onPointerDown(pointer(10 + action.length)); assert(a.current[field]); byAction(action).props.onPointerUp(pointer(10 + action.length)); }
tree = render('volleyball');
for (const [action, field] of [['spike', 'spikeRequested'], ['dive', 'diveRequested'], ['lift', 'liftRequested'], ['super', 'superRequested']]) { a.current[field] = false; byAction(action).props.onPointerDown(pointer(20 + action.length)); assert(a.current[field]); byAction(action).props.onPointerUp(pointer(20 + action.length)); }
assert(stops > 20, 'Action button events do not leak into screen gestures');
let selected, moved;
tree = render('gun', { editing: true, onSelect: action => selected = action, onPosition: (...args) => moved = args });
a.current.fireRequested = false;
byAction('fire').props.onPointerDown(pointer(30)); byAction('fire').props.onPointerMove(pointer(30, { clientX: 450, clientY: 140 }));
assert.equal(selected, 'fire'); assert.equal(moved[0], 'fire'); assert.equal(moved[1], 75); assert.equal(moved[2], 50); assert(!a.current.fireRequested, 'Editing a button never fires');
byAction('fire').props.onPointerUp(pointer(30));
const editOrder = tree.props.children.map(button => button.props['aria-label']).join(',');
tree = render('gun', { editing: true, selected: 'move' });
assert.equal(tree.props.children.map(button => button.props['aria-label']).join(','), editOrder, 'Changing selection keeps DOM order and pointer capture stable');
tree = render('gun', { editing: true, selected: 'fire', onPosition: (...args) => moved = args });
assert.equal(byAction('fire').props.style['--requested-size'], '85px', 'Editor and gameplay use the same requested size');
assert.equal(byAction('fire').props.style['--control-opacity'], 1, 'Buttons remain readable while placing them');
byAction('fire').props.onPointerDown(pointer(31, { clientX: 95, clientY: 65 }));
byAction('fire').props.onPointerMove(pointer(31, { clientX: 95, clientY: 65 }));
assert(Math.abs(moved[1] - 76 / 600 * 100) < 1e-9);
assert(Math.abs(moved[2] - 76 / 280 * 100) < 1e-9, 'Dragging from the edge never snaps the button to the finger');
byAction('fire').props.onPointerMove(pointer(31, { clientX: 900, clientY: 400 }));
assert(moved[1] <= (600 - 60) / 600 * 100 && moved[2] <= (280 - 60) / 280 * 100, 'Dragging keeps the whole button inside the screen');
byAction('fire').props.onPointerUp(pointer(31));
tree = render('gun', { editing: true, previewOpacity: true });
assert.equal(byAction('fire').props.style['--control-opacity'], .45, 'Transparency preview uses the saved gameplay opacity');
for (const family of ['gun', 'nuke', 'volleyball']) {
  tree = render(family);
  const html = renderToStaticMarkup(tree); assert(html.includes('aria-label="Move"'));
  assert(html.includes(family === 'gun' ? 'aria-label="Fire"' : family === 'nuke' ? 'aria-label="Dodge"' : 'aria-label="Hit / Jump"'));
}
console.log('PASS: visible per-mode buttons, multi-touch ownership, held fire/release, jump/throw/dodge/hit/set/power, cancel/blur, layout drag/persistence/corrupt storage.');

// Exercise the settings editor itself, including a resized phone viewport and its portal.
let editorHooks = [], editorEffects = [], editorIndex = 0, editorDirty = false, observedResize;
const editorReact = { ...React,
  useRef(value) { const i = editorIndex++; return editorHooks[i] ??= { current: value }; },
  useState(value) { const i = editorIndex++; editorHooks[i] ??= { value: typeof value === 'function' ? value() : value }; return [editorHooks[i].value, next => { editorHooks[i].value = typeof next === 'function' ? next(editorHooks[i].value) : next; editorDirty = true; }]; },
  useEffect(callback, deps) { const i = editorIndex++, prior = editorHooks[i]; if (!prior || deps.some((v, j) => v !== prior.deps[j])) { editorHooks[i] = { deps }; editorEffects.push(() => { prior?.cleanup?.(); editorHooks[i].cleanup = callback(); }); } },
};
const editorWindow = { ...surface, innerWidth: 700, innerHeight: 280 };
const editorContext = { ...context, module: { exports: {} }, window: editorWindow, document: { ...surface, body: {} },
  ResizeObserver: class { constructor(callback) { observedResize = callback; } observe() {} disconnect() {} },
  require: name => name === 'react' ? editorReact : name === 'react-dom' ? { createPortal: child => child } : require(name),
};
vm.runInNewContext(code, editorContext);
const editorModule = editorContext.module.exports;
let editorLayouts = m.normalizeTouchLayouts(null), editorTree;
function renderEditor() {
  let count = 0;
  do {
    editorIndex = 0; editorDirty = false;
    editorTree = editorModule.TouchControlsEditor({ layouts: editorLayouts, onChange: next => { editorLayouts = next; editorDirty = true; } });
    editorEffects.splice(0).forEach(effect => effect());
    assert(++count < 10);
  } while (editorDirty);
}
function findEditor(predicate, node = editorTree) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) { const found = findEditor(predicate, child); if (found) return found; }
}
renderEditor();
findEditor(node => node.props?.className === 'touch-editor-preview').props.ref.current = { clientWidth: 350 };
observedResize(); renderEditor();
assert.equal(findEditor(node => node.props?.className === 'touch-editor-preview').props.style.aspectRatio, '700 / 280');
assert.equal(findEditor(node => node.props?.className === 'touch-editor-preview-screen').props.style.transform, 'scale(0.5)', 'Preview scales the whole gameplay viewport consistently');
const chooseControl = action => {
  findEditor(node => node.props?.className === 'menu-choices touch-editor-buttons').props.children.find(node => node.props.children === action).props.onClick(); renderEditor();
};
chooseControl('Fire');
let sizeSlider = findEditor(node => node.props?.['aria-label'] === 'Button size');
assert.equal(sizeSlider.props.max, 60); assert.equal(sizeSlider.props.value, 60, 'Slider shows the displayed size instead of a clamped-away saved value');
sizeSlider.props.onChange({ target: { value: '50' } }); renderEditor();
assert.equal(editorLayouts.gun.fire.size, 50);
findEditor(node => node.props?.children === 'Edit full screen').props.onClick(); renderEditor();
assert(findEditor(node => node.props?.role === 'dialog'));
findEditor(node => node.props?.['aria-label'] === 'Selected control').props.onChange({ target: { value: 'jump' } }); renderEditor();
findEditor(node => node.props?.['aria-label'] === 'Larger button').props.onClick(); renderEditor();
assert.equal(editorLayouts.gun.jump.size, 60);
assert(findEditor(node => node.props?.['aria-label'] === 'Larger button').props.disabled, 'Fullscreen size increments stop at the actual phone limit');
findEditor(node => node.props?.['aria-label'] === 'Full-screen control opacity').props.onChange({ target: { value: '.35' } }); renderEditor();
findEditor(node => node.props?.className === 'touch-editor-full-opacity').props.children[1].props.children[0].props.onChange({ target: { checked: true } }); renderEditor();
assert(findEditor(node => node.type === editorModule.TouchControls && node.props.fullScreen).props.previewOpacity);
assert.equal(editorLayouts.gun.jump.opacity, .35);
findEditor(node => node.props?.children === 'Hide tools').props.onClick(); renderEditor();
assert(!findEditor(node => node.props?.['aria-label'] === 'Selected control'), 'Tools can collapse to expose control positions');
findEditor(node => node.props?.children === 'Show tools').props.onClick(); renderEditor();
assert(findEditor(node => node.props?.['aria-label'] === 'Selected control'));
m.saveTouchLayouts(editorLayouts); assert.equal(m.readTouchLayouts().gun.jump.opacity, .35);
for (const [height, buttonMax, stickMax] of [[400,100,160],[360,72,100],[300,60,88],[260,52,88],[220,48,88]]) {
  assert.equal(editorModule.touchControlSizeLimits('fire',height).max,buttonMax);
  assert.equal(editorModule.touchControlSizeLimits('move',height).max,stickMax);
}
editorHooks.forEach(hook => hook?.cleanup?.());
console.log('PASS: stable editor selection/drag offsets, screen-edge bounds, scaled phone preview, usable size limits, fullscreen size/opacity editing, collapsible tools and saved layouts.');

// Run the actual swept collision engine at every difficulty's flight duration.
let cases = 0;
for (const radius of [.44, .66]) for (const gravity of [-14, -10.4]) for (const fps of [30, 60, 120])
for (const y of [.85, 1.6, 2.5, 3.8]) for (const z of [-.85, -2, -5.5]) for (const targetZ of [1.35, 3.4, 5.95]) for (const requested of [.54, .69, .82, 1.28]) {
  const time = m.volleyballAiFlight(y, z, targetZ, requested, gravity, radius);
  const ball = { bx: 0, by: y, bz: z, bvx: 2 / time, bvz: (targetZ - z) / time, bvy: (radius - y - .5 * gravity * time * time) / time };
  let elapsed = 0, hit = false;
  while (elapsed < time - 1e-8) { const dt = Math.min(1 / fps, time - elapsed); hit ||= m.stepVolleyballBall(ball, gravity, dt, radius); elapsed += dt; }
  assert(!hit, `AI return clears the net: radius=${radius}, fps=${fps}, y=${y}, z=${z}, target=${targetZ}, flight=${requested}`);
  assert(Math.abs(ball.bz - targetZ) < .001 && Math.abs(ball.bx - 2) < .001, 'Corrected flight preserves the tactical landing zone');
  cases++;
}
const maps = [{ id: 'fort' }, { id: 'snow' }, { id: 'jungle' }];
for (const random of [0, .49, .99]) assert.notEqual(m.nextRandomMap(maps, 'fort', () => random).id, 'fort');
assert.equal(m.nextRandomMap([{ id: 'fort' }], 'fort', () => 0).id, 'fort');
for (const mode of ['obstacle_rush', 'floor_is_lava', 'duo_2v2', 'hoop_volley']) {
  const room = { code: 'ROOM', mode: mode === 'duo_2v2' ? 'volleyball_1v1' : mode === 'hoop_volley' ? 'volleyball_2v2' : mode };
  assert.equal(m.activeMatchRoom(null, room, 'GAME_OVER', mode), null, 'Saved room membership never marks a solo match as custom');
  assert.equal(m.activeMatchRoom(room, room, 'GAME_OVER', mode), room);
  assert.equal(m.activeMatchRoom(room, { ...room, code: 'OTHER' }, 'GAME_OVER', mode), null);
  assert.equal(m.activeMatchRoom(room, room, 'TITLE_MENU', mode), null);
}
console.log(`PASS: ${cases} AI shots across ball sizes, gravity, frame rates and flight speeds; preserved landing zones; random nonrepeat maps; solo/custom session classification for every mode.`);
