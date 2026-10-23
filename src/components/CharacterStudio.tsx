import React, { useId, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { CHARACTER_FACES, CHARACTER_OUTFITS, CRAYON_CHARACTERS, HEAD_SHAPES, type CharacterConfig, type CharacterId, type FaceId, type HeadShape, type OutfitConfig, type OutfitId } from '../types/game';
import './gameMenus.css';
import './characterStudio.css';
import { CharacterPreview3D } from './CharacterPreview3D';

interface Props {
  character: CharacterConfig;
  selectedCharacter: CharacterId;
  outfit: OutfitId;
  face: FaceId;
  head: HeadShape;
  wide: boolean;
  onCharacter: (character: CharacterConfig) => void;
  onOutfit: (id: OutfitId) => void;
  onFace: (id: FaceId, head: HeadShape) => void;
  onHead: (id: HeadShape) => void;
  onBack: () => void;
  portrait: (character: CharacterConfig, face?: FaceId, head?: HeadShape) => React.ReactNode;
  outfitPreview: (outfit: OutfitConfig) => React.ReactNode;
}

export function CharacterStudio(p: Props) {
  const [tab, setTab] = useState<'characters' | 'outfits' | 'faces'>('characters');
  const id = useId();
  const tabs = ['characters', 'outfits', 'faces'] as const;
  const selectedName = tab === 'characters' ? p.character.name : tab === 'outfits' ? CHARACTER_OUTFITS.find(item => item.id === p.outfit)?.name : CHARACTER_FACES.find(item => item.id === p.face)?.name;
  return <section className={`character-studio ${p.wide ? 'studio-wide' : ''}`} aria-label="Customize your character">
    <header className="studio-header"><button className="menu-icon-button" onClick={p.onBack} aria-label="Back to main menu"><ArrowLeft size={19} /></button><div><h1>Customize</h1><p>Choose a character, outfit and expression.</p></div></header>
    <div className="studio-layout"><aside className="studio-profile"><span className="studio-eyebrow">Your athlete</span><h2>{p.character.name}</h2><p>{p.character.title}</p><div className="studio-equipped"><span>Equipped outfit</span><strong>{CHARACTER_OUTFITS.find(item => item.id === p.outfit)?.name}</strong><span>Expression</span><strong>{CHARACTER_FACES.find(item => item.id === p.face)?.name}</strong></div><dl><div><dt>Speed</dt><dd>{p.character.speed}</dd></div><div><dt>Jump</dt><dd>{p.character.floatiness}</dd></div><div><dt>Reach</dt><dd>{p.character.reach}</dd></div></dl></aside><div className="studio-preview-space" aria-label="Live 3D character preview"><CharacterPreview3D character={p.character} /></div><div className="studio-drawer"><div className="studio-tabs" role="tablist" aria-label="Appearance categories">{tabs.map((item, index) => <button key={item} id={`${id}-${item}`} role="tab" aria-selected={tab === item} aria-controls={`${id}-panel`} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1; if (next >= 0) { event.preventDefault(); setTab(tabs[next]); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus(); } }}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><div className="studio-selection-title"><h2>{tab === 'characters' ? 'Choose your athlete' : tab === 'outfits' ? 'Find your style' : 'Add some personality'}</h2><p aria-live="polite">{selectedName}</p></div><div className="studio-selection-content" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
      {tab === 'faces' && <div className="studio-head-shapes" role="group" aria-label="Head shape">{HEAD_SHAPES.map(shape => <button key={shape.id} aria-pressed={p.head === shape.id} onClick={() => p.onHead(shape.id)}>{shape.label}</button>)}</div>}
      <div className="studio-grid">{tab === 'characters' ? CRAYON_CHARACTERS.map(character => <button key={character.id} aria-pressed={p.selectedCharacter === character.id} onClick={() => p.onCharacter(character)}><div>{p.portrait(character)}</div><span>{character.name}</span>{p.selectedCharacter === character.id && <Check className="studio-selected" size={13} />}</button>) : tab === 'outfits' ? CHARACTER_OUTFITS.map(outfit => <button key={outfit.id} aria-pressed={p.outfit === outfit.id} onClick={() => p.onOutfit(outfit.id)}><div>{p.outfitPreview(outfit)}</div><span>{outfit.name}</span>{p.outfit === outfit.id && <Check className="studio-selected" size={13} />}</button>) : CHARACTER_FACES.map(face => <button key={face.id} aria-pressed={p.face === face.id} onClick={() => p.onFace(face.id, face.defaultHeadShape)}><div>{p.portrait(p.character, face.id, face.defaultHeadShape)}</div><span>{face.name}</span>{p.face === face.id && <Check className="studio-selected" size={13} />}</button>)}</div>
    </div><footer className="studio-footer"><span>Changes apply instantly</span><button className="menu-primary" onClick={p.onBack}>Done<Check size={15} /></button></footer></div></div>
  </section>;
}
