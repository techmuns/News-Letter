/* ============================================================
   File payload storage.

   Workspace item *metadata* lives in the zustand store (localStorage).
   The actual file bytes live here, in IndexedDB, because localStorage
   caps out around 5 MB and a single PDF blows straight through that.
   ============================================================ */

const DB_NAME = 'munshot-content-files'
const DB_VERSION = 1
const STORE = 'payloads'

export interface StoredFile {
  /** Matches the WorkspaceItem id. */
  id: string
  /** e.g. "application/pdf", "image/png" */
  mediaType: string
  /** Original filename, sent upstream so the model sees a real name. */
  filename: string
  /** Raw bytes. Converted to base64 only at send time. */
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the file database'))
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const req = run(transaction.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('File storage request failed'))
      }),
  )
}

export function putFile(file: StoredFile): Promise<void> {
  return tx<IDBValidKey>('readwrite', (s) => s.put(file)).then(() => undefined)
}

export function getFile(id: string): Promise<StoredFile | undefined> {
  return tx<StoredFile | undefined>('readonly', (s) => s.get(id))
}

export function deleteFile(id: string): Promise<void> {
  return tx<undefined>('readwrite', (s) => s.delete(id)).then(() => undefined)
}

/** Drops payloads whose item is no longer in the pile (e.g. removed while offline). */
export async function pruneFiles(keepIds: string[]): Promise<void> {
  const keep = new Set(keepIds)
  const all = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
  await Promise.all(
    all
      .map(String)
      .filter((id) => !keep.has(id))
      .map((id) => deleteFile(id)),
  )
}

/** Reads a stored payload as bare base64 (no data: prefix, no newlines). */
export async function toBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // Chunked to avoid blowing the argument limit on large files.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
