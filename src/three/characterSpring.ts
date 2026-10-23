/** Exact underdamped spring step: stays stable across slow frames and game speeds. */
export function stepCharacterSpring(position: number, velocity: number, stiffness: number, damping: number, dt: number, limit: number) {
  const time = Math.max(0, dt);
  const decay = damping / 2;
  const frequency = Math.sqrt(stiffness - decay * decay);
  const envelope = Math.exp(-decay * time);
  const sine = Math.sin(frequency * time), cosine = Math.cos(frequency * time);
  const next = envelope * (position * cosine + (velocity + decay * position) * sine / frequency);
  const nextVelocity = envelope * (velocity * cosine - (decay * velocity + stiffness * position) * sine / frequency);
  return { position: Math.max(-limit, Math.min(limit, next)), velocity: Math.abs(next) > limit && next * nextVelocity > 0 ? 0 : nextVelocity };
}
