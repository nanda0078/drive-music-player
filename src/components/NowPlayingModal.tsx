import React, { useState } from "react";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  PlusCircle,
  Music,
  Loader2,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  Moon,
} from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { useEqualizer } from "../context/EqualizerContext";
import { useSleepTimer } from "../context/SleepTimerContext";
import { formatDuration } from "../services/audioMetadata";
import { MarqueeSongTitle } from "./MarqueeSongTitle";

interface NowPlayingModalProps {
  onAddToPlaylist: () => void;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({ onAddToPlaylist }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    queue,
    isNowPlayingOpen,
    isLoading,
    hasPlaybackError,
    playbackErrorType,
    errorMessage,
    setIsNowPlayingOpen,
    setIsQueueOpen,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolumeLevel,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    retryPlayback,
    reconnectGoogleAndPlay,
  } = useMusicPlayer();

  const { isEqEnabled, setIsEqualizerOpen } = useEqualizer();
  const {
    isActive: isSleepTimerActive,
    setIsSleepTimerModalOpen,
    formatRemainingTime,
  } = useSleepTimer();

  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [seekValue, setSeekValue] = useState<number>(0);

  if (!isNowPlayingOpen || !currentTrack) return null;

  const currentDisplayTime = isSeeking ? seekValue : currentTime;
  const progressPercent = duration > 0 ? (currentDisplayTime / duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSeeking(true);
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    seekTo(seekValue);
    setIsSeeking(false);
  };

  return (
    <div
      id="now-playing-modal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <button
          id="btn-close-now-playing"
          onClick={() => setIsNowPlayingOpen(false)}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Tutup"
          aria-label="Tutup Halaman Pemutar Musik"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-300 font-semibold flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>Sedang Diputar</span>
          </p>
          <p className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]">
            {currentTrack.album || "Google Drive Music"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sleep Timer Quick Button */}
          <button
            id="btn-now-playing-sleep-timer-top"
            onClick={() => setIsSleepTimerModalOpen(true)}
            className={`p-2.5 rounded-full transition-all ${
              isSleepTimerActive
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={
              isSleepTimerActive
                ? `Sleep Timer Aktif: ${formatRemainingTime()}`
                : "Buka Pengatur Waktu Tidur"
            }
            aria-label="Buka Pengatur Waktu Tidur"
          >
            <Moon className={`w-5 h-5 ${isSleepTimerActive ? "fill-current" : ""}`} />
          </button>

          {/* Equalizer Quick Button */}
          <button
            id="btn-now-playing-equalizer-top"
            onClick={() => setIsEqualizerOpen(true)}
            className={`p-2.5 rounded-full transition-all ${
              isEqEnabled
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title="Buka Audio Equalizer"
            aria-label="Buka Audio Equalizer"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          <button
            id="btn-now-playing-queue"
            onClick={() => {
              setIsNowPlayingOpen(false);
              setIsQueueOpen(true);
            }}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Antrean Putar"
            aria-label="Buka Antrean Putar"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Track Presentation */}
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center my-4 sm:my-6">
        {/* Large Artwork */}
        <div className="relative aspect-square w-full max-w-[320px] sm:max-w-[360px] mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-white/10 bg-slate-900">
          {currentTrack.artworkUrl ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              loading="lazy"
              decoding="async"
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? "scale-100" : "scale-95 opacity-90"
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/60 via-slate-900 to-indigo-950 text-blue-300 p-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mb-4 backdrop-blur-sm border border-white/10">
                <Music className="w-10 h-10 text-blue-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">Drive Music Player</p>
            </div>
          )}

