import { randomUUID } from 'node:crypto';
import { MongoClient, type Collection, type Db } from 'mongodb';
import { createRoomEngine, type RoomNotice } from './roomEngine.js';
import type { RoomCommit, RoomRecord, RoomStore } from './roomStore.js';

export function mongoEnvironment(env: Record<string, string | undefined>) {
  const uri = env.MONGODB_URI?.trim();
  if (!uri) return null;
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) throw Error('MONGODB_URI must be a MongoDB connection string.');
  const database = env.MONGODB_DB || 'sixzun';
  if (!/^[a-zA-Z0-9_-]{1,38}$/.test(database)) throw Error('MONGODB_DB must be a database name of up to 38 letters, digits, underscores or hyphens.');
  return { uri, database, namespace: env.MONGODB_NAMESPACE || `sixzun:${env.VERCEL_PROJECT_ID || 'game'}:${env.VERCEL_ENV || 'development'}` };
}

type MongoConfig = NonNullable<ReturnType<typeof mongoEnvironment>>;
type RuntimeDocument = {
  _id: string;
  namespace: string;
  kind: 'state' | 'relay';
  expiresAt: Date;
  record?: RoomRecord;
  commit?: RoomCommit;
  payload?: any;
};
const empty = (): RoomRecord => ({ epoch: '', revision: 0, snapshot: { rooms: [], clients: [] } });

// Shared by the endpoint's store in each warm Vercel instance. No connection per
// HTTP request or game packet; small pools leave room under Atlas Free's limit.
export function createMongoRoomStore(config: MongoConfig, providedDatabase?: Db): RoomStore {
  let client: MongoClient | undefined;
  let databasePromise: Promise<Db> | undefined;
  let readyPromise: Promise<Collection<RuntimeDocument>> | undefined;
  async function collection() {
    if (!readyPromise) {
      readyPromise = (async () => {
        if (!databasePromise) {
          databasePromise = providedDatabase ? Promise.resolve(providedDatabase) : (async () => {
            client = new MongoClient(config.uri, {
              maxPoolSize: 5, minPoolSize: 0, maxConnecting: 2, maxIdleTimeMS: 30000,
              serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, waitQueueTimeoutMS: 5000, socketTimeoutMS: 10000,
              retryWrites: true, readPreference: 'primary',
            });
            try { await client.connect(); return client.db(config.database); }
            catch (error) { await client.close().catch(() => {}); databasePromise = undefined; throw error; }
          })();
        }
        const db = await databasePromise;
        const coll = db.collection<RuntimeDocument>('multiplayer_runtime');
        await coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expire_runtime' });
        return coll;
      })().catch(error => { readyPromise = undefined; throw error; });
    }
    return await readyPromise;
  }
  const id = `state:${config.namespace}`;
  const active = (document: RuntimeDocument | null): RoomRecord => document?.record && document.expiresAt.getTime() > Date.now() ? document.record : empty();
  return {
    async read() { return active(await (await collection()).findOne({ _id: id })); },
    async update(change) {
      const coll = await collection();
      for (let attempt = 0; attempt < 8; attempt++) {
        const document = await coll.findOne({ _id: id });
        const previous = active(document), notices: RoomNotice[] = [];
        const engine = createRoomEngine(previous.snapshot, notice => notices.push(notice));
        for (const participant of engine.clients.values()) if (Date.now() - participant.lastSeenAt > 90000) {
          engine.removePlayerFromCurrentRoom(participant); engine.clients.delete(participant.playerId);
        }
        const value = change(engine), snapshot = engine.snapshot();
        if (snapshot.rooms.length > 150 || snapshot.clients.length > 750) throw Error('The lobby is busy. Please try again later.');
        const record: RoomRecord = { epoch: previous.epoch || randomUUID(), revision: previous.revision + 1, snapshot };
        const compact = new Map<string, RoomNotice>();
        for (const notice of notices) compact.set(`${notice.type}:${notice.room?.code || notice.code || ''}`, notice);
        const commit: RoomCommit = { kind: 'commit', epoch: record.epoch, revision: record.revision, notices: [...compact.values()] };
        const next: RuntimeDocument = { _id: id, namespace: config.namespace, kind: 'state', expiresAt: new Date(Date.now() + 7200000), record, commit };
        // The state and notification commit change atomically in ONE document.
        // No transaction or separate publish can lose a successful room update.
        if (document?.record) {
          const result = await coll.replaceOne({ _id: id, 'record.epoch': document.record.epoch, 'record.revision': document.record.revision }, next);
          if (!result.matchedCount) continue;
        } else {
          try { await coll.insertOne(next); }
          catch (error) { if ((error as { code?: number }).code === 11000) continue; throw error; }
        }
        return { value, commit };
      }
      throw Error('The room changed while updating. Please try again.');
    },
    async publish(payload) {
      await (await collection()).insertOne({ _id: randomUUID(), namespace: config.namespace, kind: 'relay', payload, expiresAt: new Date(Date.now() + 30000) });
    },
    async subscribe(message, connected, signal) {
      if (signal.aborted) return;
      const coll = await collection();
      if (signal.aborted) return;
      const stream = coll.watch([
        { $match: { operationType: { $in: ['insert', 'replace', 'update'] }, 'fullDocument.namespace': config.namespace } },
      ], { fullDocument: 'updateLookup', maxAwaitTimeMS: 1000 });
      const abort = () => { void stream.close().catch(() => {}); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      try {
        // watch() is lazy: establish its cursor before reading room state.
        // Changes during this read are buffered, then delivered in order.
        const first = await stream.tryNext();
        if (signal.aborted) return;
        await connected();
        const deliver = async (change: any) => {
          const document: RuntimeDocument | undefined = change?.fullDocument;
          if (!document || document.namespace !== config.namespace || document.expiresAt.getTime() <= Date.now()) return;
          if (document.kind === 'state' && document.commit) await message(document.commit);
          else if (document.kind === 'relay' && document.payload) await message(document.payload);
        };
        if (first) await deliver(first);
        for await (const change of stream) {
          if (signal.aborted) break;
          await deliver(change);
        }
      } catch (error) { if (!signal.aborted) throw error; }
      finally { signal.removeEventListener('abort', abort); await stream.close().catch(() => {}); }
      if (!signal.aborted) throw Error('Room event connection closed.');
    },
  };
}
