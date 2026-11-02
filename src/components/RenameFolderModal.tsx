import React, { useState, useEffect } from "react";
import { FolderEdit, X, Loader2, AlertCircle } from "lucide-react";
import { MusicFolder } from "../types/music";

interface RenameFolderModalProps {
  isOpen: boolean;
  folder: MusicFolder | null;
  onClose: () => void;
  onRename: (folder: MusicFolder, newName: string) => Promise<void>;
}

export const RenameFolderModal: React.FC<RenameFolderModalProps> = ({
  isOpen,
  folder,
  onClose,
  onRename,
}) => {
  const [folderName, setFolderName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (folder) {
      setFolderName(folder.name);
      setErrorMessage(null);
    }
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      setErrorMessage("Nama folder tidak boleh kosong.");
      return;
    }

    if (trimmed === folder.name) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onRename(folder, trimmed);
      onClose();
    } catch (err: any) {
      console.error("Rename folder modal error:", err);
      setErrorMessage(err?.message || "Gagal mengubah nama folder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="rename-folder-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-folder-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FolderEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 id="rename-folder-modal-title" className="font-bold text-slate-800 text-base">
                Rename Folder Musik
              </h3>
              <p className="text-xs text-slate-500">
                Nama folder di Google Drive & Library akan ikut diperbarui
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="rename-folder-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Nama Folder Baru
            </label>
            <input
              id="rename-folder-input"
              type="text"
              required
              autoFocus
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Contoh: Lagu Santai"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Folder ID di Google Drive tetap sama sehingga lagu tidak perlu diunggah ulang.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan ke Drive...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
