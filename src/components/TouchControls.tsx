import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TouchControlIcon } from './TouchControlIcon';
import { DEFAULT_TOUCH_LAYOUTS, normalizeTouchLayouts, touchControlSizeLimits, touchJoystick, type ControlFamily, type TouchAction, type TouchButton, type TouchGameActions, type TouchLayouts } from './touchControlLayout';
import './touchControls.css';

const labels: Record<TouchAction, string> = { move: 'Move', fire: 'Fire', reload: 'Reload', jump: 'Jump', throw: 'Throw', dodge: 'Dodge', spike: 'Hit / Jump', dive: 'Dive', lift: 'Set', super: 'Power' };
const shortLabels = { ...labels, spike: 'Hit' };
const pressAction = (actions: TouchGameActions, action: TouchAction) => {
  if (action === 'fire') { actions.fireRequested = true; actions.firingHeld = true; }
  if (action === 'reload') actions.reloadRequested = true;
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
  embedded?: boolean; fullScreen?: boolean; previewOpacity?: boolean; onAction?: (action: TouchAction) => void;
};
export function TouchControls({ family, layouts, actions, editing, selected, onSelect, onPosition, embedded, fullScreen, previewOpacity, onAction }: HudProps) {
  const active = useRef(new Map<number, { action: TouchAction; x: number; y: number; radius: number; grabX: number; grabY: number; halfWidth: number; halfHeight: number }>());
  const moveKnob = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const reset = () => {
    active.current.clear();
    if (actions) Object.assign(actions.current, {
      firingHeld: false, fireRequested: false, reloadRequested: false, joystickActive: false, joystickX: 0, joystickY: 0,
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
  return <div ref={root} className={`touch-controls${editing ? ' touch-controls--editing' : ''}${embedded ? ' touch-controls--embedded' : ''}${fullScreen ? ' touch-controls--full' : ''}`} role="group" aria-label={`${family} mobile controls`}>
    {(Object.entries(layouts[family]) as [TouchAction, TouchButton][]).map(([action, layout]) => {
      return <button key={action} type="button" className={`touch-control touch-control--${action}`} aria-label={labels[action]}
        onFocus={() => { if (editing) onSelect?.(action); }}
        data-selected={editing && selected === action} style={{ '--requested-size': `${layout.size}px`, '--control-opacity': editing && !previewOpacity ? 1 : layout.opacity, left: `clamp(calc(var(--control-size) / 2 + 4px), ${layout.x}%, calc(100% - var(--control-size) / 2 - 4px))`, top: `clamp(calc(var(--control-size) / 2 + 4px), ${layout.y}%, calc(100% - var(--control-size) / 2 - 4px))` } as React.CSSProperties}
        onPointerDown={event => {
          event.stopPropagation(); event.preventDefault();
          if (editing && active.current.size) return;
          if ([...active.current.values()].some(pointer => pointer.action === action)) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
          active.current.set(event.pointerId, { action, x, y, radius: rect.width * .35, grabX: event.clientX - x, grabY: event.clientY - y, halfWidth: rect.width / 2, halfHeight: rect.height / 2 });
          event.currentTarget.dataset.held = 'true';
          if (editing) { onSelect?.(action); return; }
          if (!actions) return;
          if (action === 'move') actions.current.joystickActive = true;
          else pressAction(actions.current, action);
          onAction?.(action);
        }}
        onPointerMove={event => {
          event.stopPropagation();
          const held = active.current.get(event.pointerId); if (!held) return;
          if (editing) {
            const surface = event.currentTarget.parentElement!, rect = surface.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const padX = 4 * rect.width / (surface.clientWidth || rect.width), padY = 4 * rect.height / (surface.clientHeight || rect.height);
            const left = Math.max(5, (held.halfWidth + padX) / rect.width * 100), right = Math.min(95, 100 - (held.halfWidth + padX) / rect.width * 100);
            const top = Math.max(15, (held.halfHeight + padY) / rect.height * 100), bottom = Math.min(90, 100 - (held.halfHeight + padY) / rect.height * 100);
            onPosition?.(action, Math.max(left, Math.min(right, (event.clientX - held.grabX - rect.left) / rect.width * 100)), Math.max(top, Math.min(bottom, (event.clientY - held.grabY - rect.top) / rect.height * 100)));
          } else if (action === 'move' && actions) {
            const vector = touchJoystick(event.clientX - held.x, event.clientY - held.y, held.radius);
            Object.assign(actions.current, { joystickX: vector.x, joystickY: vector.y, joystickActive: true });
            if (moveKnob.current) moveKnob.current.style.transform = `translate(${vector.x * held.radius}px, ${vector.y * held.radius}px)`;
          }
        }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onClick={event => { event.stopPropagation(); if (event.detail !== 0) return; if (editing) onSelect?.(action); else if (actions && action !== 'move') { pressAction(actions.current, action); actions.current.firingHeld = false; onAction?.(action); } }}>
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
  const [expanded, setExpanded] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(true);
  const [previewOpacity, setPreviewOpacity] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 400, scale: 1 });
  const expandButton = useRef<HTMLButtonElement>(null);
  const fullEditor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      if (!width || !height || !preview.current?.clientWidth) return;
      setViewport({ width, height, scale: preview.current.clientWidth / width });
    };
    const observer = new ResizeObserver(measure);
    if (preview.current) observer.observe(preview.current);
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => {
    if (!expanded) return;
    fullEditor.current?.querySelector<HTMLButtonElement>('[data-done]')?.focus();
    return () => expandButton.current?.focus();
  }, [expanded]);
  const layout = layouts[family][selected] ?? layouts[family].move!;
  const sizeLimits = touchControlSizeLimits(selected, viewport.height);
  const size = Math.min(sizeLimits.max, layout.size);
  const patch = (action: TouchAction, changes: Partial<TouchButton>) => onChange(normalizeTouchLayouts({ ...layouts, [family]: { ...layouts[family], [action]: { ...layouts[family][action], ...changes } } }));
  return <div className="touch-editor">
    <div className="menu-section-heading"><div><h2>Customize controls</h2><p>Select a control, then drag it or adjust the sliders. Use full screen for precise placement. Changes save automatically.</p></div></div>
    <div className="menu-choices">{(['gun', 'nuke', 'volleyball'] as const).map(mode => <button key={mode} aria-pressed={family === mode} onClick={() => { setFamily(mode); setSelected('move'); }}>{mode === 'gun' ? 'Gun Fight' : mode === 'nuke' ? 'Nuke' : 'Volleyball'}</button>)}</div>
    <div ref={preview} className="touch-editor-preview" style={{ aspectRatio: `${viewport.width} / ${viewport.height}` }}><div className="touch-editor-preview-screen" style={{ width: viewport.width, height: viewport.height, transform: `scale(${viewport.scale})` }}><span className="touch-editor-reticle">＋</span><TouchControls family={family} layouts={layouts} editing previewOpacity={previewOpacity} selected={selected} onSelect={setSelected} onPosition={(action, x, y) => patch(action, { x, y })} /></div></div>
    <div className="touch-editor-active"><span className="touch-editor-active-icon">{selected === 'move' ? <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4v32M4 20h32M15 9l5-5 5 5M15 31l5 5 5-5M9 15l-5 5 5 5M31 15l5 5-5 5" /></svg> : <TouchControlIcon action={selected} />}</span><div><strong>{labels[selected]}</strong><small>{previewOpacity ? 'Game transparency preview' : 'Full opacity while editing'} · {Math.round(layout.opacity * 100)}%</small></div><button ref={expandButton} type="button" className="menu-primary" onClick={() => { setToolsVisible(true); setExpanded(true); }}>Edit full screen</button></div>
    <label className="touch-editor-opacity-preview"><input type="checkbox" checked={previewOpacity} onChange={event => setPreviewOpacity(event.target.checked)} />Preview game transparency</label>
    <div className="menu-choices touch-editor-buttons">{(Object.keys(layouts[family]) as TouchAction[]).map(action => <button key={action} aria-pressed={selected === action} onClick={() => setSelected(action)}>{labels[action]}</button>)}</div>
    <div className="touch-editor-sliders">{([
      ['size', 'Button size', sizeLimits.min, sizeLimits.max, 1],
      ['opacity', 'Opacity', .25, 1, .05], ['x', 'Horizontal position', 5, 95, 1], ['y', 'Vertical position', 15, 90, 1],
    ] as const).map(([key, label, min, max, step]) => <label key={key}><span>{label}<output>{key === 'opacity' ? `${Math.round(layout[key] * 100)}%` : `${Math.round(key === 'size' ? size : layout[key])}${key === 'size' ? 'px' : '%'}`}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={key === 'size' ? size : layout[key]} onChange={event => patch(selected, { [key]: Number(event.target.value) })} /></label>)}</div>
    <button type="button" className="menu-text-button" onClick={() => onChange({ ...layouts, [family]: structuredClone(DEFAULT_TOUCH_LAYOUTS[family]) })}>Reset this layout</button>
    {expanded && createPortal(<div ref={fullEditor} className="touch-editor-full" role="dialog" aria-modal="true" aria-label="Position controls" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); }
      if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button, select, input')], first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      const focusedControl = (event.target as HTMLElement).closest('.touch-control');
      if (focusedControl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? 5 : 1;
        patch(selected, { x: layout.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), y: layout.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) });
      }
    }}>
      <span className="touch-editor-reticle">＋</span>
      <TouchControls family={family} layouts={layouts} editing fullScreen previewOpacity={previewOpacity} selected={selected} onSelect={setSelected} onPosition={(action, x, y) => patch(action, { x, y })} />
      <div className="touch-editor-full-toolbar" data-collapsed={!toolsVisible}>
        {toolsVisible && <><div><select aria-label="Selected control" value={selected} onChange={event => setSelected(event.target.value as TouchAction)}>{(Object.keys(layouts[family]) as TouchAction[]).map(action => <option key={action} value={action}>{labels[action]}</option>)}</select><small>Drag to position · saved automatically</small></div><button type="button" aria-label="Smaller button" disabled={size <= sizeLimits.min} onClick={() => patch(selected, { size: Math.max(sizeLimits.min, size - 6) })}>−</button><output>{Math.round(size)}px</output><button type="button" aria-label="Larger button" disabled={size >= sizeLimits.max} onClick={() => patch(selected, { size: Math.min(sizeLimits.max, size + 6) })}>+</button></>}
        <button type="button" aria-expanded={toolsVisible} onClick={() => setToolsVisible(visible => !visible)}>{toolsVisible ? 'Hide tools' : 'Show tools'}</button><button type="button" data-done onClick={() => setExpanded(false)}>Done</button>
        {toolsVisible && <div className="touch-editor-full-opacity"><label>Opacity <input type="range" aria-label="Full-screen control opacity" min={.25} max={1} step={.05} value={layout.opacity} onChange={event => patch(selected, { opacity: Number(event.target.value) })} /><output>{Math.round(layout.opacity * 100)}%</output></label><label><input type="checkbox" checked={previewOpacity} onChange={event => setPreviewOpacity(event.target.checked)} />Preview</label></div>}
      </div>
    </div>, document.body)}
  </div>;
}
