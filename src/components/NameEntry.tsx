import React from 'react';
import './nameEntry.css';

interface Props {
  name: string;
  height: number;
  touch: boolean;
  portrait: React.ReactNode;
  onName: (name: string) => void;
  onConfirm: () => void;
}

export function NameEntry({ name, height, touch, portrait, onName, onConfirm }: Props) {
  return <div className={`name-entry ${height <= 500 ? 'name-entry--compact' : ''} ${height <= 280 ? 'name-entry--keyboard' : ''}`}>
    <form className="name-entry-card" role="dialog" aria-modal="true" aria-labelledby="name-entry-title" onSubmit={event => { event.preventDefault(); onConfirm(); }}>
      <div className="name-entry-intro">
        <div className="name-entry-portrait">{portrait}</div>
        <div><h2 id="name-entry-title">Choose your name</h2><p>Your name in games and custom rooms.</p></div>
      </div>
      <label className="name-entry-field" htmlFor="athlete-name">Player name
        <input id="athlete-name" name="athleteName" value={name} maxLength={16} autoFocus={!touch} autoComplete="nickname" autoCapitalize="off" spellCheck={false} enterKeyHint="go" placeholder="Enter athlete name…" onChange={event => onName(event.target.value)} />
      </label>
      <div className="name-entry-presets" aria-label="Suggested names">{['SIXGUN_KING', 'STORM_ACE', 'NUKE_BOSS', 'BLASTER_X', 'VOLLEY_PRO'].map(preset => <button type="button" key={preset} onClick={() => onName(preset)}>{preset}</button>)}</div>
      <button className="name-entry-submit" type="submit">Enter arena <span>as {name.trim() || 'LEO_PRO'}</span></button>
    </form>
  </div>;
}
