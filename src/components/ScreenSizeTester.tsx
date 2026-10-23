import { useEffect, useRef, useState } from 'react';
import './screenSizeTester.css';

const presets = [
  ['Tiny phone', 568, 320], ['Browser bars', 640, 280], ['Small phone', 640, 360], ['Phone', 844, 390], ['Wide phone', 915, 412], ['16:9', 1280, 720],
  ['Tablet 4:3', 1024, 768], ['Ultrawide', 1920, 800], ['Square', 720, 720], ['Portrait', 390, 844],
] as const;

export function ScreenSizeTester() {
  const [size, setSize] = useState({ width: 844, height: 390 });
  const [available, setAvailable] = useState({ width: 1000, height: 600 });
  const stage = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const scale = Math.max(.05, Math.min(1, (available.width - 28) / size.width, (available.height - 28) / size.height));
  return <main className="screen-tester">
    <header><div><h1>Screen-size test</h1><p>Change the frame while keeping the same game open.</p></div><a href={window.location.pathname}>Exit tester</a></header>
    <div className="screen-tester-controls">
      <div className="screen-tester-presets" role="group" aria-label="Screen presets">
        {presets.map(([name, width, height]) => <button key={name} aria-pressed={size.width === width && size.height === height} onClick={() => setSize({ width, height })}>{name}<small>{width} × {height}</small></button>)}
      </div>
      <div className="screen-tester-custom">
        <label>Width<input aria-label="Frame width" type="number" min="240" max="3840" value={size.width} onChange={e => setSize(v => ({ ...v, width: Math.max(240, Math.min(3840, Number(e.target.value) || 240)) }))} /></label>
        <label>Height<input aria-label="Frame height" type="number" min="240" max="2160" value={size.height} onChange={e => setSize(v => ({ ...v, height: Math.max(240, Math.min(2160, Number(e.target.value) || 240)) }))} /></label>
        <button onClick={() => setSize(v => ({ width: v.height, height: v.width }))}>Rotate frame</button>
        <output>{size.width} × {size.height} · shown at {Math.round(scale * 100)}%</output>
      </div>
    </div>
    <div className="screen-tester-stage" ref={stage}>
      <div style={{ width: size.width * scale, height: size.height * scale }}>
        <iframe ref={frame} title="Game at the selected screen size" src="?frame-test=1" allow="fullscreen" allowFullScreen
          style={{ width: size.width, height: size.height, transform: 'scale(' + scale + ')' }} />
      </div>
    </div>
  </main>;
}
