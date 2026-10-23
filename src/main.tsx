import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ScreenSizeTester } from './components/ScreenSizeTester';
import './index.css';

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
createRoot(document.getElementById('root')!).render(screenTest ? <ScreenSizeTester /> : <App />);
