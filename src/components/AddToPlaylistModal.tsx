import React, { useState } from "react";
import { X, Plus, ListMusic, Check, Music } from "lucide-react";
import { MusicTrack, Playlist } from "../types/music";

interface AddToPlaylistModalProps {
  track: MusicTrack | null;
  playlists: Playlist[];
  onClose: () => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  onCreateAndAdd: (name: string, trackId: string) => Promise<void>;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  playlists,
  onClose,
  onAddToPlaylist,
  onCreateAndAdd,
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!track) return null;

  const handleCreateAndAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateAndAdd(newPlaylistName.trim(), track.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPlaylist = async (playlistId: string) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAddToPlaylist(playlistId, track.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="add-to-playlist-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="add-to-playlist-modal-content"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Tambahkan ke Playlist</h3>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">
                "{track.title}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3 max-h-[360px] overflow-y-auto">
          {/* Create New Playlist Option */}
          {isCreatingNew ? (
            <form onSubmit={handleCreateAndAddSubmit} className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2.5">
              <p className="text-xs font-semibold text-blue-900">Buat Playlist & Masukkan Lagu</p>
              <input
                type="text"
                placeholder="Nama playlist baru..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                autoFocus
                required
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newPlaylistName.trim()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Buat & Tambahkan"}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full p-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 hover:bg-blue-50/80 text-blue-700 flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat Playlist Baru</span>
            </button>
          )}

          {/* List of existing playlists */}
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              Pilih Playlist
            </p>
            {playlists.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                <Music className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                <span>Belum ada playlist yang tersedia.</span>
              </div>
            ) : (
              playlists.map((pl) => {
                const isAlreadyInPlaylist = pl.songIds.includes(track.id);

                return (
                  <button
                    key={pl.id}
                    disabled={isAlreadyInPlaylist || isSubmitting}
                    onClick={() => handleSelectPlaylist(pl.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isAlreadyInPlaylist
                        ? "bg-slate-50 border-slate-200/60 text-slate-400 cursor-not-allowed"
                        : "bg-white border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">{pl.name}</p>
                        <p className="text-xs text-slate-400">{pl.songIds.length} Lagu</p>
                      </div>
                    </div>

                    {isAlreadyInPlaylist && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> Sudah ada
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
