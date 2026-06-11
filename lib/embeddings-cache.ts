// Persistent client-side cache for the heavy face-embeddings payload.
//
// A kiosk re-enters face-match mode many times a day. Without this cache every
// hydrate re-downloads the multi-MB embeddings list from origin, which is the
// dominant driver of Vercel "Fast Origin Transfer" during morning check-in.
//
// We keep ONE snapshot in IndexedDB (localStorage can't hold ~6MB) and only
// re-download when the active roster changes or the snapshot ages out. The
// fingerprint is the SORTED set of active student ids — deliberately NOT the
// embedding count or updated_at, because the per-scan "learn this face" path
// bumps both on every scan (via the std_students_updated_at trigger), which
// would make the fingerprint churn constantly and defeat the cache. New
// enrollments / removals change the id set and propagate immediately; existing
// students re-enrolled with better faces propagate on the next age-out.

export type EmbeddingRow = { id: string; face_embeddings: number[][] }

export type CachedEmbeddings = {
  fingerprint: string
  savedAt: number
  rows: EmbeddingRow[]
}

const DB_NAME = 'stuface-cache'
const STORE = 'kv'
const KEY = 'active-embeddings'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, 1)
    } catch {
      return resolve(null)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

export async function loadCachedEmbeddings(): Promise<CachedEmbeddings | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as CachedEmbeddings) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveCachedEmbeddings(v: CachedEmbeddings): Promise<void> {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(v, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

// Append a just-scanned face into the cached snapshot so a page reload keeps
// the locally-learned embedding (mirrors the server's rolling buffer of 20).
// Leaves fingerprint/savedAt untouched so the normal age-out still pulls the
// authoritative server copy later.
export async function patchCachedEmbedding(
  studentId: string,
  embedding: number[],
): Promise<void> {
  const cached = await loadCachedEmbeddings()
  if (!cached) return
  let found = false
  const rows = cached.rows.map((r) => {
    if (r.id !== studentId) return r
    found = true
    return { ...r, face_embeddings: [...r.face_embeddings, embedding].slice(-20) }
  })
  if (!found) rows.push({ id: studentId, face_embeddings: [embedding] })
  await saveCachedEmbeddings({ ...cached, rows })
}

// Roster identity fingerprint: sorted active student ids.
export function rosterFingerprint(ids: string[]): string {
  return ids.slice().sort().join(',')
}
