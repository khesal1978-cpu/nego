import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const require = createRequire(import.meta.url);
const hooks = [], effects = [], timers = new Map();
let index = 0, now = 0, nextTimer = 0;
// Keep actual React elements/rendering; supply a deterministic hook clock.
const react = { ...React,
  useRef(value) { const i = index++; return hooks[i] ??= { current: value }; },
  useState(value) { const i = index++; hooks[i] ??= { value }; return [hooks[i].value, value => { hooks[i].value = value; }]; },
  useEffect(callback, dependencies) {
    const i = index++, prior = hooks[i];
    if (!prior || dependencies.some((value, j) => value !== prior.dependencies[j])) {
      prior?.cleanup?.(); hooks[i] = { dependencies }; effects.push(() => { hooks[i].cleanup = callback(); });
    }
  },
};
const code = buildSync({ entryPoints: ['src/components/GunFightHud.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, write: false }).outputFiles[0].text;
const context = { module: { exports: {} }, require: name => name === 'react' ? react : require(name), window: { setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; }, clearTimeout(id) { timers.delete(id); } } };
vm.runInNewContext(code, context);
const { GunFightKillNotice, GunFightScore } = context.module.exports;
const render = kills => { index = 0; let output = GunFightKillNotice({ kills }); while (effects.length) effects.shift()(); index = 0; output = GunFightKillNotice({ kills }); return renderToStaticMarkup(output); };
const tick = duration => { now += duration; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); } };
assert.equal(render(0), '');
assert(render(1).includes('1 Kill')); tick(999); assert(render(1).includes('1 Kill'));
tick(1); assert.equal(render(1), '', 'Kill confirmation disappears at one second');
assert(render(2).includes('2 Kills')); tick(600); assert(render(3).includes('3 Kills'));
tick(400); assert(render(3).includes('3 Kills'), 'A rapid next kill replaces and extends the notice');
tick(599); assert(render(3).includes('3 Kills')); tick(1); assert.equal(render(3), '');
assert(render(4).includes('4 Kills')); assert.equal(render(0), '', 'Match reset hides any pending notice');
tick(1000); assert.equal(render(0), ''); assert(render(1).includes('1 Kill'));
const timer = renderToStaticMarkup(React.createElement(GunFightScore, { hud: { timeRemainingSec: 92, playerKills: 15 } }));
assert(timer.includes('01:32')); assert(!timer.includes('15') && !timer.includes('eliminations'), 'Top bar keeps the clock; kill confirmation is transient');
console.log('PASS: first/repeated/rapid kills, full one-second lifetime, plural count, match reset and timer-only top bar.');
