import { useEffect, useRef } from 'react';
import { RotateCcw, Smartphone } from 'lucide-react';

export function LandscapePrompt() {
  const promptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    promptRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div ref={promptRef} className="landscape-prompt" role="dialog" aria-modal="true"
      aria-labelledby="landscape-title" aria-describedby="landscape-description" tabIndex={-1}
      onKeyDown={event => event.stopPropagation()}>
      <div className="landscape-prompt-content">
        <div className="landscape-prompt-animation" aria-hidden="true">
          <RotateCcw className="landscape-prompt-arrow" strokeWidth={1.25} />
          <Smartphone className="animate-phone-rotate" strokeWidth={1.25} />
        </div>
        <h1 id="landscape-title">Rotate to play</h1>
        <p id="landscape-description">Turn your device to landscape.<br />On desktop, make your window wider.</p>
        <span className="landscape-prompt-hint">Continue automatically when you’re ready.</span>
      </div>
    </div>
  );
}
