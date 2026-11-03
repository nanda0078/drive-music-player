/**
 * driveAudioService.ts
 *
 * Dedicated service for direct client-side Google Drive API audio streaming.
 * Enables 100% reliable online playback on static deployments (e.g. GitHub Pages)
 * where no backend Node.js / Express proxy is running.
 *
 * Benefits:
 * 1. Zero backend dependency — works natively on GitHub Pages.
 * 2. Same-origin Blob URLs — Web Audio API 10-Band Equalizer runs with zero CORS taint.
 * 3. Instant seeking and scrubbing without byte-range roundtrips.
 * 4. Automatic token refresh on 401 and large file virus scan handling.
 * 5. Strict Blob URL lifecycle management and in-memory LRU caching to eliminate memory leaks and redundant network calls.
 */

import { refreshGoogleDriveToken } from "../firebase/config";

export interface DirectAudioResult {
  blobUrl: string;
  blob: Blob;
  mimeType: string;
}

export interface DirectAudioOptions {
  mimeType?: string;
  signal?: AbortSignal;
  onProgress?: (receivedBytes: number, totalBytes: number) => void;
  bypassCache?: boolean;
}

export class DriveAudioError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "DriveAudioError";
    this.code = code;
    this.status = status;
  }
}

/**
 * In-memory LRU cache for audio blobs.
 * Stores up to MAX_BLOB_CACHE_COUNT tracks so replaying or switching recent tracks happens in 0ms without Google Drive API calls.
 */
interface CachedBlobEntry {
  blobUrl: string;
  blob: Blob;
  mimeType: string;
  lastAccessed: number;
}

const audioBlobCache = new Map<string, CachedBlobEntry>();
const MAX_BLOB_CACHE_COUNT = 6;

export function getCachedDriveAudioBlob(fileId: string): DirectAudioResult | null {
  const cached = audioBlobCache.get(fileId);
  if (cached) {
    cached.lastAccessed = Date.now();
    return {
      blobUrl: cached.blobUrl,
      blob: cached.blob,
      mimeType: cached.mimeType,
    };
  }
  return null;
}

export function cacheDriveAudioBlob(fileId: string, result: DirectAudioResult): void {
  // Check if already in cache
  if (audioBlobCache.has(fileId)) {
    const existing = audioBlobCache.get(fileId)!;
    existing.lastAccessed = Date.now();
    return;
  }

  // Evict oldest if reaching capacity
  if (audioBlobCache.size >= MAX_BLOB_CACHE_COUNT) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of audioBlobCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const evicted = audioBlobCache.get(oldestKey);
      audioBlobCache.delete(oldestKey);
      if (evicted?.blobUrl && evicted.blobUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(evicted.blobUrl);
        } catch {}
      }
    }
  }

  audioBlobCache.set(fileId, {
    blobUrl: result.blobUrl,
    blob: result.blob,
    mimeType: result.mimeType,
    lastAccessed: Date.now(),
  });
}

export function clearDriveAudioBlobCache(): void {
  for (const entry of audioBlobCache.values()) {
    if (entry.blobUrl && entry.blobUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(entry.blobUrl);
      } catch {}
    }
  }
  audioBlobCache.clear();
}

/**
 * Checks whether the current runtime environment is a static web hosting deployment
 * (e.g., GitHub Pages, Netlify, Vercel, Cloudflare Pages) where backend proxy endpoints
 * like `/api/audio/stream` do not exist.
 */
export function isStaticDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname.includes("github.io") ||
    hostname.includes("vercel.app") ||
    hostname.includes("netlify.app") ||
    hostname.includes("pages.dev")
  ) {
    return true;
  }
  // If not running on local loopback, treat as static deployment
  return hostname !== "localhost" && hostname !== "127.0.0.1";
}

/**
 * Fetches an audio file directly from Google Drive API v3 using the client's OAuth Bearer token,
 * converts the binary stream to a local in-memory Blob, and returns a same-origin Blob URL.
 * Automatically checks and uses the in-memory cache for instant playback.
 */
