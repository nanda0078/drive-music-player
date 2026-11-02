import { MusicTrack } from "../types/music";
import { getAccessToken, refreshGoogleDriveToken } from "../firebase/config";

const DB_NAME = "DriveMusicPlayer_OfflineDB";
const DB_VERSION = 2;
const STORE_TRACKS = "offline_tracks";
const STORE_PARTIAL_DOWNLOADS = "partial_downloads";
const STORE_PARTIAL_CHUNKS = "partial_chunks";

// Default chunk size for large audio files (6 MB chunks)
const CHUNK_SIZE = 6 * 1024 * 1024;
// Threshold above which chunked range download is used
const CHUNK_THRESHOLD = 8 * 1024 * 1024;

export interface OfflineTrackRecord {
  trackId: string;
  driveFileId: string;
  folderId?: string;
  folderName?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  audioBlob: Blob;
  savedAt: string;
  title: string;
  artist: string;
  duration: number;
}

export interface PartialDownloadRecord {
  trackId: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
  chunkSize: number;
  totalChunks: number;
  downloadedChunkIndexes: number[];
  updatedAt: string;
  status: "in_progress" | "paused" | "failed" | "completed";
}

export interface PartialChunkRecord {
  id: string; // `${trackId}_chunk_${chunkIndex}`
  trackId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  size: number;
  savedAt: string;
}

export interface OfflineDownloadProgressInfo {
  percent: number;
  receivedBytes: number;
  totalBytes: number;
  formattedReceived: string;
  formattedTotal: string;
  chunkIndex?: number;
  totalChunks?: number;
  isResumed?: boolean;
  statusText?: string;
  retryAttempt?: number;
}

// Active Object URLs cache to avoid leaking memory
const activeObjectUrls = new Map<string, string>();

/**
 * Format bytes into human readable string (e.g. 145 MB, 392 MB, 1.2 GB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

/**
 * Opens or upgrades the IndexedDB for offline audio storage & chunked resumable downloads.
 */
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB tidak didukung oleh browser ini."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Completed offline tracks store
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const trackStore = db.createObjectStore(STORE_TRACKS, { keyPath: "trackId" });
        trackStore.createIndex("driveFileId", "driveFileId", { unique: false });
        trackStore.createIndex("savedAt", "savedAt", { unique: false });
      }

      // 2. Partial downloads metadata store
      if (!db.objectStoreNames.contains(STORE_PARTIAL_DOWNLOADS)) {
        const partialStore = db.createObjectStore(STORE_PARTIAL_DOWNLOADS, { keyPath: "trackId" });
        partialStore.createIndex("driveFileId", "driveFileId", { unique: false });
        partialStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // 3. Partial chunks binary store
      if (!db.objectStoreNames.contains(STORE_PARTIAL_CHUNKS)) {
        const chunkStore = db.createObjectStore(STORE_PARTIAL_CHUNKS, { keyPath: "id" });
        chunkStore.createIndex("trackId", "trackId", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Gagal membuka database offline IndexedDB."));
    };
  });
}

/**
 * Checks if a track is completely available offline in IndexedDB.
 */
