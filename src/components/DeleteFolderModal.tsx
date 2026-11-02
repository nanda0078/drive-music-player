import React, { useState } from "react";
import { FolderX, X, AlertTriangle, Loader2 } from "lucide-react";
import { MusicFolder } from "../types/music";

interface DeleteFolderModalProps {
  folder: MusicFolder | null;
  onClose: () => void;
  onConfirmDelete: (folder: MusicFolder, deleteFromDrive: boolean) => Promise<void>;
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  folder,
  onClose,
  onConfirmDelete,
}) => {
  const [deleteFromDrive, setDeleteFromDrive] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!folder) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirmDelete(folder, deleteFromDrive);
      onClose();
    } catch (err) {
      console.error("Delete folder error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="delete-folder-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-folder-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <FolderX className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-folder-modal-title" className="font-bold text-slate-800 text-base">
                Hapus Folder Musik
              </h3>
              <p className="text-xs text-slate-500">Konfirmasi penghapusan folder dari Library</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
              <FolderX className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate">{folder.name}</p>
              <p className="text-xs text-slate-500">Folder Musik Google Drive</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-amber-800 bg-amber-50/80 p-3 rounded-xl border border-amber-200 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Menghapus folder dari Library tidak akan menghapus file musik asli di Google Drive kecuali opsi di bawah dicentang.
            </span>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 select-none">
            <input
              type="checkbox"
              checked={deleteFromDrive}
              onChange={(e) => setDeleteFromDrive(e.target.checked)}
              className="rounded-md border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span>Pindahkan juga folder ke Tempat Sampah Google Drive</span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <span>Hapus Folder</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
