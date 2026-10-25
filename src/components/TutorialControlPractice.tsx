import { useRef, useState } from 'react';
import { TouchControls } from './TouchControls';
import { DEFAULT_TOUCH_LAYOUTS, type ControlFamily, type TouchAction, type TouchGameActions } from './touchControlLayout';

const feedback: Record<TouchAction, string> = {
  move: 'Drag the stick to move', fire: 'Hold to fire · release to stop', reload: 'Reload refills your magazine',
  jump: 'Jump!', throw: 'Throw!', dodge: 'Dodge!', spike: 'Serve / jump-spike!',
  dive: 'Dive to save a low ball', lift: 'Set the ball up', super: 'Use a charged power spike',
};
export function TutorialControlPractice({ family, controls }: { family: ControlFamily; controls: readonly TouchAction[] }) {
  const actions = useRef<TouchGameActions>({ spikeRequested: false, diveRequested: false, superRequested: false });
  const [message, setMessage] = useState('Try the controls here');
  const layouts = { ...DEFAULT_TOUCH_LAYOUTS, [family]: Object.fromEntries(controls.map((action, index) => {
    const single = controls.length === 1, row = controls.length > 2;
    return [action, { x: single ? 50 : index % 2 === 0 ? 27 : 73, y: single || !row ? 48 : index < 2 ? 26 : 72, size: action === 'move' ? 76 : single ? 62 : 44, opacity: .95 }];
  })) };
  return <div className="tutorial-practice">
    <div className="tutorial-practice-screen"><TouchControls family={family} layouts={layouts} actions={actions} embedded onAction={action => setMessage(feedback[action])} /></div>
    <p className="tutorial-practice-feedback" role="status">{message}</p>
  </div>;
}
