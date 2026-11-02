import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { MusicTrack, RepeatMode, OfflineOfferState } from "../types/music";
import { getAccessToken, requestInteractiveGoogleLogin, refreshGoogleDriveToken, db } from "../firebase/config";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { equalizerEngine } from "../services/equalizerAudioEngine";
import { useToast } from "../components/Toast";
import {
  isTrackOffline,
  getOfflineAudioUrl,
  removeTrackOffline,
  getAllOfflineTrackIds,
  downloadTrackForOffline,
  revokeOfflineAudioUrl,
} from "../services/offlineStorageService";
import { backgroundAudioService } from "../services/backgroundAudioService";

export type PlaybackErrorType =
  | "token_expired"
  | "forbidden"
  | "not_found"
  | "codec_unsupported"
  | "network_error"
  | "range_error"
  | "drive_disconnected"
  | "general_error"
  | null;

interface MusicPlayerContextType {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  queue: MusicTrack[];
  currentIndex: number;
  activePlaylistId: string | null;
  isNowPlayingOpen: boolean;
  isQueueOpen: boolean;
  isLoading: boolean;
  hasPlaybackError: boolean;
  playbackErrorType: PlaybackErrorType;
  errorMessage: string | null;
  isOnline: boolean;
  failedTrackIds: string[];
  offlineTrackIds: string[];
  activeDownloads: Record<string, number>;
  offlineOffer: OfflineOfferState | null;

  playTrack: (track: MusicTrack, newQueue?: MusicTrack[], playlistId?: string | null) => void;
  playQueueWithIndex: (newQueue: MusicTrack[], startIndex?: number, playlistId?: string | null) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  setVolumeLevel: (volume: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (track: MusicTrack) => void;
  addToQueueNext: (track: MusicTrack) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  setIsNowPlayingOpen: (open: boolean) => void;
  setIsQueueOpen: (open: boolean) => void;
  retryPlayback: () => void;
  reconnectGoogleAndPlay: () => Promise<void>;
  pausePlayback: () => void;
  registerTrackEndInterceptor: (interceptor: (() => boolean) | null) => void;
  registerTrackPlayListener: (listener: ((track: MusicTrack) => void) | null) => void;
  resetPlayerState: () => void;
  updateTrackInContext: (updatedTrack: MusicTrack) => void;
  downloadTrackForOfflineManual: (track: MusicTrack) => Promise<void>;
  removeTrackFromOffline: (track: MusicTrack) => Promise<void>;
  acceptOfflineDownload: (track: MusicTrack) => Promise<void>;
  skipOfflineOffer: () => void;
  dismissOfflineOffer: () => void;
  isTrackAvailableOffline: (trackId: string) => boolean;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

// Local storage persistence keys
const STORAGE_KEYS = {
  CURRENT_TRACK: "drive_music_player_current_track",
  QUEUE: "drive_music_player_queue",
  ORIGINAL_QUEUE: "drive_music_player_original_queue",
  CURRENT_TIME: "drive_music_player_current_time",
  DURATION: "drive_music_player_duration",
  VOLUME: "drive_music_player_volume",
  REPEAT_MODE: "drive_music_player_repeat_mode",
  IS_SHUFFLED: "drive_music_player_is_shuffled",
  PLAYLIST_ID: "drive_music_player_playlist_id",
};

// Generate high quality default artwork SVG data URL for Android Notification & Lockscreen
function generateDefaultArtwork(title: string, artist: string): string {
  const safeTitle = (title || "Drive Music").slice(0, 24).replace(/[<>&"]/g, "");
  const safeArtist = (artist || "Google Drive").slice(0, 24).replace(/[<>&"]/g, "");
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1E3A8A"/>
          <stop offset="50%" stop-color="#2563EB"/>
          <stop offset="100%" stop-color="#4F46E5"/>
        </linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect width="512" height="512" rx="64" fill="url(#g)"/>
      <circle cx="256" cy="210" r="96" fill="#FFFFFF" fill-opacity="0.12" filter="url(#s)"/>
      <path d="M224 160v100a40 40 0 1 1-28-38.3V184l88-20v76a40 40 0 1 1-28-38.3V140l-120 20z" fill="#FFFFFF"/>
      <text x="256" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="700" fill="#FFFFFF" text-anchor="middle">${safeTitle}</text>
      <text x="256" y="424" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="500" fill="#93C5FD" text-anchor="middle">${safeArtist}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  // Load initial persisted state
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_TRACK);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [currentTime, setCurrentTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_TIME);
      return saved ? parseFloat(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [duration, setDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DURATION);
      return saved ? parseFloat(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [volume, setVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VOLUME);
      return saved !== null ? parseFloat(saved) : 0.85;
    } catch {
      return 0.85;
    }
  });

  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REPEAT_MODE);
      return (saved as RepeatMode) || "off";
    } catch {
      return "off";
    }
  });