export async function isTrackOffline(trackId: string): Promise<boolean> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_TRACKS], "readonly");
      const store = transaction.objectStore(STORE_TRACKS);
      const request = store.get(trackId);

      request.onsuccess = () => {
        const res = request.result;
        resolve(Boolean(res && res.audioBlob && res.audioBlob.size > 0));
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves the Blob for an offline track.
 */
export async function getOfflineAudioBlob(trackId: string): Promise<Blob | null> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_TRACKS], "readonly");
      const store = transaction.objectStore(STORE_TRACKS);
      const request = store.get(trackId);

      request.onsuccess = () => {
        const record = request.result as OfflineTrackRecord | undefined;
        if (record && record.audioBlob && record.audioBlob.size > 0) {
          resolve(record.audioBlob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn("getOfflineAudioBlob error:", err);
    return null;
  }
}

/**
 * Retrieves an Object URL for the offline audio blob.
 * Reuses existing Object URL if already generated.
 */
export async function getOfflineAudioUrl(trackId: string): Promise<string | null> {
  if (activeObjectUrls.has(trackId)) {
    return activeObjectUrls.get(trackId)!;
  }

  const blob = await getOfflineAudioBlob(trackId);
  if (!blob) return null;

  try {
    const objectUrl = URL.createObjectURL(blob);
    activeObjectUrls.set(trackId, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn("URL.createObjectURL failed:", err);
    return null;
  }
}

/**
 * Revokes and cleans up any active Object URL for a track.
 */
export function revokeOfflineAudioUrl(trackId: string): void {
  if (activeObjectUrls.has(trackId)) {
    try {
      URL.revokeObjectURL(activeObjectUrls.get(trackId)!);
    } catch {}
    activeObjectUrls.delete(trackId);
  }
}

/**
 * Saves a track's audio blob into IndexedDB offline storage.
 */
export async function saveTrackOffline(
  track: MusicTrack,
  audioBlob: Blob
): Promise<void> {
  const db = await openOfflineDB();
  const record: OfflineTrackRecord = {
    trackId: track.id,
    driveFileId: track.driveFileId,
    folderId: track.driveFolderId,
    folderName: track.folderName,
    fileName: track.fileName || `${track.title}.mp3`,
    mimeType: track.mimeType || audioBlob.type || "audio/mpeg",
    fileSize: audioBlob.size,
    audioBlob,
    savedAt: new Date().toISOString(),
    title: track.title,
    artist: track.artist,
    duration: track.duration,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_TRACKS], "readwrite");
    const store = transaction.objectStore(STORE_TRACKS);
    const request = store.put(record);

    request.onsuccess = () => {
      revokeOfflineAudioUrl(track.id);
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error("Gagal menyimpan audio offline ke database."));
    };
  });
}

/**
 * Removes a track from IndexedDB offline storage and cleans up partial downloads if any.
 */
export async function removeTrackOffline(trackId: string): Promise<void> {
  revokeOfflineAudioUrl(trackId);
  try {
    const db = await openOfflineDB();
    await cleanupPartialDownload(db, trackId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_TRACKS], "readwrite");
      const store = transaction.objectStore(STORE_TRACKS);
      const request = store.delete(trackId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error("Gagal menghapus file offline."));
      };
    });
  } catch (err) {
    console.warn("removeTrackOffline error:", err);
  }
}

/**
 * Gets all track IDs that are available offline.
 */
export async function getAllOfflineTrackIds(): Promise<Set<string>> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_TRACKS], "readonly");
      const store = transaction.objectStore(STORE_TRACKS);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = (request.result || []) as string[];
        resolve(new Set(keys));
      };

      request.onerror = () => {
        resolve(new Set());
      };
    });
  } catch {
    return new Set();
  }
}

/**
 * Calculates total storage used by offline tracks.
 */
export async function getOfflineStorageUsage(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_TRACKS], "readonly");
      const store = transaction.objectStore(STORE_TRACKS);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result || []) as OfflineTrackRecord[];
        let totalBytes = 0;
        for (const rec of records) {
          totalBytes += rec.fileSize || rec.audioBlob?.size || 0;
        }
        resolve({ count: records.length, totalBytes });
      };

      request.onerror = () => {
        resolve({ count: 0, totalBytes: 0 });
      };
    });
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

/**
 * Clears all partial download metadata and chunks for a track.
 */
async function cleanupPartialDownload(db: IDBDatabase, trackId: string): Promise<void> {
  try {
    const tx = db.transaction([STORE_PARTIAL_DOWNLOADS, STORE_PARTIAL_CHUNKS], "readwrite");
    const partialStore = tx.objectStore(STORE_PARTIAL_DOWNLOADS);
    const chunkStore = tx.objectStore(STORE_PARTIAL_CHUNKS);

    partialStore.delete(trackId);

    const chunkIndex = chunkStore.index("trackId");
    const request = chunkIndex.getAllKeys(trackId);

    request.onsuccess = () => {
      const keys = request.result || [];
      for (const key of keys) {
        chunkStore.delete(key);
      }
    };
  } catch (err) {
    console.warn("cleanupPartialDownload notice:", err);
  }
}

