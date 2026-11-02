import React from "react";
import { DownloadCloud, SkipForward, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useMusicPlayer } from "../context/MusicPlayerContext";

export const OfflineDownloadOfferBanner: React.FC = () => {
  const {
    offlineOffer,
    acceptOfflineDownload,
    skipOfflineOffer,
  } = useMusicPlayer();

  if (!offlineOffer) return null;

  const {
    track,
    remainingSeconds,
    isDownloading,
    downloadProgress,
    formattedReceived,
    formattedTotal,
    statusText,
    error,
  } = offlineOffer;

  const hasByteInfo = formattedReceived && formattedTotal;

  return (
    <div
      id="offline-download-offer-banner"
      className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 w-[94%] max-w-lg z-50 animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/40 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            {isDownloading ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            ) : error ? (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          {/* Info Details */}
          <div className="flex-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-amber-300 leading-tight">
              {isDownloading
                ? "Mengunduh Audio untuk Offline"
                : error
                ? "Download Audio Gagal"
                : "Lagu tidak dapat diputar secara online"}
            </h4>
            <p className="text-xs text-slate-300 truncate mt-0.5">
              <span className="font-semibold text-white">{track.title}</span>
              {track.artist ? ` • ${track.artist}` : ""}
            </p>

            {isDownloading ? (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                  <span className="flex items-center gap-1.5 text-blue-400 truncate pr-2">
                    <DownloadCloud className="w-3.5 h-3.5 animate-bounce shrink-0" />
                    <span className="truncate">{statusText || "Mengunduh file audio..."}</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0 tabular-nums">
                    {hasByteInfo && (
                      <span className="text-slate-400 text-[10px]">
                        {formattedReceived} / {formattedTotal} •
                      </span>
                    )}
                    <span className="font-bold text-white">{downloadProgress}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-200 shadow-sm shadow-blue-500/50"
                    style={{ width: `${Math.max(2, downloadProgress)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                {error
                  ? "Unduhan terputus atau gagal. Anda dapat melanjutkan (resume) atau melewati lagu."
                  : "Download lagu ini ke penyimpanan lokal agar dapat diputar offline kapan saja?"}
              </p>
            )}

            {error && (
              <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 font-medium leading-relaxed">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons & Countdown Footer */}
        {!isDownloading && (
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-amber-400/90 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1">
              <span>Melewati otomatis dalam</span>
              <strong className="text-white font-bold tabular-nums px-1.5 py-0.2 bg-amber-500/20 rounded">
                {remainingSeconds}d
              </strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                id="btn-skip-offline-offer"
                onClick={skipOfflineOffer}
                className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Lewati Lagu</span>
              </button>

              <button
                id="btn-accept-offline-download"
                onClick={() => acceptOfflineDownload(track)}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-blue-500/20"
              >
                {error ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Lagi / Lanjutkan</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Unduh & Putar Offline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
