import { ExternalLink, Youtube } from 'lucide-react';
import { CREATOR_URL, PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../content/privacy';
import './gameInfo.css';

export function GameInfo() {
  return <div className="game-info">
    <section className="game-credit" aria-labelledby="credits-title">
      <div><span>SIXZUN</span><h2 id="credits-title">Created by ArsDev</h2><p>Game design & development</p></div>
      <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer"><Youtube size={20} />ArsDevS1<ExternalLink size={14} /><span className="sr-only"> on YouTube (opens a new tab)</span></a>
    </section>
    <section className="game-privacy" aria-labelledby="privacy-title">
      <header><div><h2 id="privacy-title">Privacy Policy</h2><p>Updated {PRIVACY_UPDATED}</p></div><a href="/privacy.html" target="_blank" rel="noopener noreferrer" aria-label="Open Privacy Policy in a new tab"><ExternalLink size={17} /></a></header>
      <p>{PRIVACY_INTRO}</p>
      {PRIVACY_SECTIONS.map(section => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}
    </section>
  </div>;
}
