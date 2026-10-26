import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ScreenSizeTester } from './components/ScreenSizeTester';
import './index.css';
import { preloadImportedCharacters } from './three/importedCharacters';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('WebSocket closed without opened') || msg.includes('@vite/client')) {
      event.preventDefault();
    }
  });
}

const previewParams = new URLSearchParams(window.location.search);
const screenTest = previewParams.get('screen-test') === '1';
const root = createRoot(document.getElementById('root')!);
async function start() {
  root.render(<div className="character-asset-loading" role="status"><strong>Bonk Up</strong><p>Getting your crew ready…</p></div>);
  try {
    await preloadImportedCharacters();
    root.render(screenTest ? <ScreenSizeTester /> : <App />);
  } catch {
    root.render(<div className="character-asset-loading" role="alert"><strong>Bonk Up</strong><p>Couldn’t load the characters. Check your connection and try again.</p><button onClick={start}>Try again</button></div>);
  }
}
void start();
