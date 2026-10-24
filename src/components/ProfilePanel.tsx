import React, { useState } from 'react';
import { ArrowLeft, Check, Pencil, UserRound } from 'lucide-react';
import { CHARACTER_FACES, CHARACTER_OUTFITS, type CharacterConfig } from '../types/game';
import { CharacterPreview3D } from './CharacterPreview3D';
import './profilePanel.css';

interface Props {
  name: string;
  characterName: string;
  characterTitle: string;
  character: CharacterConfig;
  height: number;
  onName: (name: string) => void;
  onBack: () => void;
}

export function ProfilePanel(p: Props) {
  const [draft, setDraft] = useState(p.name);
  const [saved, setSaved] = useState(false);
  const outfit = CHARACTER_OUTFITS.find(item => item.id === (p.character.outfitId || p.character.defaultOutfit));
  const face = CHARACTER_FACES.find(item => item.id === (p.character.faceId || p.character.defaultFace));
  const saveName = () => { const name = draft.trim().slice(0, 16) || p.name; setDraft(name); p.onName(name); setSaved(true); };
  const leave = () => { saveName(); p.onBack(); };
  return <section className={`profile-panel ${p.height <= 500 ? 'profile-panel--compact' : ''} ${p.height <= 280 ? 'profile-panel--keyboard' : ''}`} aria-label="Player profile">
    <header className="profile-header"><button className="profile-back" onClick={leave} aria-label="Back to main menu"><ArrowLeft size={20} /></button><div><span>SIXGUN</span><h1>PLAYER PROFILE</h1></div><span className="profile-header-badge"><UserRound size={14} />YOU</span></header>
    <div className="profile-layout">
      <section className="profile-showcase" aria-label="Your character"><div className="profile-hero-halo" aria-hidden="true" /><CharacterPreview3D character={p.character} /><div className="profile-hero-caption"><span className="profile-character-badge">{p.characterName}</span><h2>{p.name}</h2><p>DRAG TO ROTATE</p></div></section>
      <section className="profile-details" aria-label="Profile details"><div className="profile-card-header"><span className="profile-card-icon"><UserRound size={23} /></span><div><span className="profile-eyebrow">YOUR CALLSIGN</span><h2>MAKE IT YOURS</h2></div></div>
        <form onSubmit={event => { event.preventDefault(); saveName(); }}><label htmlFor="profile-name"><Pencil size={13} />PLAYER NAME</label><input id="profile-name" value={draft} maxLength={16} autoComplete="nickname" onChange={event => { setDraft(event.target.value); setSaved(false); }} onBlur={saveName} /><div className="profile-name-meta"><span>Shown in matches & rooms</span><span>{draft.length}/16</span></div><button className="profile-save" type="submit"><Check size={17} />{saved ? 'NAME SAVED' : 'SAVE NAME'}</button></form>
        <div className="profile-loadout"><span className="profile-eyebrow">EQUIPPED</span><div><strong>{p.characterName}</strong><span>{p.characterTitle}</span></div><dl><div><dt>OUTFIT</dt><dd>{outfit?.name}</dd></div><div><dt>FACE</dt><dd>{face?.name}</dd></div></dl><p>Change your look in Customize.</p></div>
        <button className="profile-done" onClick={leave}>DONE<Check size={18} /></button>
      </section>
    </div>
  </section>;
}
