import React, { useState } from "react";
import {
  X,
  Folder,
  FolderPlus,
  FolderInput,
  Check,
  Loader2,
  HardDrive,
  ShieldCheck,
  Search,
  ArrowRight,
} from "lucide-react";
import { MusicTrack, MusicFolder } from "../types/music";

interface MoveToFolderModalProps {
  track: MusicTrack | null;
  folders: MusicFolder[];
  isOpen: boolean;
  onClose: () => void;
  onMoveToFolder: (
    track: MusicTrack,
    targetFolder: MusicFolder | null,
    newFolderName?: string
  ) => Promise<void>;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  track,
  folders,
  isOpen,
  onClose,
  onMoveToFolder,
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen || !track) return null;

  // Determine current folder of the track
  const currentFolder = folders.find(
    (f) =>
      f.driveFolderId === track.driveFolderId ||
      (track.folderName && f.name.toLowerCase() === track.folderName.toLowerCase())
  );
  const isCurrentlyInRoot = !track.driveFolderId && !track.folderName;

  const handleSelectFolder = async (folder: MusicFolder | null) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onMoveToFolder(track, folder);
      onClose();
    } catch (err) {
      console.error("Move folder error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAndMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onMoveToFolder(track, null, newFolderName.trim());
      setNewFolderName("");
      setIsCreatingNew(false);
      onClose();
    } catch (err) {
      console.error("Create and move error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter folders by search query
  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div
      id="move-to-folder-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        id="move-to-folder-modal-content"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
            <h4 className="text-base font-bold text-slate-800">
              Memindahkan File & Menyinkronkan...
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              Memperbarui lokasi file di Google Drive dan menyinkronkan metadata lagu di aplikasi.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Pindahkan ke Folder
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-[240px] sm:max-w-[300px]">
                "{track.title}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[68vh] overflow-y-auto">
          {/* Current Location Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 min-w-0">
              <span className="font-medium text-slate-400 shrink-0">Lokasi Saat Ini:</span>
              <span className="font-bold text-slate-800 truncate flex items-center gap-1">
                {currentFolder ? (
                  <>
                    <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{currentFolder.name}</span>
                  </>
                ) : track.folderName ? (
                  <>
                    <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{track.folderName}</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Folder Utama (Root / Tanpa Folder)</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Create New Folder Inline Option */}
          {isCreatingNew ? (
            <form
              onSubmit={handleCreateAndMoveSubmit}
              className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-blue-600" />
                  <span>Buat Folder Baru di Google Drive & Pindahkan</span>
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Nama folder baru (contoh: Jazz, Rock, Favorit)..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-blue-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                autoFocus
                required
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200/60 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newFolderName.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Buat & Pindahkan</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="w-full p-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 hover:bg-blue-50/80 text-blue-700 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Buat Folder Baru & Pindahkan Lagu</span>
            </button>
          )}

          {/* Search bar if many folders */}
          {folders.length > 4 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Cari folder tujuan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          )}

          {/* List of Destination Options */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Pilih Folder Tujuan:
            </p>

            {/* Option 1: Root / Main App Folder (Drive Music Player) */}
            <button
              type="button"
              disabled={isCurrentlyInRoot || isSubmitting}
              onClick={() => handleSelectFolder(null)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                isCurrentlyInRoot
                  ? "bg-slate-50 border-slate-200/80 text-slate-400 cursor-not-allowed"
                  : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-800 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCurrentlyInRoot
                      ? "bg-slate-100 text-slate-400"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold truncate leading-tight">
                    Folder Utama (Root)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Drive Music Player / Tanpa Subfolder
                  </p>
                </div>
              </div>

              {isCurrentlyInRoot && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                  <Check className="w-3 h-3" /> Lokasi Saat Ini
                </span>
              )}
            </button>

            {/* Option 2..N: Music Folders */}
            {filteredFolders.length === 0 && searchQuery ? (
              <div className="text-center py-5 text-slate-400 text-xs">
                Tidak ada folder yang cocok dengan "{searchQuery}"
              </div>
            ) : (
              filteredFolders.map((folder) => {
                const isCurrent =
                  currentFolder?.id === folder.id ||
                  (track.folderName &&
                    folder.name.toLowerCase() === track.folderName.toLowerCase());

                return (
                  <button
                    key={folder.id}
                    type="button"
                    disabled={isCurrent || isSubmitting}
                    onClick={() => handleSelectFolder(folder)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-slate-50 border-slate-200/80 text-slate-400 cursor-not-allowed"
                        : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-800 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? "bg-slate-100 text-slate-400"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        <Folder className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold truncate leading-tight">
                          {folder.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {folder.songCount !== undefined
                            ? `${folder.songCount} Lagu`
                            : "Folder Musik Google Drive"}
                        </p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        <Check className="w-3 h-3" /> Lokasi Saat Ini
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Pindahkan →
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Sync Guarantee Notice */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-800 block">
                Sinkronisasi Aman & Tanpa Duplikasi:
              </span>
              <span>
                File dipindahkan secara langsung di Google Drive tanpa membuat duplikat. Playlist yang sudah memuat lagu ini tetap berfungsi normal.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
