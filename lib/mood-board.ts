export const MAX_MOOD_CLIPS = 8;

const DB_NAME = "affirmation-lab-mood-v1";
const STORE = "clips";
const VERSION = 1;
const MAX_EDGE = 1400;

export type MoodClipRecord = {
  id: string;
  affirmationId: string;
  order: number;
  mime: string;
  blob: Blob;
  createdAt: number;
};

export type MoodClip = {
  id: string;
  affirmationId: string;
  order: number;
  url: string;
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `clip-${crypto.randomUUID()}`;
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("byAffirmation", "affirmationId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open mood board storage"));
  });
}

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb().then((db) => {
      db.onclose = () => {
        dbPromise = null;
      };
      return db;
    });
  }
  return dbPromise;
}

export function revokeClipUrls(clips: MoodClip[]) {
  for (const clip of clips) {
    URL.revokeObjectURL(clip.url);
  }
}

export function recordsToClips(records: MoodClipRecord[]): MoodClip[] {
  return [...records]
    .sort((a, b) => a.order - b.order)
    .map((record) => ({
      id: record.id,
      affirmationId: record.affirmationId,
      order: record.order,
      url: URL.createObjectURL(record.blob),
    }));
}

export async function listClipRecords(affirmationId: string): Promise<MoodClipRecord[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readonly");
  const index = tx.objectStore(STORE).index("byAffirmation");
  const records = await requestToPromise(index.getAll(affirmationId) as IDBRequest<MoodClipRecord[]>);
  return records.sort((a, b) => a.order - b.order);
}

export async function countClips(affirmationId: string): Promise<number> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readonly");
  const index = tx.objectStore(STORE).index("byAffirmation");
  return await requestToPromise(index.count(affirmationId));
}

export async function addClip(affirmationId: string, blob: Blob): Promise<MoodClipRecord> {
  const existing = await listClipRecords(affirmationId);
  if (existing.length >= MAX_MOOD_CLIPS) {
    throw new Error(`This board holds ${MAX_MOOD_CLIPS} pictures.`);
  }

  const record: MoodClipRecord = {
    id: makeId(),
    affirmationId,
    order: existing.length,
    mime: blob.type || "image/jpeg",
    blob,
    createdAt: Date.now(),
  };

  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  return record;
}

export async function deleteClip(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const record = (await requestToPromise(store.get(id))) as MoodClipRecord | undefined;
  store.delete(id);
  if (record) {
    const siblings = (
      (await requestToPromise(
        store.index("byAffirmation").getAll(record.affirmationId),
      )) as MoodClipRecord[]
    )
      .filter((item) => item.id !== id)
      .sort((a, b) => a.order - b.order);
    siblings.forEach((item, order) => {
      store.put({ ...item, order });
    });
  }
  await txDone(tx);
}

export async function reorderClips(affirmationId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const [order, id] of orderedIds.entries()) {
    const record = (await requestToPromise(store.get(id))) as MoodClipRecord | undefined;
    if (record && record.affirmationId === affirmationId) {
      store.put({ ...record, order });
    }
  }
  await txDone(tx);
}

export async function deleteClipsForAffirmations(affirmationIds: string[]): Promise<void> {
  if (!affirmationIds.length) return;
  const idSet = new Set(affirmationIds);
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const all = (await requestToPromise(store.getAll())) as MoodClipRecord[];
  for (const record of all) {
    if (idSet.has(record.affirmationId)) store.delete(record.id);
  }
  await txDone(tx);
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

async function loadImage(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: bitmap,
        close: () => bitmap.close(),
      };
    } catch {
      // Canvas fallback below for types some browsers refuse to bitmap-decode.
    }
  }

  const url = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not read this image."));
    element.src = url;
  });
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    draw: image,
    close: () => URL.revokeObjectURL(url),
  };
}

export async function compressImageFile(file: File): Promise<Blob> {
  if (!isImageFile(file)) {
    throw new Error("Use a photo file (JPEG, PNG, WebP, or GIF).");
  }

  const source = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height, 1));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare this image.");
    ctx.fillStyle = "#fff8ee";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source.draw, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob) throw new Error("Could not store this image.");
    return blob;
  } finally {
    source.close();
  }
}
