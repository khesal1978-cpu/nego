import React, { useEffect, useRef, useState } from 'react';
import { TouchControlIcon } from './TouchControlIcon';
import { DEFAULT_TOUCH_LAYOUTS, normalizeTouchLayouts, touchJoystick, type ControlFamily, type TouchAction, type TouchButton, type TouchGameActions, type TouchLayouts } from './touchControlLayout';
import './touchControls.css';

const labels: Record<TouchAction, string> = { move: 'Move', fire: 'Fire', jump: 'Jump', throw: 'Throw', dodge: 'Dodge', spike: 'Hit / Jump', dive: 'Dive', lift: 'Set', super: 'Power' };
const shortLabels = { ...labels, spike: 'Hit' };
const pressAction = (actions: TouchGameActions, action: TouchAction) => {
  if (action === 'fire') { actions.fireRequested = true; actions.firingHeld = true; }
  if (action === 'jump') actions.jumpRequested = true;
  if (action === 'throw') actions.throwRequested = true;
  if (action === 'dodge') actions.dodgeRequested = true;
  if (action === 'spike') actions.spikeRequested = true;
  if (action === 'dive') actions.diveRequested = true;
  if (action === 'lift') actions.liftRequested = true;
  if (action === 'super') actions.superRequested = true;
};
type HudProps = {
  family: ControlFamily; layouts: TouchLayouts; actions?: React.MutableRefObject<TouchGameActions>;
  editing?: boolean; selected?: TouchAction; onSelect?: (action: TouchAction) => void;
  onPosition?: (action: TouchAction, x: number, y: number) => void;
};
export function TouchControls({ family, layouts, actions, editing, selected, onSelect, onPosition }: HudProps) {
  const active = useRef(new Map<number, { action: TouchAction; x: number; y: number; radius: number }>());
  const moveKnob = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const reset = () => {
    active.current.clear();
    if (actions) Object.assign(actions.current, {
      firingHeld: false, fireRequested: false, joystickActive: false, joystickX: 0, joystickY: 0,
      jumpRequested: false, throwRequested: false, dodgeRequested: false,
      spikeRequested: false, diveRequested: false, liftRequested: false, superRequested: false,
    });
    if (moveKnob.current) moveKnob.current.style.transform = '';
    root.current?.querySelectorAll<HTMLElement>('[data-held="true"]').forEach(button => { button.dataset.held = 'false'; });
  };
  useEffect(() => {
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset); document.addEventListener('visibilitychange', visibility);
    return () => { reset(); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', visibility); };
  }, [family, actions]);
  const end = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const held = active.current.get(event.pointerId);
    if (!held) return;
    active.current.delete(event.pointerId);
    event.currentTarget.dataset.held = 'false';
    if (held.action === 'fire' && actions) actions.current.firingHeld = false;
    if (held.action === 'move' && actions) {
      Object.assign(actions.current, { joystickActive: false, joystickX: 0, joystickY: 0 });
      if (moveKnob.current) moveKnob.current.style.transform = '';
    }
  };
  return <div ref={root} className={`touch-controls${editing ? ' touch-controls--editing' : ''}`} role="group" aria-label={`${family} mobile controls`}>
    {(Object.entries(layouts[family]) as [TouchAction, TouchButton][]).map(([action, layout]) => {
      return <button key={action} type="button" className={`touch-control touch-control--${action}`} aria-label={labels[action]}
        data-selected={editing && selected === action} style={{ '--requested-size': `${layout.size * (editing ? .7 : 1)}px`, '--control-opacity': editing ? Math.max(.5, layout.opacity) : layout.opacity, left: `clamp(calc(var(--control-size) / 2 + 4px), ${layout.x}%, calc(100% - var(--control-size) / 2 - 4px))`, top: `clamp(calc(var(--control-size) / 2 + 4px), ${layout.y}%, calc(100% - var(--control-size) / 2 - 4px))` } as React.CSSProperties}
        onPointerDown={event => {
          event.stopPropagation(); event.preventDefault();
          if ([...active.current.values()].some(pointer => pointer.action === action)) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          active.current.set(event.pointerId, { action, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * .35 });
          event.currentTarget.dataset.held = 'true';
          if (editing) { onSelect?.(action); return; }
          if (!actions) return;
          if (action === 'move') actions.current.joystickActive = true;
          else pressAction(actions.current, action);
        }}
        onPointerMove={event => {
          event.stopPropagation();
          const held = active.current.get(event.pointerId); if (!held) return;
          if (editing) {
            const rect = event.currentTarget.parentElement!.getBoundingClientRect();
            onPosition?.(action, Math.max(5, Math.min(95, (event.clientX - rect.left) / rect.width * 100)), Math.max(15, Math.min(90, (event.clientY - rect.top) / rect.height * 100)));
          } else if (action === 'move' && actions) {
            const vector = touchJoystick(event.clientX - held.x, event.clientY - held.y, held.radius);
            Object.assign(actions.current, { joystickX: vector.x, joystickY: vector.y, joystickActive: true });
            if (moveKnob.current) moveKnob.current.style.transform = `translate(${vector.x * held.radius}px, ${vector.y * held.radius}px)`;
          }
        }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onClick={event => { event.stopPropagation(); if (event.detail !== 0) return; if (editing) onSelect?.(action); else if (actions && action !== 'move') { pressAction(actions.current, action); actions.current.firingHeld = false; } }}>
        {action === 'move' ? <>
          <svg className="touch-stick-guides" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="m50 8-5 7h10ZM92 50l-7-5v10ZM50 92l5-7H45ZM8 50l7 5V45Z" /></svg>
          <span ref={moveKnob} className="touch-stick-knob"><span /></span>
        </> : <><TouchControlIcon action={action} /><small>{shortLabels[action]}</small></>}
      </button>;
    })}
  </div>;
}

