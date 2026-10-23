interface Snapshot {
  code: string;
  version?: number;
  updatedAt?: number;
  slots: object[];
}

/** Membership is a snapshot: merging absent players back in resurrects leavers. */
export function latestRoomSnapshot<T extends Snapshot>(local: T | null | undefined, incoming: T): T {
  const sameRoom = local?.code === incoming.code;
  const delta = (incoming.version ?? 0) - (local?.version ?? 0);
  const newer = !sameRoom || delta > 0 || (delta === 0 && (incoming.updatedAt ?? 0) >= (local?.updatedAt ?? 0));
  const selected = newer ? incoming : local!;
  return { ...selected, slots: selected.slots.map(slot => ({ ...slot })) };
}
