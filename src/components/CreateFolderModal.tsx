import React, { useState, useEffect } from "react";
import { FolderPlus, X, Loader2, AlertCircle } from "lucide-react";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFolderNames: string[];
  currentParentName?: string;
  onCreateFolder: (folderName: string) => Promise<void>;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  existingFolderNames,
  currentParentName,
  onCreateFolder,
}) => {
  const [folderName, setFolderName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      setErrorMessage("Nama folder wajib diisi.");
      return;
    }

    // Check duplicate folder name in same location
    const isDuplicate = existingFolderNames.some(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setErrorMessage(`Folder dengan nama "${trimmed}" sudah tersedia di lokasi ini.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onCreateFolder(trimmed);
      onClose();
    } catch (err: any) {
      console.error("Create folder modal error:", err);
      setErrorMessage(err?.message || "Gagal membuat folder di Google Drive.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="create-folder-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-folder-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-folder-modal-title" className="font-bold text-slate-800 text-base">
                Buat Folder Baru
              </h3>
              <p className="text-xs text-slate-500">
                {currentParentName
                  ? `Folder akan dibuat di dalam "${currentParentName}" di Google Drive`
                  : "Folder akan dibuat dan disinkronkan langsung ke Google Drive"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup"
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
              htmlFor="create-folder-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Nama Folder
            </label>
            <input
              id="create-folder-input"
              type="text"
              required
              autoFocus
              disabled={isSubmitting}
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Contoh: Lagu Jazz, Chill Beats, Album 2026"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Folder akan langsung tersinkronisasi dan dapat digunakan untuk upload musik.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Membuat Folder...</span>
                </>
              ) : (
                <span>Buat Folder</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
