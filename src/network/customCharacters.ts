import { CRAYON_CHARACTERS, type CharacterConfig } from '../types/game';

type Slot = { occupiedBy: string; charId: string; outfitId: string; faceId: string; playerName: string };

// The room authority deals once, so every client sees the same character assignment.
export function dealCustomCharacters(slots: Slot[], random = Math.random) {
  const available = [...CRAYON_CHARACTERS];
  for (const slot of slots) {
    if (slot.occupiedBy === 'empty') continue;
    const choices = available.filter(character => character.id !== slot.charId);
    const character = choices[Math.floor(random() * choices.length)] || available[0];
    if (!character) continue;
    available.splice(available.indexOf(character), 1);
    slot.charId = character.id;
    slot.outfitId = character.defaultOutfit;
    slot.faceId = character.defaultFace;
    if (slot.occupiedBy === 'bot') slot.playerName = `BOT ${character.name.toUpperCase()}`;
  }
}

export function customCharacter(slot: { charId: string; outfitId: string; faceId: string } | undefined, fallback: CharacterConfig): CharacterConfig {
  if (!slot) return fallback;
  const character = CRAYON_CHARACTERS.find(character => character.id === slot.charId) || fallback;
  return { ...character, outfitId: character.defaultOutfit, faceId: character.defaultFace };
}
