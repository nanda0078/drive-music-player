import * as mm from "music-metadata-browser";
import { processCoverImage } from "./imageUtils";

export interface ParsedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  artworkDataUrl?: string;
  artworkBlobUrl?: string;
  coverBlob?: Blob;
  format: string;
}

// Clean filename into human readable title
export function sanitizeTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  // Replace underscores and excess hyphens with spaces
  return withoutExt.replace(/[_-]+/g, " ").trim() || "Lagu Tanpa Judul";
}

// Format duration helper (e.g. 195 -> "3:15", 3665 -> "1:01:05")
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  const paddedSec = remSec < 10 ? `0${remSec}` : `${remSec}`;
  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${paddedMins}:${paddedSec}`;
  }
  return `${mins}:${paddedSec}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Parse audio metadata from File object (MP3, M4A, AAC, FLAC, OGG, Opus, WAV)
export async function extractAudioMetadata(file: File): Promise<ParsedAudioMetadata> {
  const defaultTitle = sanitizeTitleFromFilename(file.name);
  const extension = file.name.split(".").pop()?.toUpperCase() || "AUDIO";

  let title = defaultTitle;
  let artist = "Artis Tidak Diketahui";
  let album = "Single";
  let year: number | undefined;
  let genre: string | undefined;
  let duration = 0;
  let artworkDataUrl: string | undefined;
  let artworkBlobUrl: string | undefined;
  let coverBlob: Blob | undefined;

  // 1. Try reading with music-metadata-browser (supports ID3v2 APIC, MP4 covr, FLAC PICTURE, OGG Vorbis, WAV)
  try {
    const metadata = await mm.parseBlob(file, { duration: true, skipCovers: false });

    // Extract Title
    if (metadata.common.title && metadata.common.title.trim()) {
      title = metadata.common.title.trim();
    }

    // Extract Artist / Album Artist
    if (metadata.common.artist && metadata.common.artist.trim()) {
      artist = metadata.common.artist.trim();
    } else if (metadata.common.albumartist && metadata.common.albumartist.trim()) {
      artist = metadata.common.albumartist.trim();
    }

    // Extract Album
    if (metadata.common.album && metadata.common.album.trim()) {
      album = metadata.common.album.trim();
    }

    // Extract Year
    if (metadata.common.year && !isNaN(metadata.common.year)) {
      year = metadata.common.year;
    } else if (metadata.common.date) {
      const parsedYear = parseInt(metadata.common.date, 10);
      if (!isNaN(parsedYear) && parsedYear > 1900 && parsedYear < 2100) {
        year = parsedYear;
      }
    }

    // Extract Genre
    if (metadata.common.genre && metadata.common.genre.length > 0) {
      genre = Array.isArray(metadata.common.genre)
        ? metadata.common.genre.filter(Boolean).join(", ")
        : String(metadata.common.genre);
    }

    // Extract Duration
    if (metadata.format.duration && metadata.format.duration > 0) {
      duration = Math.round(metadata.format.duration);
    }

    // Extract Embedded Artwork
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      const mimeType = pic.format || "image/jpeg";

      try {
        const rawBlob = new Blob([pic.data as any], { type: mimeType });
        const processed = await processCoverImage(rawBlob, 512, 0.82);
        artworkBlobUrl = processed.blobUrl;
        artworkDataUrl = processed.dataUrl;
        coverBlob = processed.blob;
      } catch (imgErr) {
        console.warn("Cover image processing notice, falling back to raw blob:", imgErr);
        const rawBlob = new Blob([pic.data as any], { type: mimeType });
        artworkBlobUrl = URL.createObjectURL(rawBlob);
        coverBlob = rawBlob;
        if (pic.data.length < 200000) {
          artworkDataUrl = `data:${mimeType};base64,${bufferToBase64(pic.data)}`;
        }
      }
    }
  } catch (err) {
    console.warn("music-metadata parsing notice for file:", file.name, err);
  }

  // 2. Fallback for duration using HTML5 Audio if duration is still 0
  if (duration === 0) {
    try {
      duration = await getAudioDurationViaAudioElement(file);
    } catch {
      duration = 0;
    }
  }

  return {
    title,
    artist,
    album,
    year,
    genre,
    duration,
    artworkDataUrl,
    artworkBlobUrl,
    coverBlob,
    format: extension,
  };
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function getAudioDurationViaAudioElement(file: File): Promise<number> {
  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(tempUrl);
      audio.remove();
    };

    audio.onloadedmetadata = () => {
      const dur = Math.round(audio.duration || 0);
      cleanup();
      resolve(dur);
    };

    audio.onerror = () => {
      cleanup();
      resolve(0);
    };

    // Timeout fallback after 3s
    setTimeout(() => {
      cleanup();
      resolve(0);
    }, 3000);

    audio.src = tempUrl;
  });
}
