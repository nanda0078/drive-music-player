import React, { useState, useEffect, useRef } from "react";
import { X, Edit2, Image as ImageIcon, Trash2, Check, Music, Loader2, RefreshCw } from "lucide-react";
import { MusicTrack } from "../types/music";
import { processCoverImage, isValidImageFile } from "../services/imageUtils";

interface EditMetadataModalProps {
  track: MusicTrack | null;
  onClose: () => void;
  onSaveMetadata: (
    trackId: string,
    updates: {
      title: string;
      artist: string;
      album?: string;
      year?: number;
      genre?: string;
      artworkUrl?: string | null;
      coverFileId?: string | null;
      coverSource?: "embedded" | "manual" | "none";
      coverBlob?: Blob | null;
    }
  ) => Promise<void>;
}

export const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  track,
  onClose,
  onSaveMetadata,
}) => {
  const [title, setTitle] = useState<string>("");
  const [artist, setArtist] = useState<string>("");
  const [album, setAlbum] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [genre, setGenre] = useState<string>("");
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverSource, setCoverSource] = useState<"embedded" | "manual" | "none">("none");
  const [coverFileId, setCoverFileId] = useState<string | null>(null);
  const [isProcessingCover, setIsProcessingCover] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (track) {
      setTitle(track.title || "");
      setArtist(track.artist || "");
      setAlbum(track.album || "");
      setYear(track.year ? String(track.year) : "");
      setGenre(track.genre || "");
      setArtworkUrl(track.artworkUrl || null);
      setCoverBlob(null);
      setCoverSource(track.coverSource || (track.artworkUrl ? "manual" : "none"));
      setCoverFileId(track.coverFileId || null);
    }
  }, [track]);

  if (!track) return null;

  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      alert("Format gambar tidak didukung. Silakan pilih format JPG, JPEG, PNG, atau WebP.");
      return;
    }

    try {
      setIsProcessingCover(true);
      // Auto crop 1:1 & resize/compress
      const processed = await processCoverImage(file, 512, 0.82);
      setArtworkUrl(processed.dataUrl);
      setCoverBlob(processed.blob);
      setCoverSource("manual");
    } catch (err) {
      console.error("Gagal memproses gambar cover:", err);
      alert("Gagal memproses gambar cover. Silakan gunakan gambar lain.");
    } finally {
      setIsProcessingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveCover = () => {
    setArtworkUrl(null);
    setCoverBlob(null);
    setCoverSource("none");
    setCoverFileId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    try {
      setIsSaving(true);
      const parsedYear = year.trim() ? parseInt(year.trim(), 10) : undefined;
      await onSaveMetadata(track.id, {
        title: title.trim(),
        artist: artist.trim() || "Artis Tidak Diketahui",
        album: album.trim() || undefined,
        year: !isNaN(parsedYear as number) ? parsedYear : undefined,
        genre: genre.trim() || undefined,
        artworkUrl,
        coverFileId,
        coverSource,
        coverBlob,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="edit-metadata-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="edit-metadata-modal-content"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Edit2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                Edit Metadata & Cover Lagu
              </h3>
              <p className="text-xs text-slate-500 truncate">{track.fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input for Cover */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp"
          onChange={handleCoverSelected}
          className="hidden"
        />

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Cover Album Section */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>Cover Album (Rasio 1:1 Persegi)</span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* 1:1 Preview Box */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-200 shrink-0 border-2 border-indigo-200/80 shadow-xs flex items-center justify-center group">
                {isProcessingCover ? (
                  <div className="flex flex-col items-center justify-center p-2 text-indigo-600">
                    <Loader2 className="w-6 h-6 animate-spin mb-1" />
                    <span className="text-[10px] font-semibold">Memproses...</span>
                  </div>
                ) : artworkUrl ? (
                  <>
                    <img
                      src={artworkUrl}
                      alt="Cover Album Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-white text-slate-800 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Ganti
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-2 text-white font-bold text-xs"
                    style={{
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    }}
                  >
                    <Music className="w-8 h-8 text-white/80 mb-1" />
                    <span className="text-[10px] text-white/90">Default</span>
                  </div>
                )}
              </div>

              {/* Cover Controls */}
              <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800">
                    {artworkUrl ? "Cover Album Terpasang" : "Belum Ada Cover Khusus"}
                  </span>
                  {artworkUrl && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tersedia
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih gambar format JPG, PNG, atau WebP. Gambar akan di-crop otomatis ke rasio 1:1 persegi tanpa merusak file musik.
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingCover}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{artworkUrl ? "Ganti Cover Album" : "Pilih Cover Album"}</span>
                  </button>

                  {artworkUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      disabled={isProcessingCover}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Cover</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Text fields */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Lagu <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Artis / Penyanyi
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artis Tidak Diketahui"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Album
            </label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="Single / Album"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tahun Rilis
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="misal: 2024"
                min="1900"
                max="2100"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Genre Musik
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="misal: Pop, R&B, Rock"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