          {/* Loading / Error indicator inside artwork */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center text-white">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            </div>
          )}
        </div>

        {/* Track Title & Artist with (+) Add to Playlist Button */}
        <div className="mt-6 flex items-center justify-between gap-3.5 w-full">
          <div className="min-w-0 flex-1 overflow-hidden">
            <MarqueeSongTitle
              id="now-playing-title"
              text={currentTrack.title}
              className="text-xl sm:text-2xl font-bold text-white tracking-tight"
            />
            <p
              id="now-playing-artist"
              className="text-sm sm:text-base text-slate-300 font-medium truncate mt-1 flex items-center gap-1.5 flex-wrap"
            >
              <span className="truncate">{currentTrack.artist || "Artis Tidak Diketahui"}</span>
              {(currentTrack.year || currentTrack.genre) && (
                <span className="text-xs text-slate-400 font-normal">
                  {currentTrack.year ? `• ${currentTrack.year}` : ""}
                  {currentTrack.genre ? ` • ${currentTrack.genre}` : ""}
                </span>
              )}
            </p>
          </div>

          {/* Plus (+) in Circle Button for Add to Playlist */}
          <button
            id="btn-now-playing-add-playlist"
            onClick={onAddToPlaylist}
            className="p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-blue-400 hover:text-white transition-all shrink-0 flex items-center justify-center border border-white/10 shadow-sm focus:outline-hidden"
            title="Tambah ke Playlist"
            aria-label="Tambah ke Playlist"
          >
            <PlusCircle className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        {/* Error warning banner */}
        {hasPlaybackError && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center justify-between text-rose-200 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="truncate">{errorMessage || "Streaming gagal dimuat."}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {playbackErrorType === "token_expired" || playbackErrorType === "drive_disconnected" ? (
                <button
                  onClick={reconnectGoogleAndPlay}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-lg transition-all shrink-0"
                >
                  Perbarui Akses
                </button>
              ) : (
                <button
                  onClick={retryPlayback}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-lg transition-all shrink-0"
                >
                  Coba Lagi
                </button>
              )}
              {queue.length > 1 && (
                <button
                  onClick={() => playNext()}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 font-semibold rounded-lg transition-all shrink-0"
                  title="Lewati ke lagu berikutnya"
                >
                  Lewati
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrubber Progress Bar */}
        <div className="mt-6">
          <div className="relative flex items-center">
            <input
              id="now-playing-scrubber"
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentDisplayTime}
              onChange={handleSeekChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-hidden"
              aria-label="Posisi Pemutaran Musik"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mt-2">
            <span>{formatDuration(currentDisplayTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="mt-6 flex items-center justify-between max-w-sm mx-auto w-full">
          {/* Shuffle */}
          <button
            id="btn-now-playing-shuffle"
            onClick={toggleShuffle}
            className={`p-3 rounded-full transition-colors ${
              isShuffled ? "text-blue-400 bg-blue-500/20" : "text-slate-400 hover:text-white"
            }`}
            title={isShuffled ? "Acak Aktif" : "Acak Nonaktif"}
            aria-label="Acak Urutan Lagu"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous */}
          <button
            id="btn-now-playing-prev"
            onClick={playPrevious}
            className="p-3 text-white hover:text-blue-300 transition-colors active:scale-95"
            title="Lagu Sebelumnya"
            aria-label="Lagu Sebelumnya"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          {/* Play/Pause */}
          <button
            id="btn-now-playing-play"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xl shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
            title={isPlaying ? "Jeda" : "Putar"}
            aria-label={isPlaying ? "Jeda Pemutaran" : "Mulai Pemutaran"}
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* Next */}
          <button
            id="btn-now-playing-next"
            onClick={playNext}
            className="p-3 text-white hover:text-blue-300 transition-colors active:scale-95"
            title="Lagu Berikutnya"
            aria-label="Lagu Berikutnya"
          >
            <SkipForward className="w-7 h-7" />
          </button>

          {/* Repeat */}
          <button
            id="btn-now-playing-repeat"
            onClick={toggleRepeat}
            className={`p-3 rounded-full transition-colors ${
              repeatMode !== "off"
                ? "text-blue-400 bg-blue-500/20"
                : "text-slate-400 hover:text-white"
            }`}
            title={
              repeatMode === "one"
                ? "Ulangi Lagu Ini"
                : repeatMode === "all"
                ? "Ulangi Semua Lagu"
                : "Ulangi Nonaktif"
            }
            aria-label="Mode Ulangi"
          >
            {repeatMode === "one" ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Volume Slider */}
        <div className="mt-8 flex items-center gap-3 max-w-xs mx-auto w-full">
          <button
            id="btn-now-playing-volume-mute"
            onClick={toggleMute}
            className="text-slate-400 hover:text-white transition-colors"
            title={isMuted ? "Bunyikan" : "Bisukan"}
            aria-label="Bisukan / Bunyikan Volume"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            id="now-playing-volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-400 focus:outline-hidden"
            aria-label="Pengatur Volume"
          />
        </div>
      </div>
    </div>
  );
};
