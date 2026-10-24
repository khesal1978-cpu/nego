import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X, Share } from 'lucide-react';
import './fullscreenControl.css';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => void | Promise<void>;
};
const activeFullscreen = () => typeof document !== 'undefined' && Boolean(document.fullscreenElement || (document as FullscreenDocument).webkitFullscreenElement);
const appleTouchBrowser = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const standaloneApp = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));

/** Outside the canvas and inert rotation layer, so this owns its input gesture. */
export function FullscreenControl({ autoHide = false }: { autoHide?: boolean }) {
  const [active, setActive] = useState(activeFullscreen);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [installGuide, setInstallGuide] = useState(false);
  const [visible, setVisible] = useState(() => !activeFullscreen());
  const [activity, setActivity] = useState(0);
  const reveal = () => { setVisible(true); setActivity(value => value + 1); };
  const host = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPress = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const pending = useRef(false);
  const operation = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locked = useRef(false);
  const clearPress = () => { clearTimeout(timer.current); timer.current = undefined; };

  useEffect(() => {
    if (open || message || installGuide) { setVisible(true); return; }
    if (busy) return;
    if (active && activity === 0) { setVisible(false); return; }
    if (!active && !autoHide) { setVisible(true); return; }
    const hide = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(hide);
  }, [active, autoHide, open, busy, message, installGuide, activity]);

  useEffect(() => {
    const sync = () => {
      const next = activeFullscreen();
      clearTimeout(watchdog.current); watchdog.current = undefined;
      pending.current = false; setBusy(false);
      setActive(next);
      setOpen(false); setMessage(''); setInstallGuide(false); setActivity(0); setVisible(!next);
      if (!next && locked.current) { try { screen.orientation?.unlock?.(); } catch {} locked.current = false; }
      window.dispatchEvent(new Event('resize'));
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      clearPress();
      operation.current++; clearTimeout(watchdog.current);
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    host.current?.querySelector<HTMLButtonElement>('.fullscreen-options button')?.focus();
    const dismiss = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const change = async (enabled: boolean) => {
    if (pending.current) return;
    setOpen(false);
    setMessage('');
    setInstallGuide(false);
    if (activeFullscreen() === enabled) { setVisible(!enabled); setActivity(0); return; }
    pending.current = true; setBusy(true);
    const request = ++operation.current;
    watchdog.current = setTimeout(() => {
      if (request !== operation.current) return;
      operation.current++; pending.current = false; setBusy(false); setActive(activeFullscreen()); reveal();
      if (activeFullscreen() !== enabled) setMessage('Fullscreen did not respond. Tap again to retry.');
    }, 2000);
    try {
      const doc = document as FullscreenDocument;
      const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> };
      if (enabled) {
        if (root.requestFullscreen) await root.requestFullscreen();
        else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
        else if (appleTouchBrowser()) { setInstallGuide(true); reveal(); return; }
        else throw new Error('Fullscreen is unavailable in this browser.');
        if (request !== operation.current) return;
        try {
          const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
          if (orientation?.lock && window.matchMedia('(pointer: coarse)').matches) {
            // Optional rotation must never hold the fullscreen button disabled.
            void orientation.lock('landscape').then(() => {
              if (activeFullscreen()) locked.current = true;
              else { try { orientation.unlock?.(); } catch {} }
            }).catch(() => {});
          }
        } catch { /* Physical rotation is supported when orientation lock is unavailable. */ }
      } else {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      }
    } catch (error) {
      if (request === operation.current) {
        if (enabled && appleTouchBrowser()) { setInstallGuide(true); reveal(); }
        else setMessage(error instanceof Error && error.message.includes('unavailable') ? error.message : 'Fullscreen was blocked by the browser. Try tapping again.');
      }
    } finally {
      if (request === operation.current) {
        clearTimeout(watchdog.current); watchdog.current = undefined;
        setActive(activeFullscreen()); pending.current = false; setBusy(false);
        window.dispatchEvent(new Event('resize'));
      }
    }
  };

  if (standaloneApp()) return null;
  return <div ref={host} className="fullscreen-control" data-fullscreen-toggle data-visible={visible}
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { setOpen(false); setMessage(''); setInstallGuide(false); setVisible(!activeFullscreen()); setActivity(0); } }}
    onKeyUp={event => event.stopPropagation()}>
    <button type="button" className="fullscreen-button" disabled={busy} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) reveal(); }}
      aria-label={!visible ? 'Show fullscreen control' : active ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={active}
      aria-expanded={open} aria-controls="fullscreen-options" aria-haspopup="true"
      title={`${active ? 'Exit' : 'Enter'} fullscreen · Hold for On / Off`}
      onPointerDown={event => {
        event.stopPropagation();
        if (event.button !== 0 || busy) return;
        reveal();
        clearPress(); longPress.current = !visible; origin.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        timer.current = setTimeout(() => { longPress.current = true; reveal(); setOpen(value => !value); }, 550);
      }}
      onPointerMove={event => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 12) { clearPress(); longPress.current = true; } }}
      onPointerUp={event => { event.stopPropagation(); clearPress(); }}
      onPointerCancel={() => { clearPress(); longPress.current = true; }} onLostPointerCapture={clearPress}
      onContextMenu={event => { event.preventDefault(); clearPress(); longPress.current = true; setOpen(true); }}
      onClick={event => {
        event.stopPropagation();
        if (!visible && event.detail !== 0) { reveal(); return; }
        if (longPress.current && event.detail !== 0) { longPress.current = false; return; }
        reveal();
        void change(!activeFullscreen());
      }}>
      {active ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
    </button>
    {open && <div id="fullscreen-options" className="fullscreen-options" role="group" aria-label="Fullscreen options">
      <span>FULLSCREEN</span>
      <button type="button" aria-pressed={active} onClick={event => { event.stopPropagation(); void change(true); }}>On</button>
      <button type="button" aria-pressed={!active} onClick={event => { event.stopPropagation(); void change(false); }}>Off</button>
    </div>}
    {message && <p className="fullscreen-message" role="status" onClick={() => setMessage('')}>{message}</p>}
    {installGuide && <div className="fullscreen-install" role="dialog" aria-label="Full screen on iPhone and iPad">
      <header><strong>Play without browser bars</strong><button type="button" aria-label="Close instructions" onClick={() => setInstallGuide(false)}><X size={18} /></button></header>
      <p>This Safari tab cannot enter full screen. Open SIXGUN from your Home Screen instead.</p>
      <ol><li>Tap Safari’s <Share size={14} /> <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>. Keep <b>Open as Web App</b> on if shown.</li><li>Tap <b>Add</b>, open SIXGUN from its new icon and rotate your phone sideways.</li></ol>
      <small>Keep the game server and this link running.</small>
    </div>}
  </div>;
}
