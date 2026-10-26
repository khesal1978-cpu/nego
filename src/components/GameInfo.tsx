import { ExternalLink, Youtube } from 'lucide-react';
import { CREATOR_URL, PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../content/privacy';
import './gameInfo.css';

export function GameInfo() {
  return <div className="game-info">
    <section className="game-credit" aria-labelledby="credits-title">
      <div><span>Bonk Up</span><h2 id="credits-title">Created by ArsDev</h2><p>Game design & development</p></div>
      <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer"><Youtube size={20} />ArsDevS1<ExternalLink size={14} /><span className="sr-only"> on YouTube (opens a new tab)</span></a>
    </section>
    <section className="game-privacy" aria-labelledby="character-credits-title">
      <h2 id="character-credits-title">Character model credits</h2>
      <p><a href="https://sketchfab.com/3d-models/motu-patlu-26350fcd9da94bad9d14c832a97808c5" target="_blank" rel="noopener noreferrer">Motu model by Romeo_e</a> · <a href="https://sketchfab.com/3d-models/motu-patlu-b496a23255634b70ad0453528ac0d5bd" target="_blank" rel="noopener noreferrer">Patlu model by shreyhaldkar0</a>. Both licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Size, facing, limb articulation and match geometry adapted for Bonk Up; original textures retained.</p>
    </section>
    <section className="game-privacy" aria-labelledby="privacy-title">
      <header><div><h2 id="privacy-title">Privacy Policy</h2><p>Updated {PRIVACY_UPDATED}</p></div><a href="/privacy.html" target="_blank" rel="noopener noreferrer" aria-label="Open Privacy Policy in a new tab"><ExternalLink size={17} /></a></header>
      <p>{PRIVACY_INTRO}</p>
      {PRIVACY_SECTIONS.map(section => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}
    </section>
  </div>;
}
