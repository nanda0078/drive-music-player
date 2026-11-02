import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  ShieldCheck,
  FolderPlus,
  Folder,
  Music,
  Image as ImageIcon,
  Layers,
  Sparkles,
  Check,
  X,
  Sliders,
} from "lucide-react";
import { SelectedUploadFile } from "../types/music";
import {
  extractAudioMetadata,
  formatDuration,
  formatFileSize,
} from "../services/audioMetadata";
import { processCoverImage, isValidImageFile } from "../services/imageUtils";

interface UploadViewProps {
  onUploadBatch: (
    files: SelectedUploadFile[],
    updateFileStatus: (
      id: string,
      status: SelectedUploadFile["status"],
      progress: number,
      errorMsg?: string,
      driveId?: string
    ) => void,
    folderName?: string
  ) => Promise<void>;
  isUploading: boolean;
  hasGoogleAuth: boolean;
  onConnectGoogle: () => void;
}

const SUPPORTED_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"];
const ACCEPT_STRING =
  "audio/mp3,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/flac,.mp3,.m4a,.aac,.wav,.ogg,.flac";
const IMAGE_ACCEPT_STRING = "image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp";

type UploadMode = "files" | "folder";
type CoverApplyMode = "all" | "individual";

interface BatchCoverState {
  dataUrl?: string;
  blobUrl?: string;
  blob?: Blob;
  name?: string;
}

