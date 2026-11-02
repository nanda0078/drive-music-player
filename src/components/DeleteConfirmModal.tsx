import React, { useState } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { MusicTrack } from "../types/music";

interface DeleteConfirmModalProps {
  track: MusicTrack | null;
  onClose: () => void;
  onConfirmDelete: (track: MusicTrack) => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  track,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!track) return null;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirmDelete(track);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="delete-confirm-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="delete-confirm-modal-content"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 overflow-hidden animate-in zoom-in-95 duration-150 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <Trash2 className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-snug">
          Hapus Musik
        </h3>

        <p className="text-sm text-slate-600 mt-2">
          Apakah Anda yakin ingin menghapus{" "}
          <strong className="text-slate-900">“{track.title}”</strong>?
        </p>

        <p className="text-xs text-slate-400 mt-1">
          File di Google Drive akan dipindahkan ke Trash (Sampah) dan dihapus dari Library serta semua playlist Anda.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            id="btn-cancel-delete"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
          >
            Batal
          </button>

          <button
            id="btn-confirm-delete"
            disabled={isDeleting}
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <span>Ya, Hapus</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