/**
 * Retrieves existing partial download record if any.
 */
async function getPartialDownloadRecord(
  db: IDBDatabase,
  trackId: string
): Promise<PartialDownloadRecord | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PARTIAL_DOWNLOADS], "readonly");
      const store = tx.objectStore(STORE_PARTIAL_DOWNLOADS);
      const req = store.get(trackId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Saves a single downloaded chunk to IndexedDB and updates partial download record.
 */
async function saveChunkToDB(
  db: IDBDatabase,
  trackId: string,
  chunkIndex: number,
  data: ArrayBuffer,
  partialMeta: PartialDownloadRecord
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_PARTIAL_DOWNLOADS, STORE_PARTIAL_CHUNKS], "readwrite");
      const chunkStore = tx.objectStore(STORE_PARTIAL_CHUNKS);
      const partialStore = tx.objectStore(STORE_PARTIAL_DOWNLOADS);

      const chunkRecord: PartialChunkRecord = {
        id: `${trackId}_chunk_${chunkIndex}`,
        trackId,
        chunkIndex,
        data,
        size: data.byteLength,
        savedAt: new Date().toISOString(),
      };

      chunkStore.put(chunkRecord);

      if (!partialMeta.downloadedChunkIndexes.includes(chunkIndex)) {
        partialMeta.downloadedChunkIndexes.push(chunkIndex);
      }
      partialMeta.updatedAt = new Date().toISOString();
      partialStore.put(partialMeta);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan bagian audio ke database."));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves all saved chunks in sorted order for assembling the final audio Blob.
 */
async function loadAllChunks(
  db: IDBDatabase,
  trackId: string,
  totalChunks: number
): Promise<ArrayBuffer[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_PARTIAL_CHUNKS], "readonly");
      const chunkStore = tx.objectStore(STORE_PARTIAL_CHUNKS);
      const chunksMap = new Map<number, ArrayBuffer>();

      const chunkIndex = chunkStore.index("trackId");
      const req = chunkIndex.openCursor(trackId);

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const rec = cursor.value as PartialChunkRecord;
          chunksMap.set(rec.chunkIndex, rec.data);
          cursor.continue();
        } else {
          // Verify all chunks are present
          const result: ArrayBuffer[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const chunk = chunksMap.get(i);
            if (!chunk) {
              reject(new Error(`Bagian audio chunk #${i + 1} hilang atau belum terunduh.`));
              return;
            }
            result.push(chunk);
          }
          resolve(result);
        }
      };

      req.onerror = () => reject(req.error || new Error("Gagal memuat bagian audio dari database."));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetches accurate file metadata (exact byte size & mime type) from Google Drive.
 */