export const UploadView: React.FC<UploadViewProps> = ({
  onUploadBatch,
  isUploading,
  hasGoogleAuth,
  onConnectGoogle,
}) => {
  const [uploadMode, setUploadMode] = useState<UploadMode>("files");
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([]);
  const [detectedFolderName, setDetectedFolderName] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsingMetadata, setIsParsingMetadata] = useState<boolean>(false);
  const [isProcessingCover, setIsProcessingCover] = useState<boolean>(false);

  // Cover Album State
  const [coverApplyMode, setCoverApplyMode] = useState<CoverApplyMode>("all");
  const [batchCover, setBatchCover] = useState<BatchCoverState | null>(null);
  const [targetSingleCoverTrackId, setTargetSingleCoverTrackId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const batchCoverInputRef = useRef<HTMLInputElement | null>(null);
  const singleCoverInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (fileList: FileList | null, isFromFolder: boolean = false) => {
    if (!fileList || fileList.length === 0) return;

    setIsParsingMetadata(true);
    const newItems: SelectedUploadFile[] = [];
    let detectedFolder = detectedFolderName;
    let firstExtractedCover: BatchCoverState | null = null;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;

      // Check format support
      if (!SUPPORTED_EXTENSIONS.includes(extension) && !file.type.startsWith("audio/")) {
        continue;
      }

      // Check duplicate in current selected list
      if (selectedFiles.some((f) => f.file.name === file.name && f.file.size === file.size)) {
        continue;
      }

      // Detect folder name if uploaded via webkitdirectory
      const relativePath = (file as any).webkitRelativePath || "";
      if (relativePath && (!detectedFolder || isFromFolder)) {
        const parts = relativePath.split("/");
        if (parts.length > 1) {
          detectedFolder = parts[0];
        }
      }

      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      try {
        const metadata = await extractAudioMetadata(file);
        const hasEmbedded = !!(metadata.artworkBlobUrl || metadata.artworkDataUrl);

        if (hasEmbedded && !firstExtractedCover) {
          firstExtractedCover = {
            blobUrl: metadata.artworkBlobUrl,
            dataUrl: metadata.artworkDataUrl,
            blob: metadata.coverBlob,
            name: `${metadata.title} (Embedded)`,
          };
        }

        newItems.push({
          id,
          file,
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          year: metadata.year,
          genre: metadata.genre,
          duration: metadata.duration,
          artworkDataUrl: metadata.artworkDataUrl,
          artworkBlobUrl: metadata.artworkBlobUrl,
          coverBlob: metadata.coverBlob,
          coverSource: hasEmbedded ? "embedded" : "none",
          size: file.size,
          format: metadata.format,
          status: "Menunggu",
          progress: 0,
          relativePath,
        });
      } catch (err) {
        console.warn("Failed extracting metadata for", file.name, err);
        newItems.push({
          id,
          file,
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Artis Tidak Diketahui",
          album: "Single",
          duration: 0,
          coverSource: "none",
          size: file.size,
          format: extension.replace(".", "").toUpperCase(),
          status: "Menunggu",
          progress: 0,
          relativePath,
        });
      }
    }

    if (isFromFolder && detectedFolder) {
      setDetectedFolderName(detectedFolder);
      setUploadMode("folder");
    }

    // If batch cover is explicitly set by user in "all" mode, apply it
    let updatedNewItems = newItems;
    if (batchCover && coverApplyMode === "all") {
      updatedNewItems = newItems.map((item) => ({
        ...item,
        artworkBlobUrl: batchCover.blobUrl,
        artworkDataUrl: batchCover.dataUrl,
        coverBlob: batchCover.blob,
        coverSource: "manual",
      }));
    } else {
      // If multiple songs have embedded covers, default to individual mode so each song keeps its own cover
      const hasAnyEmbedded = newItems.some((item) => item.coverSource === "embedded");
      if (hasAnyEmbedded && !batchCover) {
        setCoverApplyMode("individual");
      }
    }

    setSelectedFiles((prev) => [...prev, ...updatedNewItems]);
    setIsParsingMetadata(false);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  // Handle Manual Batch Cover Selection (Applies to all songs)
  const handleBatchCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      alert("Format gambar tidak didukung. Silakan gunakan format JPG, JPEG, PNG, atau WebP.");
      return;
    }

    try {
      setIsProcessingCover(true);
      // Auto-crop to 1:1 square & compress to 512x512 JPEG
      const processed = await processCoverImage(file, 512, 0.82);

      const newBatchCover: BatchCoverState = {
        dataUrl: processed.dataUrl,
        blobUrl: processed.blobUrl,
        blob: processed.blob,
        name: file.name,
      };

      setBatchCover(newBatchCover);

      // Apply to all selected files if in "all" mode
      setSelectedFiles((prev) =>
        prev.map((item) => ({
          ...item,
          artworkBlobUrl: processed.blobUrl,
          artworkDataUrl: processed.dataUrl,
          coverBlob: processed.blob,
          coverSource: "manual",
        }))
      );
    } catch (err) {
      console.error("Error processing cover image:", err);
      alert("Gagal memproses gambar cover album.");
    } finally {
      setIsProcessingCover(false);
      if (batchCoverInputRef.current) batchCoverInputRef.current.value = "";
    }
  };

  // Handle Removing Batch Cover
  const handleRemoveBatchCover = () => {
    setBatchCover(null);
    // Remove cover from all tracks
    setSelectedFiles((prev) =>
      prev.map((item) => ({
        ...item,
        artworkBlobUrl: undefined,
        artworkDataUrl: undefined,
        coverBlob: undefined,
        coverSource: "none",
      }))
    );
  };

  // Handle Single Track Cover Selection
  const handleSingleTrackCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const trackId = targetSingleCoverTrackId;
    if (!file || !trackId) return;

    if (!isValidImageFile(file)) {
      alert("Format gambar tidak didukung. Silakan gunakan format JPG, JPEG, PNG, atau WebP.");
      return;
    }

    try {
      setIsProcessingCover(true);
      const processed = await processCoverImage(file, 512, 0.82);

      setSelectedFiles((prev) =>
        prev.map((item) =>
          item.id === trackId
            ? {
                ...item,
                artworkBlobUrl: processed.blobUrl,
                artworkDataUrl: processed.dataUrl,
                coverBlob: processed.blob,
                coverSource: "manual",
              }
            : item
        )
      );
    } catch (err) {
      console.error("Error processing single cover image:", err);
      alert("Gagal memproses gambar cover.");
    } finally {
      setIsProcessingCover(false);
      setTargetSingleCoverTrackId(null);
      if (singleCoverInputRef.current) singleCoverInputRef.current.value = "";
    }
  };

  // Remove cover from a specific track
  const handleRemoveSingleTrackCover = (trackId: string) => {
    setSelectedFiles((prev) =>
      prev.map((item) =>
        item.id === trackId
          ? {
              ...item,
              artworkBlobUrl: undefined,
              artworkDataUrl: undefined,
              coverBlob: undefined,
              coverSource: "none",
            }
          : item
      )
    );
  };

  // Switch Cover Mode ("all" vs "individual")
  const handleSwitchCoverMode = (mode: CoverApplyMode) => {
    setCoverApplyMode(mode);
    if (mode === "all" && batchCover) {
      // Re-apply batch cover to all tracks
      setSelectedFiles((prev) =>
        prev.map((item) => ({
          ...item,
          artworkBlobUrl: batchCover.blobUrl,
          artworkDataUrl: batchCover.dataUrl,
          coverBlob: batchCover.blob,
          coverSource: "manual",
        }))
      );
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setDetectedFolderName("");
    setBatchCover(null);
  };

  const updateFileStatus = (
    id: string,
    status: SelectedUploadFile["status"],
    progress: number,
    errorMsg?: string,
    driveId?: string
  ) => {
    setSelectedFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status,
              progress,
              errorMessage: errorMsg,
              driveFileId: driveId || f.driveFileId,
            }
          : f
      )
    );
  };

  const handleStartUpload = async () => {
    if (!hasGoogleAuth) {
      onConnectGoogle();
      return;
    }

    const pendingFiles = selectedFiles.filter(
      (f) => f.status === "Menunggu" || f.status === "Gagal"
    );
    if (pendingFiles.length === 0) return;

    const targetFolder =
      uploadMode === "folder" && detectedFolderName.trim()
        ? detectedFolderName.trim()
        : undefined;

    await onUploadBatch(pendingFiles, updateFileStatus, targetFolder);
  };

  const handleRetrySingle = async (fileItem: SelectedUploadFile) => {
    if (!hasGoogleAuth) {
      onConnectGoogle();
      return;
    }
    updateFileStatus(fileItem.id, "Menunggu", 0);
    const targetFolder =
      uploadMode === "folder" && detectedFolderName.trim()
        ? detectedFolderName.trim()
        : undefined;
    await onUploadBatch([fileItem], updateFileStatus, targetFolder);
  };

  const pendingCount = selectedFiles.filter(
    (f) => f.status === "Menunggu" || f.status === "Gagal"
  ).length;
  const successCount = selectedFiles.filter((f) => f.status === "Berhasil").length;

  return (
    <div id="upload-view" className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          Upload Musik ke Google Drive
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Pilih file lagu satuan atau satu <strong>folder musik sekaligus</strong>. Anda dapat menyertakan{" "}
          <strong>Cover Album (1:1)</strong> yang otomatis terbaca dari metadata atau dipilih manual.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-fit">
        <button
          id="tab-upload-files"
          type="button"
          onClick={() => setUploadMode("files")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            uploadMode === "files"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Upload File Satuan</span>
        </button>

        <button
          id="tab-upload-folder"
          type="button"
          onClick={() => setUploadMode("folder")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            uploadMode === "folder"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>Upload Folder Musik</span>
        </button>
      </div>

      {/* Google Auth Warning Banner if disconnected */}
      {!hasGoogleAuth && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold leading-tight">Akun Google Belum Terhubung</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Hubungkan akun Google Drive Anda sekali untuk memberikan izin penyimpanan musik dan cover.
              </p>
            </div>
          </div>
          <button
            onClick={onConnectGoogle}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Hubungkan Akun Google
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      {/* File input (multi-file) */}
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        multiple
        accept={ACCEPT_STRING}
        onChange={(e) => handleFilesSelected(e.target.files, false)}
        className="hidden"
      />

      {/* Folder input (webkitdirectory) */}
      <input
        ref={folderInputRef}
        id="folder-input"
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files, true)}
        className="hidden"
      />

      {/* Batch Cover image input */}
      <input
        ref={batchCoverInputRef}
        id="batch-cover-input"
        type="file"
        accept={IMAGE_ACCEPT_STRING}
        onChange={handleBatchCoverSelected}
        className="hidden"
      />

      {/* Single track cover image input */}
      <input
        ref={singleCoverInputRef}
        id="single-cover-input"
        type="file"
        accept={IMAGE_ACCEPT_STRING}
        onChange={handleSingleTrackCoverSelected}
        className="hidden"
      />

      {/* Upload Zone */}
      {uploadMode === "files" ? (
        /* File Mode Drop Zone */
        <div
          id="drop-zone-files"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all bg-white cursor-pointer ${
            isDragging
              ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-800">
            Tarik dan Lepaskan File Musik ke Sini
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Atau klik area ini untuk memilih file musik dari perangkat Anda. Metadata dan cover art otomatis terdeteksi.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">MP3</span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">M4A</span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">AAC</span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">WAV</span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">OGG</span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">FLAC</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Pilih File Musik</span>
          </button>
        </div>
      ) : (
        /* Folder Mode Zone */
        <div
          id="drop-zone-folder"
          className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/20 hover:bg-blue-50/40 rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer"
          onClick={() => folderInputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-500/20">
            <FolderPlus className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-800">
            Pilih Satu Folder Musik dari Perangkat
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Sistem akan mempertahankan <strong>nama folder asli</strong>, membaca cover artwork dari setiap lagu, dan mengunggahnya secara terstruktur ke Google Drive.
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Pilih Folder Musik</span>
          </button>
        </div>
      )}

      {/* Parsing metadata loader */}
      {isParsingMetadata && (
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-center gap-2 text-blue-700 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Membaca metadata musik (ID3 tags, durasi, cover art embedded)...</span>
        </div>
      )}

      {/* Cover Processing loader */}
      {isProcessingCover && (
        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center gap-2 text-indigo-700 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Memproses cover album (crop 1:1 persegi & kompresi)...</span>
        </div>
      )}

      {/* COVER ALBUM MANAGEMENT SECTION (Visible when files are selected) */}
      {selectedFiles.length > 0 && (
        <div
          id="section-cover-album"
          className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base leading-tight flex items-center gap-2">
                  <span>Cover Album</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Rasio 1:1 Persegi
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan cover album untuk ditampilkan di Player, Library, Playlist, dan Lock Screen.
                </p>
              </div>
            </div>

            {/* Mode Toggle: 1 Cover for all VS Cover per song (if > 1 file) */}
            {selectedFiles.length > 1 && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleSwitchCoverMode("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    coverApplyMode === "all"
                      ? "bg-white text-indigo-600 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Gunakan 1 gambar cover untuk semua lagu dalam antrean"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>1 Cover Semua Lagu</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchCoverMode("individual")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    coverApplyMode === "individual"
                      ? "bg-white text-indigo-600 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Atur cover untuk masing-masing lagu secara terpisah"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Atur Masing-Masing</span>
                </button>
              </div>
            )}
          </div>

          {/* If Mode is "all" -> Show Batch Cover Management Box */}
          {coverApplyMode === "all" ? (
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-col md:flex-row items-center gap-5">
              {/* 1:1 Preview Box */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-slate-200 shrink-0 border-2 border-indigo-200/80 shadow-md flex items-center justify-center group">
                {batchCover?.blobUrl || batchCover?.dataUrl ? (
                  <>
                    <img
                      src={batchCover.blobUrl || batchCover.dataUrl}
                      alt="Preview Cover Album"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => batchCoverInputRef.current?.click()}
                        className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                        title="Ganti Cover"
                      >
                        Ganti
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-1 text-slate-300" />
                    <span className="text-[11px] font-medium leading-tight">
                      Belum ada cover album
                    </span>
                  </div>
                )}
              </div>

              {/* Cover Details & Action Buttons */}
              <div className="flex-1 min-w-0 space-y-2.5 text-center md:text-left">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-800">
                      {batchCover ? "Cover Album Terpilih" : "Pilih Gambar Cover Album"}
                    </h4>
                    {batchCover ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <Check className="w-3 h-3" />
                        Aktif untuk {selectedFiles.length} lagu
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                        Gunakan Placeholder Default jika kosong
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {batchCover
                      ? "Gambar ini telah di-crop 1:1 dan dikompres secara otomatis untuk kualitas optimal di seluruh player."
                      : "Dukungan format: JPG, JPEG, PNG, WebP. Gambar non-persegi akan di-crop otomatis ke 1:1 tanpa merusak file asli."}
                  </p>
                </div>

                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => batchCoverInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{batchCover ? "Ganti Cover Album" : "Pilih Cover Album"}</span>
                  </button>

                  {batchCover && (
                    <button
                      type="button"
                      onClick={handleRemoveBatchCover}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Cover</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Mode "individual" Notice */
            <div className="bg-indigo-50/60 rounded-2xl p-3.5 border border-indigo-100 flex items-center justify-between gap-3 text-xs text-indigo-900">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Mode <strong>Atur Masing-Masing</strong> aktif. Anda dapat mengganti atau menghapus cover untuk setiap lagu pada daftar di bawah.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Files List & Controls */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          {/* Target Folder Banner (if in folder mode or folder detected) */}
          {detectedFolderName && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Target Folder Google Drive
                    </span>
                  </div>
                  <input
                    type="text"
                    value={detectedFolderName}
                    onChange={(e) => setDetectedFolderName(e.target.value)}
                    className="mt-0.5 text-sm font-bold text-slate-800 bg-white border border-blue-200 rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Nama Folder Musik"
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-blue-700 px-3 py-1 bg-white rounded-xl border border-blue-100 shrink-0 self-start sm:self-auto">
                {selectedFiles.length} Lagu di dalam folder
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>Daftar File Dipilih</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {selectedFiles.length} File
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {successCount} Berhasil diunggah • {pendingCount} Menunggu
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isUploading && selectedFiles.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  Hapus Semua
                </button>
              )}

              <button
                id="btn-upload-all"
                disabled={isUploading || pendingCount === 0}
                onClick={handleStartUpload}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sedang Mengunggah...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      Upload Semua ({pendingCount})
                      {detectedFolderName ? ` ke "${detectedFolderName}"` : ""}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
            {selectedFiles.map((item) => {
              const hasCover = !!(item.artworkBlobUrl || item.artworkDataUrl);
              return (
                <div
                  key={item.id}
                  id={`upload-item-${item.id}`}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50/60 rounded-xl px-2 transition-colors"
                >
                  {/* Info & Cover Artwork */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 1:1 Artwork Box */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 shadow-2xs flex items-center justify-center group/art">
                      {hasCover ? (
                        <img
                          src={item.artworkBlobUrl || item.artworkDataUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileAudio className="w-6 h-6 text-blue-500" />
                      )}

                      {/* Hover action for individual mode */}
                      {coverApplyMode === "individual" && !isUploading && (
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetSingleCoverTrackId(item.id);
                              singleCoverInputRef.current?.click();
                            }}
                            className="p-1 bg-white text-slate-800 rounded-md text-[10px] font-bold"
                            title="Ganti Cover Lagu Ini"
                          >
                            Edit
                          </button>
                          {hasCover && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSingleTrackCover(item.id)}
                              className="p-1 bg-rose-600 text-white rounded-md text-[10px]"
                              title="Hapus Cover Lagu Ini"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-800 truncate leading-tight">
                          {item.title}
                        </h4>
                        {/* Cover Badge */}
                        {item.coverSource === "embedded" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80 shrink-0">
                            Cover Tertanam (Embedded)
                          </span>
                        ) : item.coverSource === "manual" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Cover Manual
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                            Cover Default
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-700">{item.artist}</span>
                        {item.album && item.album !== "Single" && (
                          <>
                            <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-slate-600 truncate">{item.album}</span>
                          </>
                        )}
                        {item.year && (
                          <>
                            <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-slate-500">{item.year}</span>
                          </>
                        )}
                        {item.genre && (
                          <>
                            <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-indigo-600 font-medium">{item.genre}</span>
                          </>
                        )}
                        <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{formatFileSize(item.size)}</span>
                        {item.duration > 0 && (
                          <>
                            <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                            <span>{formatDuration(item.duration)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Individual Cover Change Button (visible on mobile / tablet in individual mode) */}
                  {coverApplyMode === "individual" && !isUploading && (
                    <div className="flex sm:hidden items-center gap-2 pl-15">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetSingleCoverTrackId(item.id);
                          singleCoverInputRef.current?.click();
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 bg-indigo-50 rounded-lg"
                      >
                        {hasCover ? "Ganti Cover" : "+ Pilih Cover"}
                      </button>
                      {hasCover && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSingleTrackCover(item.id)}
                          className="text-[11px] font-medium text-rose-500 hover:text-rose-600 px-2 py-1 bg-rose-50 rounded-lg"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  )}

                  {/* Status & Progress */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {item.status === "Menunggu" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Menunggu</span>
                        </span>
                      )}

                      {item.status === "Mengunggah" && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 sm:w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-150"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-blue-600 w-8 text-right">
                            {item.progress}%
                          </span>
                        </div>
                      )}

                      {item.status === "Berhasil" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-xl text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Berhasil</span>
                        </span>
                      )}

                      {item.status === "Gagal" && (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-xl text-xs font-semibold"
                            title={item.errorMessage}
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Gagal</span>
                          </span>
                          <button
                            onClick={() => handleRetrySingle(item)}
                            disabled={isUploading}
                            className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Coba Lagi"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Remove Button if not uploading */}
                    {!isUploading && item.status !== "Mengunggah" && (
                      <button
                        onClick={() => handleRemoveFile(item.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus dari daftar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
