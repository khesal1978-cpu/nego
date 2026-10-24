import type { createRoomEngine, RoomNotice, RoomSnapshot } from './roomEngine';

export type RoomRecord = { epoch: string; revision: number; snapshot: RoomSnapshot };
export type RoomCommit = { kind: 'commit'; epoch: string; revision: number; notices: RoomNotice[] };
export interface RoomStore {
  read(): Promise<RoomRecord>;
  update<T>(change: (engine: ReturnType<typeof createRoomEngine>) => T): Promise<{ value: T; commit: RoomCommit }>;
  publish(message: unknown): Promise<void>;
  subscribe(message: (value: any) => void | Promise<void>, connected: () => Promise<void>, signal: AbortSignal): Promise<void>;
}
