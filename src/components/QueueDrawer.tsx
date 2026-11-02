import React from "react";
import {
  X,
  Trash2,
  Music,
  Play,
  Volume2,
  ChevronUp,
  ChevronDown,
  ListMusic,
  CheckCircle2,
} from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { formatDuration } from "../services/audioMetadata";

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    currentTrack,
    isPlaying,
    isQueueOpen,
    failedTrackIds,
    isTrackAvailableOffline,
    setIsQueueOpen,
    playTrack,
    removeFromQueue,
    clearQueue,
    reorderQueue,
  } = useMusicPlayer();

  if (!isQueueOpen) return null;

  return (
    <div
      id="queue-drawer-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={() => setIsQueueOpen(false)}
    >
      <div
        id="queue-drawer-content"
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Antrean Putar</h3>
              <p className="text-xs text-slate-500">{queue.length} Lagu dalam antrean</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {queue.length > 1 && (
              <button
                id="btn-clear-queue"
                onClick={clearQueue}
                className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Bersihkan
              </button>
            )}
            <button
              id="btn-close-queue"
              onClick={() => setIsQueueOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Tutup Antrean"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {queue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Music className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">Antrean Kosong</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Pilih lagu dari Library Musik dan pilih "Tambahkan ke Antrean".
              </p>
            </div>
          ) : (
            queue.map((track, index) => {
              const isCurrent = currentTrack?.id === track.id;
              const isFailed = failedTrackIds?.includes(track.id);

              return (
                <div
                  key={`${track.id}-${index}`}
                  id={`queue-item-${index}`}
                  className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? "bg-blue-50/80 border-blue-200 text-blue-900"
                      : isFailed
                      ? "bg-amber-50/60 border-amber-200/70 text-slate-600 opacity-80"
                      : "bg-white border-slate-200/70 hover:border-slate-300 text-slate-800"
                  }`}
                >
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    onClick={() => playTrack(track)}
                  >
                    {/* Artwork / Playing state */}
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-blue-600/70 flex items-center justify-center text-white">
                          {isPlaying ? (
                            <Volume2 className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-sm font-semibold truncate leading-tight ${
                            isCurrent ? "text-blue-700" : isFailed ? "text-amber-800" : "text-slate-900"
                          }`}
                        >
                          {track.title}
                        </p>
                        {isTrackAvailableOffline(track.id) && (
                          <span
                            title="Tersedia Offline"
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Offline</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded border border-amber-200 shrink-0">
                            Dilewati
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {track.artist || "Artis Tidak Diketahui"}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Reordering */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-xs text-slate-400 font-medium tabular-nums whitespace-nowrap mr-1">
                      {formatDuration(track.duration)}
                    </span>

                    {/* Move Up */}
                    <button
                      disabled={index === 0}
                      onClick={() => reorderQueue(index, index - 1)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100"
                      title="Pindahkan ke Atas"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      disabled={index === queue.length - 1}
                      onClick={() => reorderQueue(index, index + 1)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100"
                      title="Pindahkan ke Bawah"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Remove from Queue */}
                    <button
                      onClick={() => removeFromQueue(index)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-0.5"
                      title="Hapus dari antrean"
                      aria-label="Hapus Lagu dari Antrean"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
