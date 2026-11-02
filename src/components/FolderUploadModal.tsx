import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Folder,
  X,
  Music,
} from "lucide-react";
import { MusicFolder } from "../types/music";
import { extractAudioMetadata, formatDuration, formatFileSize } from "../services/audioMetadata";

export interface FolderUploadItem {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkDataUrl?: string;
  coverBlob?: Blob;
  status: "Menunggu" | "Mengunggah" | "Berhasil" | "Gagal";
  progress: number;
  error?: string;
}

interface FolderUploadModalProps {
  isOpen: boolean;
  folder: MusicFolder | null;
  files: File[];
  onClose: () => void;
  onExecuteUpload: (
    folder: MusicFolder,
    items: FolderUploadItem[],
    updateItemStatus: (
      id: string,
      status: FolderUploadItem["status"],
      progress: number,
      error?: string
    ) => void
  ) => Promise<void>;
}

export const FolderUploadModal: React.FC<FolderUploadModalProps> = ({
  isOpen,
  folder,
  files,
  onClose,
  onExecuteUpload,
}) => {
  const [items, setItems] = useState<FolderUploadItem[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Parse files whenever modal opens with new files
  useEffect(() => {
    if (!isOpen || !folder || files.length === 0) {
      setItems([]);
      setIsUploading(false);
      setIsCompleted(false);
      return;
    }

    let isCancelled = false;
    const parseAll = async () => {
      setIsParsing(true);
      const parsedItems: FolderUploadItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        try {
          const meta = await extractAudioMetadata(file);
          if (isCancelled) return;
          parsedItems.push({
            id,
            file,
            title: meta.title || file.name.replace(/\.[^/.]+$/, ""),
            artist: meta.artist || "Artis Tidak Diketahui",
            album: meta.album && meta.album !== "Single" ? meta.album : folder.name,
            duration: meta.duration || 0,
            artworkDataUrl: meta.artworkDataUrl,
            coverBlob: meta.coverBlob,
            status: "Menunggu",
            progress: 0,
          });
        } catch {
          if (isCancelled) return;
          parsedItems.push({
            id,
            file,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Artis Tidak Diketahui",
            album: folder.name,
            duration: 0,
            status: "Menunggu",
            progress: 0,
          });
        }
      }

      if (!isCancelled) {
        setItems(parsedItems);
        setIsParsing(false);
      }
    };

    parseAll();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, folder, files]);

  if (!isOpen || !folder) return null;

  const updateItemStatus = (
    id: string,
    status: FolderUploadItem["status"],
    progress: number,
    error?: string
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status, progress, error: error || item.error } : item
      )
    );
  };

  const handleStartUpload = async () => {
    if (items.length === 0 || isUploading) return;
    setIsUploading(true);
    try {
      await onExecuteUpload(folder, items, updateItemStatus);
      setIsCompleted(true);
    } catch (err) {
      console.error("[FolderUploadModal] Upload execution error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const completedCount = items.filter((i) => i.status === "Berhasil").length;
  const failedCount = items.filter((i) => i.status === "Gagal").length;
  const inProgressItem = items.find((i) => i.status === "Mengunggah");
  const overallProgress =
    items.length > 0
      ? Math.round(
          items.reduce((sum, item) => sum + item.progress, 0) / items.length
        )
      : 0;

  return (
    <div
      id="folder-upload-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-upload-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="folder-upload-modal-title"
                className="font-bold text-slate-800 text-base leading-tight truncate"
              >
                Upload Musik ke Folder
              </h3>
              <p className="text-xs text-blue-600 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                <Folder className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Progress Indicator (Visible when uploading or completed) */}
        {(isUploading || isCompleted) && (
          <div className="px-5 py-3 bg-blue-50/70 border-b border-blue-100 shrink-0">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-blue-900">
                {isCompleted
                  ? `Selesai: ${completedCount} dari ${items.length} lagu berhasil`
                  : inProgressItem
                  ? `Mengunggah: ${inProgressItem.title}`
                  : "Menyiapkan file..."}
              </span>
              <span className="font-mono font-bold text-blue-700">{overallProgress}%</span>
            </div>
            <div className="w-full h-2 bg-blue-200/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Body List of Files */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
          {isParsing ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium text-slate-600">
                Membaca metadata & ID3 tag file audio...
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Tidak ada file musik yang dipilih.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl transition-all"
              >
                {/* Artwork or generic icon */}
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-500">
                  {item.artworkDataUrl ? (
                    <img
                      src={item.artworkDataUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileAudio className="w-5 h-5 text-blue-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {formatFileSize(item.file.size)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.artist}</p>

                  {/* Progress bar per item if actively uploading */}
                  {item.status === "Mengunggah" && (
                    <div className="mt-1.5 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error banner if failed */}
                  {item.status === "Gagal" && item.error && (
                    <p className="text-[10px] text-rose-600 font-medium truncate mt-1">
                      {item.error}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="shrink-0 pl-1">
                  {item.status === "Menunggu" && (
                    <Clock className="w-4 h-4 text-slate-400" title="Menunggu antrean" />
                  )}
                  {item.status === "Mengunggah" && (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  )}
                  {item.status === "Berhasil" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" title="Berhasil diunggah" />
                  )}
                  {item.status === "Gagal" && (
                    <AlertCircle className="w-4 h-4 text-rose-600" title="Gagal diunggah" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            {items.length} file musik terpilih ({formatFileSize(items.reduce((acc, i) => acc + i.file.size, 0))})
          </p>

          <div className="flex items-center gap-2">
            {!isCompleted ? (
              <>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isUploading || isParsing || items.length === 0}
                  onClick={handleStartUpload}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <span>Mulai Upload</span>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