async function fetchGoogleDriveMetadata(
  fileId: string,
  token: string
): Promise<{ size: number; mimeType: string; fileName: string }> {
  try {
    // 1. Try backend metadata endpoint
    const res = await fetch(`/api/audio/metadata/${encodeURIComponent(fileId)}?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        size: data.size || 0,
        mimeType: data.mimeType || "audio/mpeg",
        fileName: data.name || "",
      };
    }
  } catch {}

  try {
    // 2. Direct Google Drive API v3 fallback
    const directRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (directRes.ok) {
      const data = await directRes.json();
      return {
        size: data.size ? parseInt(data.size, 10) : 0,
        mimeType: data.mimeType || "audio/mpeg",
        fileName: data.name || "",
      };
    }
  } catch {}

  return { size: 0, mimeType: "audio/mpeg", fileName: "" };
}

/**
 * Downloads a chunk with exponential backoff retries and auto token refresh on 401.
 */
async function downloadChunkWithRetry(
  fileId: string,
  startByte: number,
  endByte: number,
  mimeType: string,
  fileName: string,
  onRetryNotice?: (attempt: number, errorMsg: string) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const maxRetries = 4;
  let currentAttempt = 0;

  while (currentAttempt <= maxRetries) {
    if (signal?.aborted) {
      throw new DOMException("Download dibatalkan oleh pengguna.", "AbortError");
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await refreshGoogleDriveToken();
      }
      if (!token) {
        throw new Error("Akun Google Drive belum terhubung. Silakan login terlebih dahulu.");
      }

      const rangeHeader = `bytes=${startByte}-${endByte}`;
      const fileNameParam = encodeURIComponent(fileName || "");
      const streamUrl = `/api/audio/stream/${encodeURIComponent(
        fileId
      )}?token=${encodeURIComponent(token)}&mimeType=${encodeURIComponent(
        mimeType
      )}&fileName=${fileNameParam}`;

      // Abort controller with connection timeout (30 seconds per chunk connection)
      const chunkController = new AbortController();
      const timeoutId = setTimeout(() => chunkController.abort(), 35000);

      const onParentAbort = () => chunkController.abort();
      signal?.addEventListener("abort", onParentAbort);

      let response: Response;
      try {
        response = await fetch(streamUrl, {
          method: "GET",
          headers: { Range: rangeHeader },
          signal: chunkController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onParentAbort);
      }

      // Handle HTTP status
      if (response.status === 206 || response.ok) {
        const arrayBuf = await response.arrayBuffer();
        if (arrayBuf.byteLength > 0) {
          return arrayBuf;
        }
        throw new Error("Bagian audio yang diterima kosong (0 bytes).");
      }

      // Handle 401 Token Expired -> refresh token immediately and retry
      if (response.status === 401) {
        console.warn("[Downloader] Token expired (401), refreshing token...");
        await refreshGoogleDriveToken();
        currentAttempt++;
        onRetryNotice?.(currentAttempt, "Memperbarui autentikasi Google Drive...");
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Specific Google Drive errors
      if (response.status === 403) {
        throw new Error("Akses ditolak oleh Google Drive (Izin tidak mencukupi atau kuota harian terlampaui).");
      }
      if (response.status === 404) {
        throw new Error("File audio tidak ditemukan di Google Drive.");
      }

      const errorText = await response.text().catch(() => "");
      throw new Error(`Google Drive HTTP ${response.status}: ${errorText || "Gangguan transfer chunk."}`);
    } catch (err: any) {
      if (err.name === "AbortError" && signal?.aborted) {
        throw err;
      }

      currentAttempt++;
      if (currentAttempt > maxRetries) {
        throw new Error(err.message || `Gagal mengunduh bagian audio setelah ${maxRetries} percobaan.`);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s
      const delay = Math.min(8000, 1000 * Math.pow(2, currentAttempt - 1));
      console.warn(`[Downloader] Chunk retry ${currentAttempt}/${maxRetries} in ${delay}ms... Reason:`, err.message);
      onRetryNotice?.(currentAttempt, `Mencoba kembali bagian audio (Percobaan ${currentAttempt}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Gagal mengunduh bagian audio.");
}

/**
 * Single-stream fallback download for small audio files (< 8 MB).
 */
async function downloadSingleStreamWithProgress(
  track: MusicTrack,
  onProgress?: (percent: number, receivedBytes: number, totalBytes: number, info: OfflineDownloadProgressInfo) => void,
  signal?: AbortSignal
): Promise<Blob> {
  let token = await getAccessToken();
  if (!token) token = await refreshGoogleDriveToken();
  if (!token) throw new Error("Akun Google Drive belum terhubung.");

  const fileNameParam = encodeURIComponent(track.fileName || track.title || "");
  const streamUrl = `/api/audio/stream/${encodeURIComponent(
    track.driveFileId
  )}?token=${encodeURIComponent(token)}&mimeType=${encodeURIComponent(
    track.mimeType || "audio/mpeg"
  )}&fileName=${fileNameParam}`;

  const response = await fetch(streamUrl, { method: "GET", signal });

  if (!response.ok && response.status !== 206) {
    if (response.status === 401) {
      const refreshedToken = await refreshGoogleDriveToken();
      if (refreshedToken) {
        const retryUrl = `/api/audio/stream/${encodeURIComponent(
          track.driveFileId
        )}?token=${encodeURIComponent(refreshedToken)}&mimeType=${encodeURIComponent(
          track.mimeType || "audio/mpeg"
        )}&fileName=${fileNameParam}`;
        const retryRes = await fetch(retryUrl, { method: "GET", signal });
        if (!retryRes.ok && retryRes.status !== 206) {
          throw new Error(`Gagal mengunduh audio (${retryRes.status})`);
        }
        return readStreamToBlob(track, retryRes, onProgress);
      }
    }
    if (response.status === 403) throw new Error("Akses file Google Drive ditolak (403).");
    if (response.status === 404) throw new Error("File audio tidak ditemukan di Google Drive (404).");
    throw new Error(`Gagal mengunduh audio dari Google Drive (${response.status})`);
  }

  return readStreamToBlob(track, response, onProgress);
}

async function readStreamToBlob(
  track: MusicTrack,
  response: Response,
  onProgress?: (percent: number, receivedBytes: number, totalBytes: number, info: OfflineDownloadProgressInfo) => void
): Promise<Blob> {
  const contentLengthHeader = response.headers.get("content-length");
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : track.fileSize || 0;

  if (!response.body) {
    const fullBlob = await response.blob();
    await saveTrackOffline(track, fullBlob);
    onProgress?.(100, fullBlob.size, fullBlob.size, {
      percent: 100,
      receivedBytes: fullBlob.size,
      totalBytes: fullBlob.size,
      formattedReceived: formatBytes(fullBlob.size),
      formattedTotal: formatBytes(fullBlob.size),
      statusText: "Selesai diunduh",
    });
    return fullBlob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      chunks.push(value);
      receivedBytes += value.length;

      const percent = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : 50;
      onProgress?.(percent, receivedBytes, totalBytes, {
        percent,
        receivedBytes,
        totalBytes,
        formattedReceived: formatBytes(receivedBytes),
        formattedTotal: formatBytes(totalBytes || receivedBytes),
        statusText: `Mengunduh... ${percent}% (${formatBytes(receivedBytes)} / ${formatBytes(totalBytes || receivedBytes)})`,
      });
    }
  }

  const mimeType = track.mimeType || response.headers.get("content-type") || "audio/mpeg";
  const finalBlob = new Blob(chunks, { type: mimeType });

  await saveTrackOffline(track, finalBlob);
  onProgress?.(100, finalBlob.size, finalBlob.size, {
    percent: 100,
    receivedBytes: finalBlob.size,
    totalBytes: finalBlob.size,
    formattedReceived: formatBytes(finalBlob.size),
    formattedTotal: formatBytes(finalBlob.size),
    statusText: "Selesai disimpan offline",
  });

  return finalBlob;
}

/**
 * ADAPTIVE CHUNKED & RESUMABLE DOWNLOAD MANAGER
 * 
 * Supports:
 * - Short audio (< 10 MB)
 * - Medium & Large audio (30-60 min, 1-3 hours, >3 hours, 100 MB - 500 MB+)
 * - Download based on authentic Google Drive File ID
 * - HTTP Range Chunking (6 MB per chunk)
 * - Exponential backoff retry (1s, 2s, 4s, 8s) per chunk
 * - Resume from last completed chunk in IndexedDB (e.g. 63% -> continue from 63%)
 * - Real-time progress with exact byte counts (145 MB / 392 MB • 37%)
 * - Auto token refresh without failing the entire download
 * - No artificial duration limits
 */
export async function downloadTrackForOffline(
  track: MusicTrack,
  onProgress?: (
    progressPercent: number,
    receivedBytes: number,
    totalBytes: number,
    progressInfo?: OfflineDownloadProgressInfo
  ) => void,
  signal?: AbortSignal
): Promise<Blob> {
  // 1. Check if already available in offline storage
  const alreadyOffline = await isTrackOffline(track.id);
  if (alreadyOffline) {
    const existingBlob = await getOfflineAudioBlob(track.id);
    if (existingBlob && existingBlob.size > 0) {
      onProgress?.(100, existingBlob.size, existingBlob.size, {
        percent: 100,
        receivedBytes: existingBlob.size,
        totalBytes: existingBlob.size,
        formattedReceived: formatBytes(existingBlob.size),
        formattedTotal: formatBytes(existingBlob.size),
        statusText: "Lagu sudah tersedia offline.",
      });
      return existingBlob;
    }
  }

  // 2. Validate Google Drive authentication
  let token = await getAccessToken();
  if (!token) token = await refreshGoogleDriveToken();
  if (!token) {
    throw new Error("Akun Google Drive belum terhubung. Silakan hubungkan Google Drive terlebih dahulu.");
  }

  // 3. Obtain real file metadata (size, mime, name) from Google Drive
  onProgress?.(0, 0, track.fileSize || 0, {
    percent: 0,
    receivedBytes: 0,
    totalBytes: track.fileSize || 0,
    formattedReceived: "0 B",
    formattedTotal: formatBytes(track.fileSize || 0),
    statusText: "Memeriksa metadata file audio...",
  });

  const driveMeta = await fetchGoogleDriveMetadata(track.driveFileId, token);
  const totalBytes = driveMeta.size || track.fileSize || 0;
  const mimeType = driveMeta.mimeType || track.mimeType || "audio/mpeg";
  const fileName = driveMeta.fileName || track.fileName || `${track.title}.mp3`;

  // 4. Adaptive strategy selection:
  // If file is small (< 8 MB) or size is unknown, use streaming download
  if (totalBytes > 0 && totalBytes < CHUNK_THRESHOLD) {
    return downloadSingleStreamWithProgress(
      { ...track, fileSize: totalBytes, mimeType, fileName },
      onProgress,
      signal
    );
  }

  // 5. Large / Long Audio Chunked Range Strategy (e.g. 50 MB - 500 MB+)
  const db = await openOfflineDB();
  const chunkSize = CHUNK_SIZE;
  const effectiveTotalBytes = totalBytes > 0 ? totalBytes : CHUNK_THRESHOLD;
  const totalChunks = Math.max(1, Math.ceil(effectiveTotalBytes / chunkSize));

  // Check if previous partial download exists to resume
  let partialMeta = await getPartialDownloadRecord(db, track.id);
  const isResuming =
    Boolean(partialMeta && partialMeta.totalBytes === effectiveTotalBytes && partialMeta.chunkSize === chunkSize);

  if (!isResuming || !partialMeta) {
    // Initialize new partial record
    partialMeta = {
      trackId: track.id,
      driveFileId: track.driveFileId,
      fileName,
      mimeType,
      totalBytes: effectiveTotalBytes,
      chunkSize,
      totalChunks,
      downloadedChunkIndexes: [],
      updatedAt: new Date().toISOString(),
      status: "in_progress",
    };
  }

  const downloadedSet = new Set(partialMeta.downloadedChunkIndexes);
  let totalDownloadedBytes = 0;

  for (const idx of downloadedSet) {
    const isLast = idx === totalChunks - 1;
    const chunkBytes = isLast ? effectiveTotalBytes - idx * chunkSize : chunkSize;
    totalDownloadedBytes += Math.max(0, chunkBytes);
  }

  if (isResuming && downloadedSet.size > 0) {
    const initialPercent = Math.min(99, Math.round((totalDownloadedBytes / effectiveTotalBytes) * 100));
    onProgress?.(initialPercent, totalDownloadedBytes, effectiveTotalBytes, {
      percent: initialPercent,
      receivedBytes: totalDownloadedBytes,
      totalBytes: effectiveTotalBytes,
      formattedReceived: formatBytes(totalDownloadedBytes),
      formattedTotal: formatBytes(effectiveTotalBytes),
      isResumed: true,
      statusText: `Melanjutkan unduhan (${formatBytes(totalDownloadedBytes)} / ${formatBytes(effectiveTotalBytes)})...`,
    });
  }

  // Download missing chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) {
      throw new DOMException("Download dibatalkan oleh pengguna.", "AbortError");
    }

    if (downloadedSet.has(i)) {
      continue; // Chunk already downloaded and stored in IndexedDB
    }

    const startByte = i * chunkSize;
    const endByte = Math.min(effectiveTotalBytes - 1, startByte + chunkSize - 1);

    const chunkData = await downloadChunkWithRetry(
      track.driveFileId,
      startByte,
      endByte,
      mimeType,
      fileName,
      (attempt, retryMsg) => {
        const currentPercent = Math.round((totalDownloadedBytes / effectiveTotalBytes) * 100);
        onProgress?.(currentPercent, totalDownloadedBytes, effectiveTotalBytes, {
          percent: currentPercent,
          receivedBytes: totalDownloadedBytes,
          totalBytes: effectiveTotalBytes,
          formattedReceived: formatBytes(totalDownloadedBytes),
          formattedTotal: formatBytes(effectiveTotalBytes),
          chunkIndex: i + 1,
          totalChunks,
          statusText: retryMsg,
          retryAttempt: attempt,
        });
      },
      signal
    );

    // Save downloaded chunk to IndexedDB
    await saveChunkToDB(db, track.id, i, chunkData, partialMeta);
    downloadedSet.add(i);
    totalDownloadedBytes += chunkData.byteLength;

    const percent = Math.min(99, Math.round((totalDownloadedBytes / effectiveTotalBytes) * 100));
    onProgress?.(percent, totalDownloadedBytes, effectiveTotalBytes, {
      percent,
      receivedBytes: totalDownloadedBytes,
      totalBytes: effectiveTotalBytes,
      formattedReceived: formatBytes(totalDownloadedBytes),
      formattedTotal: formatBytes(effectiveTotalBytes),
      chunkIndex: i + 1,
      totalChunks,
      statusText: `Mengunduh... ${percent}% (${formatBytes(totalDownloadedBytes)} / ${formatBytes(effectiveTotalBytes)})`,
    });
  }

  // 6. Assembling all chunks from IndexedDB into single audio Blob
  onProgress?.(99, totalDownloadedBytes, effectiveTotalBytes, {
    percent: 99,
    receivedBytes: totalDownloadedBytes,
    totalBytes: effectiveTotalBytes,
    formattedReceived: formatBytes(totalDownloadedBytes),
    formattedTotal: formatBytes(effectiveTotalBytes),
    statusText: "Memverifikasi dan menyimpan audio offline...",
  });

  const allChunks = await loadAllChunks(db, track.id, totalChunks);
  const finalBlob = new Blob(allChunks, { type: mimeType });

  if (finalBlob.size === 0) {
    throw new Error("Gagal merakit file audio (Ukuran file 0 bytes).");
  }

  // 7. Save finalized audio record to offline_tracks store
  await saveTrackOffline(
    {
      ...track,
      fileSize: finalBlob.size,
      mimeType,
      fileName,
    },
    finalBlob
  );

  // 8. Clean up partial download store
  await cleanupPartialDownload(db, track.id);

  onProgress?.(100, finalBlob.size, finalBlob.size, {
    percent: 100,
    receivedBytes: finalBlob.size,
    totalBytes: finalBlob.size,
    formattedReceived: formatBytes(finalBlob.size),
    formattedTotal: formatBytes(finalBlob.size),
    statusText: `Berhasil disimpan! (${formatBytes(finalBlob.size)})`,
  });

  return finalBlob;
}
