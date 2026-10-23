import { useState } from 'react';
import { LoaderCircle, Mic, MicOff } from 'lucide-react';
import { multiplayerClient } from '../network/multiplayerClient';
import { crayonAudio } from '../audio/crayonAudio';

export function VoiceMicControl({ inRoom, enabled, speaking }: { inRoom: boolean; enabled: boolean; speaking: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const label = !inRoom ? 'Join a custom room to use voice chat' : busy ? 'Waiting for microphone permission' : enabled ? 'Mute microphone' : 'Enable microphone';
  return <div className="hud-mic-control" onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <button type="button" className="hud-mic-button" title={label} aria-label={label} aria-pressed={enabled}
      aria-busy={busy} disabled={!inRoom || busy} data-speaking={speaking && enabled}
      onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
      onClick={async event => {
        event.stopPropagation(); if (busy || !inRoom) return;
        crayonAudio.playMenuClick(); setError(''); setBusy(true);
        const wasEnabled = multiplayerClient.micEnabled;
        try {
          const started = await multiplayerClient.toggleMicrophone();
          if (!wasEnabled && !started) setError(multiplayerClient.lastError || 'Microphone is unavailable. Check browser permission and try again.');
        } catch { setError('Microphone could not start. Check browser permission and try again.'); }
        finally { setBusy(false); }
      }}>
      {busy ? <LoaderCircle className="hud-mic-loading" aria-hidden="true" /> : enabled ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
      {enabled && <span className="hud-mic-dot" aria-hidden="true" />}
    </button>
    {error && <div className="hud-mic-error" role="status"><p>{error}</p><button type="button" onClick={() => setError('')}>Dismiss</button></div>}
  </div>;
}
