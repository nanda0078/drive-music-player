import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Loader2,
  AlertCircle,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize2,
  SlidersHorizontal,
  Moon,
  Heart,
  Eye,
  EyeOff,
  Clock,
  Check,
  ChevronUp,
} from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { useEqualizer } from "../context/EqualizerContext";
import { useSleepTimer } from "../context/SleepTimerContext";
import { formatDuration } from "../services/audioMetadata";
import { MusicTrack } from "../types/music";

export const AUTOHIDE_STORAGE_KEY = "drive_music_autohide_duration";

export const AUTOHIDE_OPTIONS = [
  { label: "3 Detik", value: 3000 },
  { label: "5 Detik (Default)", value: 5000 },
  { label: "10 Detik", value: 10000 },
  { label: "15 Detik", value: 15000 },
  { label: "Nonaktif", value: 0 },
];

interface MiniPlayerProps {
  onToggleFavorite?: (track: MusicTrack) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onToggleFavorite }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    hasPlaybackError,
    playbackErrorType,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolumeLevel,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    setIsNowPlayingOpen,
    setIsQueueOpen,
    retryPlayback,
    reconnectGoogleAndPlay,
    errorMessage,
  } = useMusicPlayer();

  const { isEqEnabled, setIsEqualizerOpen } = useEqualizer();
  const {
    isActive: isSleepTimerActive,
    setIsSleepTimerModalOpen,
    formatRemainingTime,
  } = useSleepTimer();

  // Auto Hide Settings & State
  const [autoHideDuration, setAutoHideDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(AUTOHIDE_STORAGE_KEY);
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
      return 5000; // default 5 seconds
    } catch {
      return 5000;
    }
  });

  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveredRef = useRef<boolean>(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    setIsVisible(true);
    clearHideTimer();
    if (autoHideDuration > 0 && !isHoveredRef.current) {
      hideTimerRef.current = setTimeout(() => {
        if (!isHoveredRef.current) {
          setIsVisible(false);
          setIsMenuOpen(false);
        }
      }, autoHideDuration);
    }
  }, [autoHideDuration, clearHideTimer]);

  const showPlayer = useCallback(() => {
    setIsVisible(true);
    resetTimer();
  }, [resetTimer]);

  const updateAutoHideDuration = useCallback(
    (duration: number) => {
      setAutoHideDuration(duration);
      try {
        localStorage.setItem(AUTOHIDE_STORAGE_KEY, duration.toString());
        window.dispatchEvent(new Event("autohide-setting-changed"));
      } catch {}
      setIsMenuOpen(false);
      setIsVisible(true);
      clearHideTimer();
      if (duration > 0) {
        hideTimerRef.current = setTimeout(() => {
          if (!isHoveredRef.current) {
            setIsVisible(false);
          }
        }, duration);
      }
    },
    [clearHideTimer]
  );

  // Sync setting if changed in Settings Modal
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem(AUTOHIDE_STORAGE_KEY);
        if (saved !== null) {
          const val = parseInt(saved, 10);
          if (!isNaN(val)) setAutoHideDuration(val);
        }
      } catch {}
    };
    window.addEventListener("autohide-setting-changed", handleStorageChange);
    return () => {
      window.removeEventListener("autohide-setting-changed", handleStorageChange);
    };
  }, []);

  // Dismiss dropdown menu when tapping / clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".autohide-menu-container")) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle global mouse movement near the bottom of viewport (threshold: 120px)
  useEffect(() => {
    if (autoHideDuration <= 0) {
      setIsVisible(true);
      clearHideTimer();
      return;
    }

    resetTimer();

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (e.clientY >= window.innerHeight - 120) {
        showPlayer();
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });

    return () => {
      clearHideTimer();
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [autoHideDuration, currentTrack?.id, isPlaying, resetTimer, showPlayer, clearHideTimer]);

  if (!currentTrack) return null;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  };

  return (
    <>
      {/* 1. Transparent Trigger Area when player is auto-hidden */}
      {!isVisible && (
        <div
          id="mini-player-trigger"
          onClick={showPlayer}
          onTouchStart={showPlayer}
          onMouseEnter={showPlayer}
          className="fixed bottom-[58px] md:bottom-0 left-0 right-0 h-9 z-30 flex items-center justify-center cursor-pointer pointer-events-auto transition-all animate-in fade-in duration-200"
          style={{
            marginBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          role="button"
          tabIndex={0}
          aria-label="Tampilkan Pemutar Musik"
          title="Ketuk atau arahkan mouse ke sini untuk memunculkan pemutar musik"
        >
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-xs font-semibold shadow-lg border border-slate-700/60 hover:bg-blue-600 hover:border-blue-500 transition-all hover:scale-105 active:scale-95">
            <ChevronUp className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
            <span className="text-[11px] font-medium tracking-tight">Tampilkan Player</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5"></span>
          </div>
        </div>
      )}

      {/* 2. Persistent Bottom Music Player Container with Smooth Slide Animation */}
      <div
        id="mini-player"
        onMouseEnter={() => {
          isHoveredRef.current = true;
          setIsVisible(true);
          clearHideTimer();
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
          resetTimer();
        }}
        onMouseMove={resetTimer}
        onTouchStart={resetTimer}
        className={`fixed bottom-[58px] md:bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] transition-all duration-300 ease-in-out w-full max-w-full box-border ${
          isVisible
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-[calc(100%+60px)] md:translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
        }}
      >
      {/* ========================================================= */}
      {/* MODE MOBILE (Tampilan 3 Baris Ringkas Khusus Smartphone) */}
      {/* ========================================================= */}
      <div className="flex md:hidden flex-col w-full px-3 py-2 space-y-1.5 box-border max-w-full">
        {/* BARIS 1: Artwork | Judul & Artis | Favorit | Equalizer | Queue */}
        <div className="flex items-center justify-between gap-2.5 w-full">
          <div
            id="mobile-player-track-info"
            onClick={() => setIsNowPlayingOpen(true)}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer active:opacity-80"
            role="button"
            tabIndex={0}
            aria-label="Buka Tampilan Penuh Sekarang Memutar"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 shadow-2xs flex items-center justify-center">
              {currentTrack.artworkUrl ? (
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white">
                  <Music className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                {currentTrack.title}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                {currentTrack.artist || "Artis Tidak Diketahui"}
              </p>
            </div>
          </div>

          {/* Quick Access Icons */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {hasPlaybackError && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (playbackErrorType === "token_expired" || playbackErrorType === "drive_disconnected") {
                    reconnectGoogleAndPlay();
                  } else {
                    retryPlayback();
                  }
                }}
                className="px-2 py-1 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-rose-100 transition-colors"
                title={errorMessage || "Coba Putar Ulang"}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>
                  {playbackErrorType === "token_expired" || playbackErrorType === "drive_disconnected"
                    ? "Login"
                    : "Ulangi"}
                </span>
              </button>
            )}

            {/* Favorite Button */}
            {onToggleFavorite && (
              <button
                id="btn-mobile-player-fav"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(currentTrack);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                  currentTrack.isFavorite
                    ? "text-rose-500 bg-rose-50"
                    : "text-slate-400 hover:text-slate-700 active:bg-slate-100"
                }`}
                title={currentTrack.isFavorite ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                aria-label="Favorit Lagu Ini"
              >
                <Heart className={`w-4 h-4 ${currentTrack.isFavorite ? "fill-rose-500" : ""}`} />
              </button>
            )}

            {/* Equalizer Button */}
            <button
              id="btn-mobile-equalizer"
              onClick={() => setIsEqualizerOpen(true)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors cursor-pointer relative ${
                isEqEnabled
                  ? "text-blue-600 bg-blue-50"
                  : "text-slate-500 hover:text-slate-800 active:bg-slate-100"
              }`}
              title="Buka Audio Equalizer"
              aria-label="Buka Audio Equalizer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {isEqEnabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 absolute top-1.5 right-1.5 animate-pulse"></span>
              )}
            </button>

            {/* Queue Button */}
            <button
              id="btn-mobile-queue"
              onClick={() => setIsQueueOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 active:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Antrean Musik"
              aria-label="Buka Antrean Musik"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Auto Hide Button Mobile */}
            <div className="relative autohide-menu-container">
              <button
                id="btn-mobile-autohide"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen((prev) => !prev);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors cursor-pointer relative ${
                  autoHideDuration > 0
                    ? "text-blue-600 bg-blue-50"
                    : "text-slate-500 hover:text-slate-800 active:bg-slate-100"
                }`}
                title={`Auto Hide: ${
                  autoHideDuration === 0 ? "Nonaktif" : `${autoHideDuration / 1000}s`
                }`}
                aria-label="Pengaturan Auto Hide Player"
              >
                {autoHideDuration > 0 ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {autoHideDuration > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 absolute top-1.5 right-1.5"></span>
                )}
              </button>

              {/* Mobile Auto Hide Dropdown Popup */}
              {isMenuOpen && (
                <div
                  id="mobile-autohide-dropdown"
                  className="absolute bottom-full right-0 mb-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Auto Hide</span>
                  </div>
                  {AUTOHIDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateAutoHideDuration(opt.value);
                      }}
                      className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        autoHideDuration === opt.value
                          ? "text-blue-600 font-bold bg-blue-50/50"
                          : "text-slate-700 font-medium"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {autoHideDuration === opt.value && (
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BARIS 2: Progress Bar / Scrubber + Times */}
        <div className="w-full space-y-0.5">
          <div className="w-full relative flex items-center px-0.5">
            <input
              id="mobile-scrubber"
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
              aria-label="Posisi Pemutaran Lagu"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5 leading-none">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* BARIS 3: Previous | Play/Pause | Next (3-Kolom Sempurna 1fr auto 1fr) */}
        <div
          id="mobile-player-controls"
          className="grid grid-cols-3 items-center w-full max-w-full box-border py-0.5"
        >
          {/* Kolom Kiri: Previous */}
          <div className="flex items-center justify-center">
            <button
              id="btn-mobile-prev"
              onClick={playPrevious}
              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:text-slate-900 active:scale-90 active:bg-slate-100 rounded-full transition-all touch-manipulation cursor-pointer"
              title="Lagu Sebelumnya"
              aria-label="Lagu Sebelumnya"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
          </div>

          {/* Kolom Tengah: Play / Pause */}
          <div className="flex items-center justify-center">
            <button
              id="btn-mobile-play-pause"
              onClick={togglePlayPause}
              className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/25 transition-all touch-manipulation cursor-pointer"
              title={isPlaying ? "Jeda" : "Putar"}
              aria-label={isPlaying ? "Jeda Pemutaran" : "Mulai Pemutaran"}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Kolom Kanan: Next */}
          <div className="flex items-center justify-center">
            <button
              id="btn-mobile-next"
              onClick={playNext}
              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:text-slate-900 active:scale-90 active:bg-slate-100 rounded-full transition-all touch-manipulation cursor-pointer"
              title="Lagu Berikutnya"
              aria-label="Lagu Berikutnya"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE DESKTOP / TABLET (Layout 3 Kolom Tetap Dipertahankan) */}
      {/* ========================================================= */}
      <div className="hidden md:flex h-20 md:h-24 px-6 sm:px-8 items-center justify-between gap-4">
        {/* Kolom Kiri: Info Lagu */}
        <div
          id="mini-player-info-area"
          onClick={() => setIsNowPlayingOpen(true)}
          className="flex items-center gap-3 sm:gap-4 w-1/4 cursor-pointer group shrink-0 min-w-0"
          role="button"
          tabIndex={0}
          aria-label="Buka Sekarang Memutar"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 shadow-xs flex items-center justify-center">
            {currentTrack.artworkUrl ? (
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white">
                <Music className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors leading-tight">
              {currentTrack.title}
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
              {currentTrack.artist || "Unknown Artist"}
            </p>
          </div>
        </div>

        {/* Kolom Tengah: Kontrol Utama & Scrubber */}
        <div className="flex flex-1 flex-col items-center max-w-lg px-2">
          {/* Baris Tombol Kontrol */}
          <div className="flex items-center gap-5 mb-1.5">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 transition-colors rounded-lg hover:bg-slate-100 ${
                isShuffled ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Acak Lagu"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={playPrevious}
              className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors active:scale-95"
              title="Lagu Sebelumnya"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 hover:scale-105 transition-all shadow-md active:scale-95"
              title={isPlaying ? "Jeda" : "Putar"}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors active:scale-95"
              title="Lagu Berikutnya"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-1.5 transition-colors rounded-lg hover:bg-slate-100 ${
                repeatMode !== "off" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Ulangi"
            >
              {repeatMode === "one" ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Scrubber Bar Desktop */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 w-8 text-right shrink-0">
              {formatDuration(currentTime)}
            </span>
            <div className="flex-1 relative flex items-center group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleSeekChange}
                className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600 focus:outline-hidden group-hover:h-1.5 transition-all"
                aria-label="Progress Bar"
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 w-8 shrink-0">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Kolom Kanan: Volume & Antrean */}
        <div className="flex items-center justify-end gap-3 sm:gap-4 shrink-0 w-1/4">
          {hasPlaybackError && (
            <button
              onClick={() => {
                if (playbackErrorType === "token_expired" || playbackErrorType === "drive_disconnected") {
                  reconnectGoogleAndPlay();
                } else {
                  retryPlayback();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 active:scale-95 transition-all"
              title={errorMessage || "Coba Putar Ulang"}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>
                {playbackErrorType === "token_expired" || playbackErrorType === "drive_disconnected"
                  ? "Perbarui Akses"
                  : "Coba Lagi"}
              </span>
            </button>
          )}

          {/* Slider Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title={isMuted ? "Bunyikan" : "Bisukan"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
              className="w-20 lg:w-24 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
              aria-label="Volume"
            />
          </div>

          {/* Tombol Sleep Timer Desktop */}
          <button
            id="btn-desktop-sleep-timer"
            onClick={() => setIsSleepTimerModalOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isSleepTimerActive
                ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title={
              isSleepTimerActive
                ? `Sleep Timer: ${formatRemainingTime()}`
                : "Pengatur Waktu Tidur"
            }
            aria-label="Buka Pengatur Waktu Tidur"
          >
            <Moon className={`w-5 h-5 ${isSleepTimerActive ? "fill-current" : ""}`} />
          </button>

          {/* Tombol Equalizer Desktop */}
          <button
            id="btn-desktop-equalizer"
            onClick={() => setIsEqualizerOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isEqEnabled
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Audio Equalizer"
            aria-label="Buka Audio Equalizer"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          {/* Tombol Antrean */}
          <button
            onClick={() => setIsQueueOpen(true)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Antrean Putar"
            aria-label="Buka Antrean Putar"
          >
            <ListMusic className="w-5 h-5" />
          </button>

          {/* Tombol Auto Hide Desktop */}
          <div className="relative autohide-menu-container">
            <button
              id="btn-desktop-autohide"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                autoHideDuration > 0
                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
              title={`Auto Hide: ${
                autoHideDuration === 0 ? "Nonaktif" : `${autoHideDuration / 1000} detik`
              }`}
              aria-label="Pengaturan Auto Hide Player"
            >
              {autoHideDuration > 0 ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>

            {/* Desktop Auto Hide Dropdown Popup */}
            {isMenuOpen && (
              <div
                id="desktop-autohide-dropdown"
                className="absolute bottom-full right-0 mb-3 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Auto Hide Player</span>
                </div>
                {AUTOHIDE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateAutoHideDuration(opt.value)}
                    className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                      autoHideDuration === opt.value
                        ? "text-blue-600 font-bold bg-blue-50/50"
                        : "text-slate-700 font-medium"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {autoHideDuration === opt.value && (
                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
