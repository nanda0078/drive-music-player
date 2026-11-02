import React from "react";
import {
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  X,
  Music,
  Folder,
  ListMusic,
  Trash2,
} from "lucide-react";

interface ResetAppDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => Promise<void>;
  isResetting: boolean;
  totalTracks: number;
  totalFolders: number;
  totalPlaylists: number;
}

export const ResetAppDataModal: React.FC<ResetAppDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  isResetting,
  totalTracks,
  totalFolders,
  totalPlaylists,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="reset-app-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isResetting) onClose();
      }}
    >
      <div
        id="reset-app-modal-content"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Reset Seluruh Data Aplikasi
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Kembalikan aplikasi ke kondisi awal (0 Data)
              </p>
            </div>
          </div>
          {!isResetting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Main Warning Box */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-bold leading-tight">
                  Tindakan ini akan mengosongkan seluruh isi data aplikasi
                </p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Semua indeks metadata lagu, folder library, playlist, antrean musik, riwayat, dan cache aplikasi akan dibersihkan hingga kembali kosong seperti awal baru dipasang.
                </p>
              </div>
            </div>
          </div>

          {/* Current Data Overview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Data yang akan direset:
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <Music className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <span className="block text-base font-bold text-slate-800">{totalTracks}</span>
                <span className="text-[11px] text-slate-500 font-medium">Lagu</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <Folder className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                <span className="block text-base font-bold text-slate-800">{totalFolders}</span>
                <span className="text-[11px] text-slate-500 font-medium">Folder</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <ListMusic className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                <span className="block text-base font-bold text-slate-800">{totalPlaylists}</span>
                <span className="text-[11px] text-slate-500 font-medium">Playlist</span>
              </div>
            </div>
          </div>

          {/* Safety Guarantee */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block">File Asli di Google Drive Tetap Aman</span>
              <span className="text-emerald-700 leading-normal">
                Penghapusan hanya berlaku pada data & metadata di aplikasi. File lagu asli di Google Drive Anda tidak akan terhapus atau dipindahkan.
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            id="btn-confirm-reset-all-data"
            type="button"
            onClick={onConfirmReset}
            disabled={isResetting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mereset Seluruh Data...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Ya, Reset Seluruh Data Aplikasi (0 Data)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
