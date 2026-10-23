export const MAX_REALTIME_BUFFER = 8192;

export function acceptSequence(previous: number | undefined, sequence: number | undefined) {
  return sequence === undefined || (Number.isInteger(sequence) && sequence >= 0 && (previous === undefined || sequence > previous));
}

// Reliable actions may arrive through different routes during a peer reconnect.
// Keep every distinct action, even when a newer one arrived first.
export function acceptEventSequence(history: Set<number>, sequence: number | undefined) {
  if (sequence === undefined) return true;
  if (!Number.isSafeInteger(sequence) || sequence < 0 || history.has(sequence)) return false;
  history.add(sequence);
  if (history.size > 512) history.delete(history.values().next().value!);
  return true;
}

// Discard late voice instead of accumulating seconds of speech behind live audio.
export function voiceStartTime(now: number, previousEnd: number) {
  return previousEnd > now + .15 ? now + .015 : Math.max(now + .015, previousEnd);
}