  const [isShuffled, setIsShuffled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.IS_SHUFFLED) === "true";
    } catch {
      return false;
    }
  });

  const [queue, setQueue] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [originalQueue, setOriginalQueue] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORIGINAL_QUEUE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PLAYLIST_ID) || null;
    } catch {
      return null;
    }
  });

  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasPlaybackError, setHasPlaybackError] = useState<boolean>(false);
  const [playbackErrorType, setPlaybackErrorType] = useState<PlaybackErrorType>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [failedTrackIds, setFailedTrackIds] = useState<string[]>([]);
  const [offlineTrackIds, setOfflineTrackIds] = useState<string[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Record<string, number>>({});
  const [offlineOffer, setOfflineOffer] = useState<OfflineOfferState | null>(null);

  // Persistent Single HTML5 Audio Element Ref & Player Tracking Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastKnownPositionRef = useRef<number>(currentTime);
  const pendingResumePositionRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const isRecoveringRef = useRef<boolean>(false);
  const isUserPausedRef = useRef<boolean>(true);
  const trackEndInterceptorRef = useRef<(() => boolean) | null>(null);
  const trackPlayListenerRef = useRef<((track: MusicTrack) => void) | null>(null);

  // Playback start timeout ref (10 seconds max)
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Offline download offer auto-skip countdown timer ref
  const offerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set of temporarily failed track IDs in current playback session
  const failedTrackIdsRef = useRef<Set<string>>(new Set());

  // Load offline track IDs from IndexedDB on initial mount
  useEffect(() => {
    getAllOfflineTrackIds()
      .then((ids) => {
        setOfflineTrackIds(Array.from(ids));
      })
      .catch((err) => {
        console.warn("Failed to load offline track IDs:", err);
      });
  }, []);

  const isTrackAvailableOffline = useCallback(
    (trackId: string): boolean => {
      return offlineTrackIds.includes(trackId);
    },
    [offlineTrackIds]
  );

  // Keep state refs in sync for reliable asynchronous / event callbacks
  const queueRef = useRef<MusicTrack[]>(queue);
  queueRef.current = queue;

  const currentTrackRef = useRef<MusicTrack | null>(currentTrack);
  currentTrackRef.current = currentTrack;

  const repeatModeRef = useRef<RepeatMode>(repeatMode);
  repeatModeRef.current = repeatMode;

  const isShuffledRef = useRef<boolean>(isShuffled);
  isShuffledRef.current = isShuffled;

  const clearPlaybackTimeout = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  const markTrackAsTemporarilyFailed = useCallback((trackId: string) => {
    failedTrackIdsRef.current.add(trackId);
    setFailedTrackIds(Array.from(failedTrackIdsRef.current));
  }, []);

  const clearFailedTrack = useCallback((trackId: string) => {
    if (failedTrackIdsRef.current.has(trackId)) {
      failedTrackIdsRef.current.delete(trackId);
      setFailedTrackIds(Array.from(failedTrackIdsRef.current));
    }
  }, []);

  const clearAllFailedTracks = useCallback(() => {
    failedTrackIdsRef.current.clear();
    setFailedTrackIds([]);
  }, []);

  const registerTrackEndInterceptor = useCallback((interceptor: (() => boolean) | null) => {
    trackEndInterceptorRef.current = interceptor;
  }, []);

  const registerTrackPlayListener = useCallback((listener: ((track: MusicTrack) => void) | null) => {
    trackPlayListenerRef.current = listener;
  }, []);

  const pausePlayback = useCallback(() => {
    clearPlaybackTimeout();
    isUserPausedRef.current = true;
    equalizerEngine.setPlaybackActive(false);
    backgroundAudioService.releaseWakeLock();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [clearPlaybackTimeout]);

  // Derive current index in queue
  const currentIndex = React.useMemo(() => {
    if (!currentTrack || queue.length === 0) return -1;
    return queue.findIndex((t) => t.id === currentTrack.id);
  }, [currentTrack, queue]);

  // Persist player state to localStorage whenever meaningful state changes
  useEffect(() => {
    try {
      if (currentTrack) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_TRACK, JSON.stringify(currentTrack));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_TRACK);
      }
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
      localStorage.setItem(STORAGE_KEYS.ORIGINAL_QUEUE, JSON.stringify(originalQueue));
      localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
      localStorage.setItem(STORAGE_KEYS.REPEAT_MODE, repeatMode);
      localStorage.setItem(STORAGE_KEYS.IS_SHUFFLED, isShuffled ? "true" : "false");
      if (activePlaylistId) {
        localStorage.setItem(STORAGE_KEYS.PLAYLIST_ID, activePlaylistId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.PLAYLIST_ID);
      }
    } catch (err) {
      console.warn("Error saving player state to localStorage:", err);
    }
  }, [currentTrack, queue, originalQueue, volume, repeatMode, isShuffled, activePlaylistId]);

  // Save current position periodically
  useEffect(() => {
    try {
      if (currentTime > 0) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_TIME, currentTime.toString());
      }
      if (duration > 0) {
        localStorage.setItem(STORAGE_KEYS.DURATION, duration.toString());
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentTime, duration]);

  // Update Media Session Position State (defensively wrapped)
  const updateMediaSessionPositionState = useCallback(() => {
    if (audioRef.current && duration > 0) {
      backgroundAudioService.updatePositionState(
        currentTime,
        duration,
        audioRef.current.playbackRate || 1
      );
    }
  }, [currentTime, duration]);

  // Auto-skip to the next playable track in queue (skipping any failed tracks)
  const playNextPlayableTrack = useCallback((failedTrackTitle?: string) => {
    clearPlaybackTimeout();
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
    }
    setOfflineOffer(null);

    const currentQueue = queueRef.current;
    const current = currentTrackRef.current;
    const repeat = repeatModeRef.current;
    const shuffled = isShuffledRef.current;

    if (currentQueue.length === 0) {
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    const currentIdx = current ? currentQueue.findIndex((t) => t.id === current.id) : -1;
    let candidateIndex = -1;

    // 1. Search forward from currentIdx + 1
    for (let i = currentIdx + 1; i < currentQueue.length; i++) {
      if (!failedTrackIdsRef.current.has(currentQueue[i].id)) {
        candidateIndex = i;
        break;
      }
    }

    // 2. Wrap around to start if Repeat All, Shuffled, or regular continuous queue
    if (candidateIndex === -1 && (repeat === "all" || shuffled || currentQueue.length > 1)) {
      for (let i = 0; i <= currentIdx; i++) {
        if (i < currentQueue.length && !failedTrackIdsRef.current.has(currentQueue[i].id)) {
          candidateIndex = i;
          break;
        }
      }
    }

    if (candidateIndex !== -1) {
      const nextTrack = currentQueue[candidateIndex];
      if (failedTrackTitle) {
        showToast(`"${failedTrackTitle}" tidak dapat diputar — memutar lagu berikutnya.`, "info");
      } else {
        showToast("Lagu tidak dapat diputar — memutar lagu berikutnya.", "info");
      }
      loadAndPlayTrack(nextTrack, 0);
    } else {
      // All tracks in queue failed to play
      console.warn("[Player] All tracks in queue failed to play. Stopping player.");
      setIsPlaying(false);
      setIsLoading(false);
      setHasPlaybackError(true);
      setErrorMessage("Tidak ada lagu yang dapat diputar dalam antrean ini.");
      showToast("Tidak ada lagu yang dapat diputar dalam antrean ini.", "error");
    }
  }, [clearPlaybackTimeout, showToast]);

  // Unified Playback Failure Handler with 1x Auto-Retry before Download Offer / Auto-Skip
  const handlePlaybackFailure = useCallback(async (
    track: MusicTrack,
    resumePosition: number,
    reason?: string,
    errorType: PlaybackErrorType = "general_error"
  ) => {
    clearPlaybackTimeout();
    console.warn(`[Player] Handling playback failure for "${track.title}" (Retry count: ${retryCountRef.current}):`, reason);

    // 1. Check if track is already offline in IndexedDB
    const isOffline = await isTrackOffline(track.id).catch(() => false);
    if (isOffline) {
      const offlineUrl = await getOfflineAudioUrl(track.id);
      if (offlineUrl && audioRef.current) {
        console.log(`[Player] Fallback: Switching seamlessly to offline copy for "${track.title}"`);
        audioRef.current.src = offlineUrl;
        audioRef.current.load();
        if (resumePosition > 0) {
          audioRef.current.currentTime = resumePosition;
        }
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          setIsLoading(false);
          setHasPlaybackError(false);
          setPlaybackErrorType(null);
          setErrorMessage(null);
          clearFailedTrack(track.id);
          return;
        } catch (offlinePlayErr) {
          console.warn("[Player] Offline play error:", offlinePlayErr);
        }
      }
    }

    // Auto-retry 1x before offer or auto-skip
    if (retryCountRef.current === 0) {
      retryCountRef.current = 1;
      console.log(`[Player] Auto-retrying 1x for track "${track.title}"...`);

      // Refresh Google token proactively if needed
      try {
        await refreshGoogleDriveToken();
      } catch (tokErr) {
        console.warn("[Player] Token refresh notice during retry:", tokErr);
      }

      if (audioRef.current) {
        audioRef.current.load();
        await new Promise((r) => setTimeout(r, 300));
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          setIsLoading(false);
          setHasPlaybackError(false);
          setPlaybackErrorType(null);
          setErrorMessage(null);
          clearFailedTrack(track.id);
          return;
        } catch (retryPlayErr) {
          console.warn("[Player] 1x auto-retry play failed:", retryPlayErr);
        }
      }
    }

    // Mark track temporarily failed in this playback session
    markTrackAsTemporarilyFailed(track.id);
    setIsLoading(false);
    setIsPlaying(false);
    setHasPlaybackError(true);
    setPlaybackErrorType(errorType);
    setErrorMessage(reason || "Lagu tidak dapat diputar.");

    // Check if app is running in background / screen locked
    const isAppInBackground = typeof document !== "undefined" && document.visibilityState === "hidden";

    // If online, not yet downloaded, and app is visible in foreground, offer "Unduh & Putar Offline" with 5s countdown
    if (!isOffline && navigator.onLine && !isAppInBackground) {
      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }

      let remaining = 5;
      setOfflineOffer({
        track,
        remainingSeconds: 5,
        isDownloading: false,
        downloadProgress: 0,
        error: null,
      });

      offerIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (offerIntervalRef.current) {
            clearInterval(offerIntervalRef.current);
            offerIntervalRef.current = null;
          }
          setOfflineOffer(null);
          // 5 seconds elapsed without response -> Auto-skip to next playable track
          const currentQueue = queueRef.current;
          if (currentQueue.length > 1) {
            playNextPlayableTrack(track.title);
          } else {
            showToast(`"${track.title}" tidak dapat diputar.`, "error");
          }
        } else {
          setOfflineOffer((prev) => (prev ? { ...prev, remainingSeconds: remaining } : null));
        }
      }, 1000);
    } else {
      // If in background, already offline, or device is offline, auto-skip immediately if queue has other tracks
      const currentQueue = queueRef.current;
      if (currentQueue.length > 1) {
        playNextPlayableTrack(track.title);
      } else {
        showToast(`"${track.title}" tidak dapat diputar.`, "error");
      }
    }
  }, [clearPlaybackTimeout, markTrackAsTemporarilyFailed, clearFailedTrack, playNextPlayableTrack, showToast]);

  // Diagnose exact failure reason when audio element encounters an error
  const diagnoseAndHandleStreamError = async (track: MusicTrack, resumePosition: number) => {
    clearPlaybackTimeout();

    if (!navigator.onLine) {
      setHasPlaybackError(true);
      setPlaybackErrorType("network_error");
      setErrorMessage("Koneksi streaming terputus. Silakan periksa koneksi internet Anda.");
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        await handlePlaybackFailure(
          track,
          resumePosition,
          "Akun Google Drive belum terhubung. Silakan hubungkan Google Drive.",
          "drive_disconnected"
        );
        return;
      }

      // Probe stream endpoint with byte-range request to receive precise HTTP status
      const fileNameParam = encodeURIComponent(track.fileName || track.title || "");
      const probeUrl = `/api/audio/stream/${encodeURIComponent(
        track.driveFileId
      )}?token=${encodeURIComponent(token)}&mimeType=${encodeURIComponent(
        track.mimeType || "audio/mpeg"
      )}&fileName=${fileNameParam}`;

      const probeRes = await fetch(probeUrl, {
        method: "GET",
        headers: { Range: "bytes=0-1024" },
      });

      console.log(
        `[Player:Diagnostic] Probe HTTP status: ${probeRes.status}, Content-Type: ${probeRes.headers.get("content-type")}, Content-Range: ${probeRes.headers.get("content-range")}`
      );

      if (probeRes.status === 401) {
        if (retryCountRef.current === 0) {
          retryCountRef.current = 1;
          console.log("[Player] Token expired. Attempting automatic token refresh...");
          const freshToken = await refreshGoogleDriveToken();
          if (freshToken) {
            await loadAndPlayTrack(track, resumePosition);
            return;
          }
        }
        await handlePlaybackFailure(
          track,
          resumePosition,
          "Sesi Google Drive kedaluwarsa. Silakan perbarui akses akun Google Anda.",
          "token_expired"
        );
        return;
      }

      if (probeRes.status === 403) {
        await handlePlaybackFailure(
          track,
          resumePosition,
          "Akses ke file ditolak oleh Google Drive (Izin tidak mencukupi atau kuota terlampaui).",
          "forbidden"
        );
        return;
      }

      if (probeRes.status === 404) {
        await handlePlaybackFailure(
          track,
          resumePosition,
          "File audio tidak ditemukan di Google Drive (Mungkin telah dihapus atau dipindahkan).",
          "not_found"
        );
        return;
      }

      if (probeRes.status === 416) {
        if (resumePosition > 0) {
          console.log("[Player] 416 Range Not Satisfiable, restarting track from 0...");
          await loadAndPlayTrack(track, 0);
          return;
        }
        await handlePlaybackFailure(
          track,
          0,
          "Range audio tidak valid.",
          "range_error"
        );
        return;
      }

      if (probeRes.ok || probeRes.status === 206) {
        const probeContentType = probeRes.headers.get("content-type") || "";

        // Check if browser does not support this codec/mime
        if (
          audioRef.current &&
          probeContentType &&
          !probeContentType.includes("text/html") &&
          audioRef.current.error?.code === 4 &&
          audioRef.current.canPlayType(probeContentType) === ""
        ) {
          await handlePlaybackFailure(
            track,
            resumePosition,
            "Format atau codec audio tidak didukung oleh browser ini.",
            "codec_unsupported"
          );
          return;
        }

        await handlePlaybackFailure(
          track,
          resumePosition,
          "Gagal memuat streaming audio dari Google Drive.",
          "general_error"
        );
        return;
      }

      await handlePlaybackFailure(
        track,
        resumePosition,
        `Gagal streaming dari Google Drive (Status HTTP ${probeRes.status}).`,
        "general_error"
      );
    } catch (netErr: any) {
      console.warn("[Player] Stream probe failed:", netErr);
      await handlePlaybackFailure(
        track,
        resumePosition,
        "Koneksi streaming terputus. Silakan periksa koneksi internet Anda.",
        "network_error"
      );
    }
  };

  // Initialize Persistent Global HTML5 Audio Element & Keep Anchored to DOM
  useEffect(() => {
    if (!audioRef.current) {
      let existingAudio = typeof document !== "undefined"
        ? (document.getElementById("global-drive-audio-player") as HTMLAudioElement | null)
        : null;

      if (!existingAudio && typeof document !== "undefined") {
        const audio = new Audio();
        audio.id = "global-drive-audio-player";
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";
        (audio as any).playsInline = true;
        (audio as any).webkitPlaysInline = true;
        audio.volume = volume;
        // Anchor to DOM so mobile browsers / Android OS never treat it as an unparented background node
        audio.style.position = "fixed";
        audio.style.bottom = "0";
        audio.style.left = "0";
        audio.style.width = "1px";
        audio.style.height = "1px";
        audio.style.opacity = "0.01";
        audio.style.pointerEvents = "none";
        audio.style.zIndex = "-9999";
        document.body.appendChild(audio);
        existingAudio = audio;
      }
      audioRef.current = existingAudio;
      if (existingAudio) {
        existingAudio.crossOrigin = "anonymous";
        try {
          equalizerEngine.initialize(existingAudio);
        } catch (e) {
          console.warn("[Player] Audio engine init error:", e);
        }
      }
    }

    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      console.log(
        `[Audio:Diagnostic] loadstart - fileId: ${currentTrackRef.current?.driveFileId}, title: ${currentTrackRef.current?.title}, size: ${currentTrackRef.current?.fileSize}, mime: ${currentTrackRef.current?.mimeType}`
      );
    };

    const handleTimeUpdate = () => {
      if (audio) {
        const time = audio.currentTime;
        setCurrentTime(time);
        lastKnownPositionRef.current = time;

        // If audio has started moving, cancel start timeout and reset retry counters
        if (time > 0) {
          clearPlaybackTimeout();
          if (currentTrackRef.current) {
            clearFailedTrack(currentTrackRef.current.id);
          }
        }

        if (!isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
        updateMediaSessionPositionState();
      }
    };

    const handleLoadedMetadata = () => {
      console.log(
        `[Audio:Diagnostic] loadedmetadata - duration: ${audio.duration}s, readyState: ${audio.readyState}, networkState: ${audio.networkState}`
      );
      setIsLoading(false);
      setHasPlaybackError(false);
      setPlaybackErrorType(null);
      setErrorMessage(null);
      isRecoveringRef.current = false;
      if (audio && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      if (pendingResumePositionRef.current > 0) {
        audio.currentTime = pendingResumePositionRef.current;
        pendingResumePositionRef.current = 0;
      }
    };

    const handleWaiting = () => {
      console.log(`[Audio:Diagnostic] waiting (buffering) - currentTime: ${audio?.currentTime}`);
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      console.log(`[Audio:Diagnostic] canplay - readyState: ${audio?.readyState}`);
      setIsLoading(false);
      if (pendingResumePositionRef.current > 0) {
        audio.currentTime = pendingResumePositionRef.current;
        pendingResumePositionRef.current = 0;
      }
    };

    const handlePlaying = () => {
      console.log(
        `[Audio:Diagnostic] playing - currentTime: ${audio?.currentTime}, duration: ${audio?.duration}`
      );
      clearPlaybackTimeout();
      isUserPausedRef.current = false;
      setIsPlaying(true);
      setIsLoading(false);
      setHasPlaybackError(false);
      setPlaybackErrorType(null);
      setErrorMessage(null);
      retryCountRef.current = 0;
      isRecoveringRef.current = false;
      if (currentTrackRef.current) {
        clearFailedTrack(currentTrackRef.current.id);
      }
      equalizerEngine.setPlaybackActive(true);
      equalizerEngine.ensureAudioContextRunning().catch(() => {});
      backgroundAudioService.requestWakeLock().catch(() => {});
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    };

    const handleStalled = () => {
      console.warn(`[Audio:Diagnostic] stalled - networkState: ${audio?.networkState}`);
    };

    const handleSuspend = () => {
      console.log(`[Audio:Diagnostic] suspend - networkState: ${audio?.networkState}`);
    };

    const handlePause = () => {
      if (isUserPausedRef.current) {
        setIsPlaying(false);
        equalizerEngine.setPlaybackActive(false);
        backgroundAudioService.releaseWakeLock();
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      } else {
        // Ephemeral OS background pause (e.g. screen off or brief interruption)
        // Keep MediaSession in playing state to prevent Android from disposing the session
        console.log("[Audio:Diagnostic] Ephemeral OS background pause detected while playback active.");
      }
    };

    const handleEnded = () => {
      clearPlaybackTimeout();
      // DO NOT set isPlaying(false) or release wake lock if we have next tracks or repeat mode!
      // This preserves continuous Android background media session across track transitions.
      const hasNext =
        repeatModeRef.current === "one" ||
        repeatModeRef.current === "all" ||
        queueRef.current.length > 1;

      if (!hasNext) {
        setIsPlaying(false);
        isUserPausedRef.current = true;
        equalizerEngine.setPlaybackActive(false);
        backgroundAudioService.releaseWakeLock();
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      }
      handleTrackEnd();
    };

    const handleError = (e: Event) => {
      clearPlaybackTimeout();
      const err = audio.error;
      console.error(`[Audio:Diagnostic] ERROR:`, {
        driveFileId: currentTrackRef.current?.driveFileId,
        fileName: currentTrackRef.current?.fileName || currentTrackRef.current?.title,
        fileSize: currentTrackRef.current?.fileSize,
        duration: currentTrackRef.current?.duration,
        mimeType: currentTrackRef.current?.mimeType,
        mediaErrorCode: err?.code,
        mediaErrorMessage: err?.message,
        networkState: audio.networkState,
        readyState: audio.readyState,
        currentTime: audio.currentTime,
        src: audio.src,
      });

      setIsLoading(false);
      setIsPlaying(false);

      const track = currentTrackRef.current;
      if (track) {
        diagnoseAndHandleStreamError(track, lastKnownPositionRef.current);
      } else {
        setHasPlaybackError(true);
        setPlaybackErrorType("general_error");
        setErrorMessage("Gagal memuat streaming audio.");
      }
    };

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("suspend", handleSuspend);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    // Online / Offline listener
    const handleOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online && hasPlaybackError && currentTrackRef.current) {
        console.log("[Player] Device came online. Retrying playback...");
        retryPlayback();
      }
    };

    // CRITICAL: Prevent pausing on visibilitychange, blur, or pagehide
    const handleLifecycleResume = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;

      if (document.visibilityState === "visible") {
        setCurrentTime(currentAudio.currentTime);
        if (!isNaN(currentAudio.duration) && currentAudio.duration > 0) {
          setDuration(currentAudio.duration);
        }
      }

      // If user intended audio to play but OS paused/suspended it while screen was off or app was switched
      if (!isUserPausedRef.current && currentTrackRef.current) {
        equalizerEngine.setPlaybackActive(true);
        equalizerEngine.ensureAudioContextRunning().catch(() => {});
        if (currentAudio.paused && !isLoading) {
          currentAudio.play().catch((e) => {
            console.warn("[Player] Auto-resume on lifecycle notice:", e);
          });
        }
      }
    };

    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);
    document.addEventListener("visibilitychange", handleLifecycleResume);
    window.addEventListener("pageshow", handleLifecycleResume);
    window.addEventListener("focus", handleLifecycleResume);

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("suspend", handleSuspend);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
      document.removeEventListener("visibilitychange", handleLifecycleResume);
      window.removeEventListener("pageshow", handleLifecycleResume);
      window.removeEventListener("focus", handleLifecycleResume);
    };
  }, []);

  // Load and play track via streaming endpoint with HTTP Range support & 10s start timeout
  const loadAndPlayTrack = async (track: MusicTrack, resumePosition: number = 0) => {
    if (!audioRef.current) return;

    clearPlaybackTimeout();
    isUserPausedRef.current = false;
    equalizerEngine.setPlaybackActive(true);
    setIsLoading(true);
    setHasPlaybackError(false);
    setPlaybackErrorType(null);
    setErrorMessage(null);
    setCurrentTrack(track);
    setDuration(track.duration || 0);

    // Playback start timeout: adaptive duration with background tolerance
    const isBackground = typeof document !== "undefined" && document.visibilityState === "hidden";
    const timeoutDuration = isBackground ? 25000 : 12000;

    playbackTimeoutRef.current = setTimeout(() => {
      const audio = audioRef.current;
      // Do not abort if audio is still actively loading data in background
      if (
        audio &&
        !audio.error &&
        (audio.networkState === HTMLMediaElement.NETWORK_LOADING || audio.readyState >= 1)
      ) {
        console.log(`[Player] Audio still buffering for "${track.title}" in background. Extending tolerance.`);
        return;
      }

      if (audio && (audio.paused || audio.currentTime === 0)) {
        console.warn(`[Player] Playback timeout reached for "${track.title}". Triggering retry / auto-skip...`);
        handlePlaybackFailure(
          track,
          resumePosition,
          "Timeout: Audio tidak mulai diputar dalam batas waktu.",
          "general_error"
        );
      }
    }, timeoutDuration);

    try {
      // 1. Check if track is available in IndexedDB offline storage
      const offlineBlobUrl = await getOfflineAudioUrl(track.id).catch(() => null);
      let streamUrl = "";

      if (offlineBlobUrl) {
        console.log(`[Player] Using offline cached audio for "${track.title}" from IndexedDB.`);
        streamUrl = offlineBlobUrl;
      } else if (navigator.onLine) {
        let token = await getAccessToken();
        if (!token) {
          token = await refreshGoogleDriveToken();
        }

        if (!token) {
          await handlePlaybackFailure(
            track,
            resumePosition,
            "Akun Google Drive belum terhubung. Silakan hubungkan Google Drive.",
            "drive_disconnected"
          );
          return;
        }

        // Backend streaming URL supporting byte-range requests
        const fileNameParam = encodeURIComponent(track.fileName || track.title || "");
        streamUrl = `/api/audio/stream/${encodeURIComponent(
          track.driveFileId
        )}?token=${encodeURIComponent(token)}&mimeType=${encodeURIComponent(
          track.mimeType || "audio/mpeg"
        )}&fileName=${fileNameParam}`;
      } else {
        // Device is offline and track is NOT downloaded
        await handlePlaybackFailure(
          track,
          resumePosition,
          "Koneksi internet tidak tersedia dan lagu ini belum diunduh untuk offline.",
          "network_error"
        );
        return;
      }

      const audio = audioRef.current;

      pendingResumePositionRef.current = resumePosition;

      // Check against current audio src
      const currentSrcPath = audio.src
        ? new URL(audio.src, window.location.href).pathname + new URL(audio.src, window.location.href).search
        : "";

      if (currentSrcPath !== streamUrl) {
        audio.src = streamUrl;
        audio.load();
      }

      audio.volume = isMuted ? 0 : volume;

      if (resumePosition > 0 && audio.readyState >= 1) {
        audio.currentTime = resumePosition;
        pendingResumePositionRef.current = 0;
      }

      // Safely initialize equalizer Web Audio graph if supported
      try {
        equalizerEngine.initialize(audio);
        equalizerEngine.setPlaybackActive(true);
        await equalizerEngine.ensureAudioContextRunning();
      } catch (eqErr) {
        console.warn("[Player] Equalizer initialization warning:", eqErr);
      }

      try {
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        retryCountRef.current = 0;
        clearPlaybackTimeout();
        clearFailedTrack(track.id);

        // Notify listener for play count increment / analytics
        try {
          trackPlayListenerRef.current?.(track);
        } catch (e) {
          console.warn("Track play listener notice:", e);
        }
      } catch (playErr: any) {
        if (playErr.name === "AbortError") {
          // Play request was interrupted by newer action
          console.log("[Player] Play aborted by newer request.");
          clearPlaybackTimeout();
          return;
        }
        if (playErr.name === "NotAllowedError") {
          console.warn("[Player] Play blocked by autoplay policy.");
          clearPlaybackTimeout();
          setIsPlaying(false);
          setIsLoading(false);
          return;
        }
        throw playErr;
      }
    } catch (err: any) {
      console.warn("[Player] Playback start exception:", err);
      setIsLoading(false);
      setIsPlaying(false);
      await diagnoseAndHandleStreamError(track, resumePosition);
    }
  };

  const reconnectGoogleAndPlay = async () => {
    try {
      setIsLoading(true);
      setHasPlaybackError(false);
      setPlaybackErrorType(null);
      setErrorMessage(null);
      clearAllFailedTracks();
      const res = await requestInteractiveGoogleLogin();
      if (res?.accessToken && currentTrack) {
        retryCountRef.current = 0;
        await loadAndPlayTrack(currentTrack, lastKnownPositionRef.current);
      }
    } catch (err: any) {
      console.error("Reconnect Google error:", err);
      setHasPlaybackError(true);
      setPlaybackErrorType("drive_disconnected");
      setErrorMessage(err?.message || "Gagal menghubungkan Google Drive.");
    } finally {
      setIsLoading(false);
    }
  };

  // Play a single track and optionally update the queue
  const playTrack = (track: MusicTrack, newQueue?: MusicTrack[], playlistId?: string | null) => {
    clearFailedTrack(track.id);
    retryCountRef.current = 0;

    if (playlistId !== undefined) {
      setActivePlaylistId(playlistId);
    }

    if (newQueue && newQueue.length > 0) {
      setOriginalQueue(newQueue);
      if (isShuffled) {
        // Keep selected track first, shuffle remainder
        const others = newQueue.filter((t) => t.id !== track.id).sort(() => Math.random() - 0.5);
        setQueue([track, ...others]);
      } else {
        setQueue(newQueue);
      }
    } else if (!queue.some((q) => q.id === track.id)) {
      setQueue((prev) => [...prev, track]);
    }

    loadAndPlayTrack(track, 0);
  };

  // Play a full queue starting at specific index (resets failed tracks for this new session)
  const playQueueWithIndex = (
    newQueue: MusicTrack[],
    startIndex: number = 0,
    playlistId?: string | null
  ) => {
    if (!newQueue || newQueue.length === 0) return;
    clearAllFailedTracks();
    retryCountRef.current = 0;

    const clampedIndex = Math.max(0, Math.min(newQueue.length - 1, startIndex));
    const targetTrack = newQueue[clampedIndex];

    if (playlistId !== undefined) {
      setActivePlaylistId(playlistId);
    }

    setOriginalQueue(newQueue);
    if (isShuffled) {
      const others = newQueue.filter((t) => t.id !== targetTrack.id).sort(() => Math.random() - 0.5);
      setQueue([targetTrack, ...others]);
    } else {
      setQueue(newQueue);
    }

    loadAndPlayTrack(targetTrack, 0);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      clearPlaybackTimeout();
      isUserPausedRef.current = true;
      equalizerEngine.setPlaybackActive(false);
      audioRef.current.pause();
    } else {
      isUserPausedRef.current = false;
      equalizerEngine.setPlaybackActive(true);
      if (currentTrack) {
        // If audio src is missing or in error state, reload
        if (!audioRef.current.src || hasPlaybackError) {
          clearFailedTrack(currentTrack.id);
          retryCountRef.current = 0;
          loadAndPlayTrack(currentTrack, lastKnownPositionRef.current);
        } else {
          equalizerEngine.initialize(audioRef.current);
          equalizerEngine.ensureAudioContextRunning().catch(() => {});
          audioRef.current.play().catch((err) => {
            console.error("Play failed:", err);
            retryPlayback();
          });
        }
      }
    }
  };

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      const safeSeconds = Math.max(0, Math.min(duration || seconds, seconds));
      audioRef.current.currentTime = safeSeconds;
      setCurrentTime(safeSeconds);
      lastKnownPositionRef.current = safeSeconds;
      updateMediaSessionPositionState();
    }
  };

  const setVolumeLevel = (newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  };

  const toggleShuffle = () => {
    setIsShuffled((prev) => {
      const nextShuffled = !prev;
      if (nextShuffled && queue.length > 0) {
        const current = currentTrack;
        const others = queue.filter((t) => t.id !== current?.id).sort(() => Math.random() - 0.5);
        setQueue(current ? [current, ...others] : others);
      } else if (originalQueue.length > 0) {
        setQueue(originalQueue);
      }
      return nextShuffled;
    });
  };

  // Auto-play Next on Track Ended
  const handleTrackEnd = () => {
    clearPlaybackTimeout();

    // Check if sleep timer or external interceptor requested to stop playback at track end
    if (trackEndInterceptorRef.current) {
      const shouldProceed = trackEndInterceptorRef.current();
      if (!shouldProceed) {
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        return;
      }
    }

    // Repeat One (skip if this track failed)
    if (
      repeatModeRef.current === "one" &&
      currentTrackRef.current &&
      !failedTrackIdsRef.current.has(currentTrackRef.current.id)
    ) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((playErr) => {
          console.error("Repeat One play error:", playErr);
          playNext();
        });
      }
      return;
    }

    playNext();
  };

  const playNext = (skipFailed: boolean = true) => {
    clearPlaybackTimeout();
    const currentQueue = queueRef.current;
    const current = currentTrackRef.current;
    const repeat = repeatModeRef.current;
    const shuffled = isShuffledRef.current;

    if (!current || currentQueue.length === 0) return;

    const currentIdx = currentQueue.findIndex((t) => t.id === current.id);
    let nextIndex = -1;

    for (let i = currentIdx + 1; i < currentQueue.length; i++) {
      if (!skipFailed || !failedTrackIdsRef.current.has(currentQueue[i].id)) {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === -1 && (repeat === "all" || shuffled)) {
      for (let i = 0; i <= currentIdx; i++) {
        if (!skipFailed || !failedTrackIdsRef.current.has(currentQueue[i].id)) {
          nextIndex = i;
          break;
        }
      }
    }

    if (nextIndex !== -1 && nextIndex < currentQueue.length) {
      const nextTrack = currentQueue[nextIndex];
      retryCountRef.current = 0;
      loadAndPlayTrack(nextTrack, 0);
    } else {
      setIsPlaying(false);
      isUserPausedRef.current = true;
      equalizerEngine.setPlaybackActive(false);
      backgroundAudioService.releaseWakeLock();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    }
  };

  const playPrevious = () => {
    clearPlaybackTimeout();
    const currentQueue = queueRef.current;
    const current = currentTrackRef.current;

    if (!current || currentQueue.length === 0) return;

    if (currentTime > 3) {
      seekTo(0);
      return;
    }

    const currentIdx = currentQueue.findIndex((t) => t.id === current.id);
    let prevIndex = -1;

    for (let i = currentIdx - 1; i >= 0; i--) {
      if (!failedTrackIdsRef.current.has(currentQueue[i].id)) {
        prevIndex = i;
        break;
      }
    }

    if (prevIndex !== -1) {
      const prevTrack = currentQueue[prevIndex];
      retryCountRef.current = 0;
      loadAndPlayTrack(prevTrack, 0);
    } else {
      seekTo(0);
    }
  };

  // Keep Media Session API in sync for Android Lock Screen, Notification Shade, & Bluetooth controls
  useEffect(() => {
    backgroundAudioService.updateMediaSession(currentTrack, isPlaying, {
      onPlay: () => {
        isUserPausedRef.current = false;
        equalizerEngine.setPlaybackActive(true);
        if (audioRef.current) {
          equalizerEngine.initialize(audioRef.current);
          equalizerEngine.ensureAudioContextRunning().catch(() => {});
          audioRef.current.play().catch(console.error);
        }
      },
      onPause: () => {
        isUserPausedRef.current = true;
        equalizerEngine.setPlaybackActive(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      },
      onPrevious: () => {
        playPrevious();
      },
      onNext: () => {
        playNext();
      },
      onSeekTo: (position) => {
        seekTo(position);
      },
      onSeekBackward: (offset) => {
        seekTo(Math.max(0, currentTime - (offset || 10)));
      },
      onSeekForward: (offset) => {
        seekTo(Math.min(duration, currentTime + (offset || 10)));
      },
      onStop: () => {
        isUserPausedRef.current = true;
        equalizerEngine.setPlaybackActive(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
        }
      },
    });
  }, [currentTrack, isPlaying, duration, currentTime]);

  // Continuous Web Worker Watchdog: keeps AudioContext & playback active in Android background / screen lock
  useEffect(() => {
    if (isPlaying && !isUserPausedRef.current) {
      backgroundAudioService.startPlaybackWatchdog(() => {
        const audio = audioRef.current;
        if (!audio || isUserPausedRef.current) return;

        equalizerEngine.ensureAudioContextRunning().catch(() => {});

        if (audio.paused && !isLoading && !hasPlaybackError && currentTrackRef.current) {
          console.log("[BackgroundWatchdog] Auto-recovering interrupted playback...");
          audio.play().catch(() => {});
        }

        if ("mediaSession" in navigator && navigator.mediaSession.playbackState !== "playing") {
          navigator.mediaSession.playbackState = "playing";
        }
      });
    } else {
      backgroundAudioService.stopPlaybackWatchdog();
    }

    return () => {
      backgroundAudioService.stopPlaybackWatchdog();
    };
  }, [isPlaying, isLoading, hasPlaybackError]);

  const addToQueue = (track: MusicTrack) => {
    setQueue((prev) => [...prev, track]);
    setOriginalQueue((prev) => [...prev, track]);
  };

  const addToQueueNext = (track: MusicTrack) => {
    if (!currentTrack) {
      playTrack(track);
      return;
    }
    const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
    if (currentIdx === -1) {
      setQueue((prev) => [track, ...prev]);
    } else {
      const nextQueue = [...queue];
      nextQueue.splice(currentIdx + 1, 0, track);
      setQueue(nextQueue);
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
    } else {
      setQueue([]);
    }
  };

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue((prev) => {
      const result = [...prev];
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const retryPlayback = async () => {
    if (!currentTrack) return;
    clearPlaybackTimeout();
    setIsLoading(true);
    setHasPlaybackError(false);
    setPlaybackErrorType(null);
    setErrorMessage(null);

    // Reset failed status for current track so it can be played manually
    clearFailedTrack(currentTrack.id);
    retryCountRef.current = 0;

    // Refresh Google token proactively if needed
    try {
      await refreshGoogleDriveToken();
    } catch (refreshErr) {
      console.warn("[Player] Token refresh notice during retry:", refreshErr);
    }

    await loadAndPlayTrack(currentTrack, lastKnownPositionRef.current);
  };

  const resetPlayerState = useCallback(() => {
    clearPlaybackTimeout();
    isUserPausedRef.current = true;
    equalizerEngine.setPlaybackActive(false);
    backgroundAudioService.releaseWakeLock();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.currentTime = 0;
      } catch {}
    }
    clearAllFailedTracks();
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setOriginalQueue([]);
    setActivePlaylistId(null);
    setIsNowPlayingOpen(false);
    setIsQueueOpen(false);
    setHasPlaybackError(false);
    setPlaybackErrorType(null);
    setErrorMessage(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_TRACK);
      localStorage.removeItem(STORAGE_KEYS.QUEUE);
      localStorage.removeItem(STORAGE_KEYS.ORIGINAL_QUEUE);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_TIME);
      localStorage.removeItem(STORAGE_KEYS.DURATION);
      localStorage.removeItem(STORAGE_KEYS.PLAYLIST_ID);
    } catch {}
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    }
  }, [clearPlaybackTimeout, clearAllFailedTracks]);

  const updateTrackInContext = useCallback((updatedTrack: MusicTrack) => {
    setCurrentTrack((prev) => (prev && prev.id === updatedTrack.id ? { ...prev, ...updatedTrack } : prev));
    setQueue((prev) => prev.map((t) => (t.id === updatedTrack.id ? { ...t, ...updatedTrack } : t)));
    setOriginalQueue((prev) => prev.map((t) => (t.id === updatedTrack.id ? { ...t, ...updatedTrack } : t)));
  }, []);

  // Manual offline download triggered by user (e.g. from 3-dots menu)
  const downloadTrackForOfflineManual = useCallback(
    async (track: MusicTrack) => {
      if (activeDownloads[track.id] !== undefined) return;
      try {
        setActiveDownloads((prev) => ({ ...prev, [track.id]: 0 }));
        showToast(`Menyiapkan unduhan "${track.title}"...`, "info");
        await downloadTrackForOffline(track, (progress, _recv, _total, info) => {
          setActiveDownloads((prev) => ({ ...prev, [track.id]: progress }));
          if (info?.statusText && info.isResumed && progress < 10) {
            showToast(info.statusText, "info");
          }
        });
        setOfflineTrackIds((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
        showToast(`"${track.title}" berhasil disimpan dan kini Tersedia Offline!`, "success");
      } catch (err: any) {
        console.error("Manual offline download error:", err);
        showToast(err?.message || `Gagal mengunduh "${track.title}" untuk offline.`, "error");
      } finally {
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      }
    },
    [activeDownloads, showToast]
  );

  // Remove offline copy from local IndexedDB without touching Google Drive
  const removeTrackFromOffline = useCallback(
    async (track: MusicTrack) => {
      try {
        await removeTrackOffline(track.id);
        setOfflineTrackIds((prev) => prev.filter((id) => id !== track.id));
        showToast(`Salinan offline "${track.title}" berhasil dihapus. File di Google Drive tetap aman.`, "info");
      } catch (err: any) {
        console.error("Remove offline track error:", err);
        showToast("Gagal menghapus file offline.", "error");
      }
    },
    [showToast]
  );

  // Accept offline download from error offer banner
  const acceptOfflineDownload = useCallback(
    async (track: MusicTrack) => {
      if (offerIntervalRef.current) {
        clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = null;
      }
      setOfflineOffer((prev) =>
        prev
          ? {
              ...prev,
              isDownloading: true,
              downloadProgress: 0,
              error: null,
              statusText: "Menghubungkan ke Google Drive...",
            }
          : null
      );

      try {
        setActiveDownloads((prev) => ({ ...prev, [track.id]: 0 }));
        await downloadTrackForOffline(track, (progress, recv, total, info) => {
          setOfflineOffer((prev) =>
            prev
              ? {
                  ...prev,
                  downloadProgress: progress,
                  receivedBytes: recv,
                  totalBytes: total,
                  formattedReceived: info?.formattedReceived,
                  formattedTotal: info?.formattedTotal,
                  statusText: info?.statusText,
                  retryAttempt: info?.retryAttempt,
                }
              : null
          );
          setActiveDownloads((prev) => ({ ...prev, [track.id]: progress }));
        });

        setOfflineTrackIds((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
        setOfflineOffer(null);
        showToast(`"${track.title}" berhasil diunduh! Memulai pemutaran offline...`, "success");

        // Clear failed state and immediately play the newly saved offline track
        clearFailedTrack(track.id);
        retryCountRef.current = 0;
        await loadAndPlayTrack(track, lastKnownPositionRef.current);
      } catch (dlErr: any) {
        console.error("Offer offline download error:", dlErr);
        setOfflineOffer((prev) =>
          prev
            ? {
                ...prev,
                isDownloading: false,
                error: dlErr?.message || "Gagal mengunduh lagu dari Google Drive.",
                remainingSeconds: 15,
              }
            : null
        );
        showToast(`Gagal mengunduh "${track.title}"`, "error");

        // Restart countdown to give user time to click retry or auto-skip
        if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
        offerIntervalRef.current = setInterval(() => {
          setOfflineOffer((cur) => {
            if (!cur) return null;
            if (cur.remainingSeconds <= 1) {
              if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
              offerIntervalRef.current = null;
              playNextPlayableTrack(cur.track.title);
              return null;
            }
            return { ...cur, remainingSeconds: cur.remainingSeconds - 1 };
          });
        }, 1000);
      } finally {
        setActiveDownloads((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      }
    },
    [clearFailedTrack, playNextPlayableTrack, showToast]
  );

  // Skip offline offer banner and play next playable track
  const skipOfflineOffer = useCallback(() => {
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
    }
    const currentOffer = offlineOffer;
    setOfflineOffer(null);
    if (currentOffer) {
      playNextPlayableTrack(currentOffer.track.title);
    }
  }, [offlineOffer, playNextPlayableTrack]);

  // Dismiss offline offer without skipping immediately
  const dismissOfflineOffer = useCallback(() => {
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
    }
    setOfflineOffer(null);
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffled,
        queue,
        currentIndex,
        activePlaylistId,
        isNowPlayingOpen,
        isQueueOpen,
        isLoading,
        hasPlaybackError,
        playbackErrorType,
        errorMessage,
        isOnline,
        failedTrackIds,
        offlineTrackIds,
        activeDownloads,
        offlineOffer,
        playTrack,
        playQueueWithIndex,
        togglePlayPause,
        playNext,
        playPrevious,
        seekTo,
        setVolumeLevel,
        toggleMute,
        toggleRepeat,
        toggleShuffle,
        addToQueue,
        addToQueueNext,
        removeFromQueue,
        clearQueue,
        reorderQueue,
        setIsNowPlayingOpen,
        setIsQueueOpen,
        retryPlayback,
        reconnectGoogleAndPlay,
        pausePlayback,
        registerTrackEndInterceptor,
        registerTrackPlayListener,
        resetPlayerState,
        updateTrackInContext,
        downloadTrackForOfflineManual,
        removeTrackFromOffline,
        acceptOfflineDownload,
        skipOfflineOffer,
        dismissOfflineOffer,
        isTrackAvailableOffline,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  }
  return context;
};
