export interface MusicTrack {
  id: string;
  driveFileId: string;
  driveFolderId?: string;
  folderName?: string;
  fileName: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  duration: number; // in seconds
  mimeType: string;
  fileSize: number; // in bytes
  artworkUrl?: string;
  coverFileId?: string;
  coverSource?: "embedded" | "manual" | "none";
  coverUpdatedAt?: string;
  isFavorite?: boolean;
  playCount?: number;
  uploadStatus?: "Menunggu" | "Mengunggah" | "Berhasil" | "Gagal";
  userId: string;
  createdAt: string;
  updatedAt: string;
  offlineAvailable?: boolean;
  offlineSavedAt?: string;
  offlineFileSize?: number;
}

export interface OfflineOfferState {
  track: MusicTrack;
  remainingSeconds: number;
  isDownloading: boolean;
  downloadProgress: number;
  receivedBytes?: number;
  totalBytes?: number;
  formattedReceived?: string;
  formattedTotal?: string;
  statusText?: string;
  error?: string | null;
  retryAttempt?: number;
}

export interface MusicFolder {
  id: string;
  name: string;
  driveFolderId: string;
  userId: string;
  songCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  userId: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type RepeatMode = "off" | "all" | "one";

export interface SelectedUploadFile {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  artworkBlobUrl?: string;
  artworkDataUrl?: string;
  coverBlob?: Blob;
  coverSource?: "embedded" | "manual" | "none";
  coverFileId?: string;
  size: number;
  format: string;
  status: "Menunggu" | "Mengunggah" | "Berhasil" | "Gagal";
  progress: number;
  errorMessage?: string;
  driveFileId?: string;
  driveFolderId?: string;
  folderName?: string;
  relativePath?: string;
}

export type NavigationTab = "library" | "playlist" | "upload" | "settings";
