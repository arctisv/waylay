import { TABLE_NAMES, type TableName, type Tables } from "./schema";

/* A thin promise layer over IndexedDB: one object store per table, keyed by
   `_id`. Reads happen once at startup; writes are batched by the caller. */

const DB_NAME = "waylay";
const DB_VERSION = 1;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const table of TABLE_NAMES) {
        if (!db.objectStoreNames.contains(table)) {
          db.createObjectStore(table, { keyPath: "_id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Waylay is open in an older tab. Close it and reload."));
  });
}

export async function readTable<T extends TableName>(
  db: IDBDatabase,
  table: T,
): Promise<Tables[T][]> {
  const store = db.transaction(table, "readonly").objectStore(table);
  return (await promisify(store.getAll())) as Tables[T][];
}

export type TableWrites = {
  puts: Map<string, unknown>;
  deletes: Set<string>;
};

/** Applies a batch of writes across tables in one transaction. */
export function writeTables(
  db: IDBDatabase,
  writes: Map<TableName, TableWrites>,
): Promise<void> {
  const tables = [...writes.keys()];
  if (tables.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(tables, "readwrite");
    for (const [table, { puts, deletes }] of writes) {
      const store = transaction.objectStore(table);
      for (const id of deletes) store.delete(id);
      for (const row of puts.values()) store.put(row);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Removes every record, for "delete all data". */
export function clearDatabase(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TABLE_NAMES, "readwrite");
    for (const table of TABLE_NAMES) transaction.objectStore(table).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