export function TouchControlsEditor({ layouts, onChange }: { layouts: TouchLayouts; onChange: (layouts: TouchLayouts) => void }) {
  const [family, setFamily] = useState<ControlFamily>('gun');
  const [selected, setSelected] = useState<TouchAction>('move');
  const layout = layouts[family][selected] ?? layouts[family].move!;
  const patch = (action: TouchAction, changes: Partial<TouchButton>) => onChange(normalizeTouchLayouts({ ...layouts, [family]: { ...layouts[family], [action]: { ...layouts[family][action], ...changes } } }));
  return <div className="touch-editor">
    <div className="menu-section-heading"><div><h2>Customize controls</h2><p>Drag a button to move it. Select it to adjust its size and transparency. Changes save automatically.</p></div></div>
    <div className="menu-choices">{(['gun', 'nuke', 'volleyball'] as const).map(mode => <button key={mode} aria-pressed={family === mode} onClick={() => { setFamily(mode); setSelected('move'); }}>{mode === 'gun' ? 'Gun Fight' : mode === 'nuke' ? 'Nuke' : 'Volleyball'}</button>)}</div>
    <div className="touch-editor-preview"><span className="touch-editor-reticle">＋</span><TouchControls family={family} layouts={layouts} editing selected={selected} onSelect={setSelected} onPosition={(action, x, y) => patch(action, { x, y })} /></div>
    <div className="menu-choices touch-editor-buttons">{(Object.keys(layouts[family]) as TouchAction[]).map(action => <button key={action} aria-pressed={selected === action} onClick={() => setSelected(action)}>{labels[action]}</button>)}</div>
    <div className="touch-editor-sliders">{([
      ['size', 'Button size', selected === 'move' ? 84 : 44, selected === 'move' ? 160 : 100, 1],
      ['opacity', 'Opacity', .25, 1, .05], ['x', 'Horizontal position', 5, 95, 1], ['y', 'Vertical position', 15, 90, 1],
    ] as const).map(([key, label, min, max, step]) => <label key={key}><span>{label}<output>{key === 'opacity' ? `${Math.round(layout[key] * 100)}%` : `${Math.round(layout[key])}${key === 'size' ? 'px' : '%'}`}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={layout[key]} onChange={event => patch(selected, { [key]: Number(event.target.value) })} /></label>)}</div>
    <button type="button" className="menu-text-button" onClick={() => onChange({ ...layouts, [family]: structuredClone(DEFAULT_TOUCH_LAYOUTS[family]) })}>Reset this layout</button>
  </div>;
}