export async function fetchDirectDriveAudioBlob(
  fileId: string,
  token: string,
  options: DirectAudioOptions = {}
): Promise<DirectAudioResult> {
  // 1. Check in-memory cache first for instant 0ms retrieval
  if (!options.bypassCache) {
    const cached = getCachedDriveAudioBlob(fileId);
    if (cached) {
      console.log(`[DriveAudio] In-memory cache hit for fileId: ${fileId}. Instant playback.`);
      return cached;
    }
  }

  let activeToken = token;
  const initialUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`;

  let response: Response;

  try {
    response = await fetch(initialUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
      signal: options.signal,
    });
  } catch (netErr: any) {
    if (options.signal?.aborted) {
      throw new DOMException("Download dibatalkan.", "AbortError");
    }
    throw new DriveAudioError(
      `Gagal terhubung ke Google Drive: ${netErr?.message || "Kesalahan jaringan"}`,
      "network_error"
    );
  }

  // Handle 401 Token Expired -> Attempt automatic 1x token refresh
  if (response.status === 401) {
    console.log("[DriveAudio] 401 Token Expired from Google Drive API. Attempting token refresh...");
    const refreshedToken = await refreshGoogleDriveToken();
    if (refreshedToken) {
      activeToken = refreshedToken;
      try {
        response = await fetch(initialUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
          signal: options.signal,
        });
      } catch (retryErr: any) {
        if (options.signal?.aborted) {
          throw new DOMException("Download dibatalkan.", "AbortError");
        }
        throw new DriveAudioError(
          `Gagal terhubung ke Google Drive setelah refresh: ${retryErr?.message || "Kesalahan jaringan"}`,
          "network_error"
        );
      }
    } else {
      throw new DriveAudioError(
        "Sesi Google Drive kedaluwarsa. Silakan perbarui akses akun Google Anda.",
        "token_expired",
        401
      );
    }
  }

  // Handle specific Google Drive API HTTP status codes
  if (response.status === 401) {
    throw new DriveAudioError(
      "Sesi Google Drive kedaluwarsa. Silakan perbarui akses akun Google Anda.",
      "token_expired",
      401
    );
  }

  if (response.status === 403) {
    throw new DriveAudioError(
      "Akses ke file ditolak oleh Google Drive (Izin tidak mencukupi atau kuota terlampaui).",
      "forbidden",
      403
    );
  }

  if (response.status === 404) {
    throw new DriveAudioError(
      "File audio tidak ditemukan di Google Drive (Mungkin telah dihapus atau dipindahkan).",
      "not_found",
      404
    );
  }

  if (!response.ok && response.status !== 206) {
    throw new DriveAudioError(
      `Gagal streaming dari Google Drive (Status HTTP ${response.status}).`,
      "general_error",
      response.status
    );
  }

  // Handle large file Google Drive virus scan warning page (Content-Type: text/html)
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const htmlText = await response.text().catch(() => "");
    const confirmMatch =
      htmlText.match(/confirm=([a-zA-Z0-9_\-]+)/) ||
      htmlText.match(/name="confirm"\s+value="([^"]+)"/);
    const confirmToken = confirmMatch ? confirmMatch[1] : "t";

    const ucUrl = `https://drive.google.com/uc?id=${encodeURIComponent(
      fileId
    )}&export=download&confirm=${confirmToken}&acknowledgeAbuse=true`;

    try {
      response = await fetch(ucUrl, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
        signal: options.signal,
      });
    } catch (ucErr: any) {
      if (options.signal?.aborted) {
        throw new DOMException("Download dibatalkan.", "AbortError");
      }
      throw new DriveAudioError("Gagal mengunduh file besar dari Google Drive.", "general_error");
    }

    if (!response.ok && response.status !== 206) {
      throw new DriveAudioError(
        `Gagal mengunduh file besar dari Google Drive (Status HTTP ${response.status}).`,
        "general_error",
        response.status
      );
    }
  }

  const targetMime = options.mimeType || response.headers.get("content-type") || "audio/mpeg";
  let blob: Blob;

  // Stream reading with progress feedback if requested
  if (options.onProgress && response.body) {
    const contentLength = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      if (options.signal?.aborted) {
        throw new DOMException("Download dibatalkan.", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        options.onProgress(received, contentLength);
      }
    }
    blob = new Blob(chunks, { type: targetMime });
  } else {
    const rawBlob = await response.blob();
    blob = targetMime && rawBlob.type !== targetMime
      ? new Blob([rawBlob], { type: targetMime })
      : rawBlob;
  }

  const blobUrl = URL.createObjectURL(blob);
  const result: DirectAudioResult = {
    blobUrl,
    blob,
    mimeType: targetMime,
  };

  // Cache in LRU cache for subsequent instant replays
  cacheDriveAudioBlob(fileId, result);

  return result;
}

/**
 * Safely revokes an object URL to free browser memory if it is not in the active cache.
 */
export function revokeDriveAudioBlobUrl(blobUrl: string | null | undefined): void {
  if (!blobUrl || !blobUrl.startsWith("blob:")) return;

  // Don't revoke if URL is still retained by the LRU cache
  for (const entry of audioBlobCache.values()) {
    if (entry.blobUrl === blobUrl) {
      return;
    }
  }

  try {
    URL.revokeObjectURL(blobUrl);
  } catch {}
}
