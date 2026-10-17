import {
  clearDatabase,
  openDatabase,
  readTable,
  writeTables,
  type TableWrites,
} from "./idb";
import { TABLE_NAMES, type TableName, type Tables } from "./schema";

/* Waylay's database: every table held in memory, persisted to IndexedDB in
   the background. Reads are synchronous, so queries can run during render;
   each query records which tables it read, and only re-runs when one of
   those changes. Live reply text is kept out of the tables entirely (it
   changes every frame and only matters while it streams). */

export type StreamStatus = "pending" | "streaming" | "done" | "error" | "timeout";

export type StreamBody = { text: string; status: StreamStatus };

/** Something a query can depend on: a table, or the live stream buffers. */
export type Channel = TableName | "streams";

type Listener = () => void;

/** Writes coalesce for this long before they hit the disk. */
const PERSIST_DELAY_MS = 150;

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

class LocalDatabase {
  private readonly tables = new Map<TableName, Map<string, unknown>>(
    TABLE_NAMES.map((table) => [table, new Map()]),
  );
  private readonly versions = new Map<Channel, number>();
  private readonly listeners = new Set<Listener>();
  private readonly streams = new Map<string, StreamBody>();
  private readonly pendingWrites = new Map<TableName, TableWrites>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyScheduled = false;
  private tracker: Set<Channel> | null = null;
  private idb: IDBDatabase | null = null;
  private loading: Promise<void> | null = null;

  ready = false;
  /** Set when IndexedDB couldn't open: everything still works, in memory only. */
  storageError: Error | null = null;

  /** Opens and reads the database once; every caller shares the result. */
  load(): Promise<void> {
    if (!this.loading) this.loading = this.open();
    return this.loading;
  }

  private async open() {
    try {
      this.idb = await openDatabase();
      for (const table of TABLE_NAMES) {
        const rows = await readTable(this.idb, table);
        this.tables.set(table, new Map(rows.map((row) => [row._id, row])));
      }
      window.addEventListener("pagehide", () => void this.persistNow());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void this.persistNow();
      });
    } catch (error) {
      this.storageError = error instanceof Error ? error : new Error(String(error));
      console.warn("Waylay: browser storage is unavailable, so chats won't be saved —", error);
    }
    this.ready = true;
    for (const table of TABLE_NAMES) this.bump(table);
    this.bump("streams");
  }

  /* ---- Change tracking ------------------------------------------------ */

  version(channel: Channel): number {
    return this.versions.get(channel) ?? 0;
  }

  /** Runs `read` and reports the channels it touched, with their versions. */
  track<T>(read: () => T): { value: T; deps: Map<Channel, number> } {
    const previous = this.tracker;
    const touched = new Set<Channel>();
    this.tracker = touched;
    try {
      const value = read();
      return {
        value,
        deps: new Map([...touched].map((channel) => [channel, this.version(channel)])),
      };
    } finally {
      this.tracker = previous;
    }
  }

  isStale(deps: Map<Channel, number>): boolean {
    for (const [channel, version] of deps) {
      if (this.version(channel) !== version) return true;
    }
    return false;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private bump(channel: Channel) {
    this.versions.set(channel, this.version(channel) + 1);
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.notifyScheduled = false;
      for (const listener of [...this.listeners]) listener();
    });
  }

  /* ---- Reads ---------------------------------------------------------- */

  private table<T extends TableName>(table: T): Map<string, Tables[T]> {
    this.tracker?.add(table);
    return this.tables.get(table) as Map<string, Tables[T]>;
  }

  all<T extends TableName>(table: T): Tables[T][] {
    return [...this.table(table).values()];
  }

  get<T extends TableName>(table: T, id: string | null | undefined): Tables[T] | undefined {
    if (!id) return undefined;
    return this.table(table).get(id);
  }

  stream(streamId: string): StreamBody | undefined {
    this.tracker?.add("streams");
    return this.streams.get(streamId);
  }

  /* ---- Writes --------------------------------------------------------- */

  insert<T extends TableName>(
    table: T,
    row: Omit<Tables[T], "_id"> & { _id?: string },
  ): string {
    const id = row._id ?? createId();
    this.write(table, { ...row, _id: id } as Tables[T]);
    return id;
  }

  /** Merges fields into a row. A field set to `undefined` is removed. */
  patch<T extends TableName>(table: T, id: string, fields: Partial<Tables[T]>): void {
    const current = this.tables.get(table)?.get(id);
    if (!current) return;
    const next: Record<string, unknown> = { ...(current as Record<string, unknown>) };
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    this.write(table, next as Tables[T]);
  }

  delete(table: TableName, id: string): void {
    const rows = this.tables.get(table);
    if (!rows?.has(id)) return;
    rows.delete(id);
    const writes = this.writesFor(table);
    writes.puts.delete(id);
    writes.deletes.add(id);
    this.bump(table);
    this.schedulePersist();
  }

  private write<T extends TableName>(table: T, row: Tables[T]) {
    this.tables.get(table)?.set(row._id, row);
    const writes = this.writesFor(table);
    writes.deletes.delete(row._id);
    writes.puts.set(row._id, row);
    this.bump(table);
    this.schedulePersist();
  }

  /** Live reply text. Kept in memory only; the finished text lands on the message. */
  setStream(streamId: string, body: StreamBody | null): void {
    if (body) this.streams.set(streamId, body);
    else this.streams.delete(streamId);
    this.bump("streams");
  }

  /* ---- Persistence ---------------------------------------------------- */

  private writesFor(table: TableName): TableWrites {
    let writes = this.pendingWrites.get(table);
    if (!writes) {
      writes = { puts: new Map(), deletes: new Set() };
      this.pendingWrites.set(table, writes);
    }
    return writes;
  }

  private schedulePersist() {
    if (this.persistTimer || !this.idb) return;
    this.persistTimer = setTimeout(() => void this.persistNow(), PERSIST_DELAY_MS);
  }

  private async persistNow() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    if (!this.idb || this.pendingWrites.size === 0) return;
    const batch = new Map(this.pendingWrites);
    this.pendingWrites.clear();
    try {
      await writeTables(this.idb, batch);
    } catch (error) {
      console.warn("Waylay: couldn't save to browser storage —", error);
    }
  }

  /** Forgets everything: every chat, folder, memory and setting. */
  async clearAll(): Promise<void> {
    this.pendingWrites.clear();
    for (const rows of this.tables.values()) rows.clear();
    this.streams.clear();
    if (this.idb) await clearDatabase(this.idb);
    for (const table of TABLE_NAMES) this.bump(table);
    this.bump("streams");
  }
}

export type { LocalDatabase };

/** The one database for this tab. Loading starts on first use in the browser. */
export const db = new LocalDatabase();
