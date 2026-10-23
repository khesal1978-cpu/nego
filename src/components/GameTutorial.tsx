import { useEffect, useRef, useState } from 'react';
import type { GameMode } from '../types/game';
import { GAME_TUTORIALS, tutorialFamily } from './gameTutorials';
import './gameTutorial.css';

export function GameTutorial({ mode, onClose }: { mode: GameMode; onClose: () => void }) {
  const tutorial = GAME_TUTORIALS[tutorialFamily(mode)];
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const motion = window.matchMedia('(pointer: coarse)');
    const update = () => setPhone(motion.matches); motion.addEventListener('change', update);
    const previous = document.activeElement as HTMLElement | null;
    if (document.pointerLockElement) document.exitPointerLock();
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { motion.removeEventListener('change', update); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const item = tutorial.steps[step];
  return <div className="tutorial-overlay" onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}>
    <div ref={panel} className="tutorial-panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }} onKeyUp={event => event.stopPropagation()}>
      <header><div><span>HOW TO PLAY · {step + 1} / {tutorial.steps.length}</span><h1 id="tutorial-title">{tutorial.name}</h1></div><button type="button" className="tutorial-skip" onClick={onClose}>Skip</button></header>
      <p className="tutorial-goal">{tutorial.goal}</p>
      <div className="tutorial-body" aria-live="polite">
        <div className={`tutorial-demo tutorial-demo--${item.gesture}`} aria-hidden="true"><div className="tutorial-screen">{item.gesture === 'auto' ? <><i className="tutorial-auto-target" /><span>FIRES AUTOMATICALLY</span></> : <><span>MOVE</span><span>{tutorialFamily(mode) === 'gun' ? 'DOUBLE-TAP TO JUMP' : item.gesture === 'swipe' ? 'SWIPE TO HIT' : item.gesture === 'double' && tutorialFamily(mode) === 'nuke' ? 'DODGE' : 'AIM / ACTION'}</span><i className="tutorial-finger" /><b className="tutorial-path" /></>}</div></div>
        <div><h2>{item.title}</h2><p>{phone ? item.phone : item.desktop}</p></div>
      </div>
      <footer><div className="tutorial-progress" aria-label={`Step ${step + 1} of ${tutorial.steps.length}`}>{tutorial.steps.map((_, index) => <i key={index} data-active={index === step} />)}</div><div>{step > 0 && <button type="button" onClick={() => setStep(value => value - 1)}>Back</button>}<button type="button" className="tutorial-next" onClick={() => step === tutorial.steps.length - 1 ? onClose() : setStep(value => value + 1)}>{step === tutorial.steps.length - 1 ? 'Let’s play' : 'Next'}</button></div></footer>
    </div>
  </div>;
}
