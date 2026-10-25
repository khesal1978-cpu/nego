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
assert.equal(bad.gun.fire.x, 95); assert.equal(bad.gun.fire.y, 15); assert.equal(bad.gun.fire.size, 100); assert.equal(bad.gun.fire.opacity, .6);
assert(bad.nuke.dodge); saved.set('bonkup-touch-layouts-v1', '{broken'); assert(m.readTouchLayouts().volleyball.spike);
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
byAction('move').props.onPointerCancel(pointer(1)); assert(!a.current.joystickActive && a.current.joystickX === 0);
byAction('fire').props.onPointerDown(pointer(5)); listeners.get('blur')(); assert(!a.current.firingHeld);
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
for (const family of ['gun', 'nuke', 'volleyball']) {
  tree = render(family);
  const html = renderToStaticMarkup(tree); assert(html.includes('aria-label="Move"'));
  assert(html.includes(family === 'gun' ? 'aria-label="Fire"' : family === 'nuke' ? 'aria-label="Dodge"' : 'aria-label="Hit / Jump"'));
}
console.log('PASS: visible per-mode buttons, multi-touch ownership, held fire/release, jump/throw/dodge/hit/set/power, cancel/blur, layout drag/persistence/corrupt storage.');

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
