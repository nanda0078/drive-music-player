import React, { useState } from "react";
import {
  ListMusic,
  Plus,
  Play,
  Shuffle,
  MoreVertical,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Music,
  X,
} from "lucide-react";
import { Playlist, MusicTrack } from "../types/music";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { formatDuration } from "../services/audioMetadata";

interface PlaylistViewProps {
  playlists: Playlist[];
  tracks: MusicTrack[];
  onCreatePlaylist: (name: string) => Promise<void>;
  onRenamePlaylist: (playlistId: string, newName: string) => Promise<void>;
  onDeletePlaylist: (playlist: Playlist) => Promise<void>;
  onRemoveSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  onReorderPlaylistSongs: (playlistId: string, newSongIds: string[]) => Promise<void>;
  onOpenLibrary: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlists,
  tracks,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onRemoveSongFromPlaylist,
  onReorderPlaylistSongs,
  onOpenLibrary,
}) => {
  const { playTrack } = useMusicPlayer();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>("");
  const [renamingPlaylist, setRenamingPlaylist] = useState<Playlist | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  // Map playlist songIds to actual MusicTrack items preserving order
  const playlistTracks = React.useMemo(() => {
    if (!selectedPlaylist) return [];
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    return selectedPlaylist.songIds
      .map((id) => trackMap.get(id))
      .filter((t): t is MusicTrack => t !== undefined);
  }, [selectedPlaylist, tracks]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    await onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setIsCreating(false);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingPlaylist || !renameValue.trim()) return;
    await onRenamePlaylist(renamingPlaylist.id, renameValue.trim());
    setRenamingPlaylist(null);
  };

  const handleMoveSong = async (index: number, direction: "up" | "down") => {
    if (!selectedPlaylist) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedPlaylist.songIds.length) return;

    const newSongIds = [...selectedPlaylist.songIds];
    const [moved] = newSongIds.splice(index, 1);
    newSongIds.splice(targetIndex, 0, moved);
    await onReorderPlaylistSongs(selectedPlaylist.id, newSongIds);
  };

  const handlePlayAll = (shuffle: boolean = false) => {
    if (playlistTracks.length === 0) return;
    let trackList = [...playlistTracks];
    if (shuffle) {
      trackList = [...trackList].sort(() => Math.random() - 0.5);
    }
    playTrack(trackList[0], trackList, selectedPlaylist?.id);
  };

  return (
    <div id="playlist-view" className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* If a playlist is selected, show playlist details */}
      {selectedPlaylist ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Back button & Playlist Header */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <button
              id="btn-back-to-playlists"
              onClick={() => setSelectedPlaylistId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Semua Playlist</span>
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                  <ListMusic className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                    {selectedPlaylist.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {playlistTracks.length} Lagu • Dibuat {new Date(selectedPlaylist.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {playlistTracks.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    id="btn-play-playlist"
                    onClick={() => handlePlayAll(false)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>Putar Semua</span>
                  </button>

                  <button
                    id="btn-shuffle-playlist"
                    onClick={() => handlePlayAll(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Acak</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Songs inside playlist */}
          {playlistTracks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs">
              <Music className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Playlist Ini Masih Kosong</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Buka Library Musik dan pilih "Tambahkan ke Playlist" untuk memasukkan lagu ke "{selectedPlaylist.name}".
              </p>
              <button
                onClick={onOpenLibrary}
                className="mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2"
              >
                <Music className="w-4 h-4" />
                <span>Buka Library Musik</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-xs">
              {playlistTracks.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className="flex items-center justify-between p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors group"
                >
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    onClick={() => playTrack(track, playlistTracks, selectedPlaylist.id)}
                  >
                    <span className="text-xs font-semibold text-slate-400 w-5 text-center shrink-0">
                      {index + 1}
                    </span>

                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 shadow-xs">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-900 truncate leading-tight group-hover:text-blue-600 transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {track.artist || "Artis Tidak Diketahui"}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Reordering */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-xs text-slate-400 font-medium tabular-nums whitespace-nowrap mr-1">
                      {formatDuration(track.duration)}
                    </span>

                    {/* Move Up */}
                    <button
                      disabled={index === 0}
                      onClick={() => handleMoveSong(index, "up")}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100"
                      title="Pindahkan ke Atas"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      disabled={index === playlistTracks.length - 1}
                      onClick={() => handleMoveSong(index, "down")}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100"
                      title="Pindahkan ke Bawah"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Remove from Playlist */}
                    <button
                      onClick={() => onRemoveSongFromPlaylist(selectedPlaylist.id, track.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus dari playlist"
                      aria-label="Hapus dari Playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Playlists Overview */
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Daftar Playlist</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  {playlists.length} Playlist
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Kelola daftar putar lagu favorit Anda secara teratur.
              </p>
            </div>

            <button
              id="btn-create-playlist"
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat Playlist</span>
            </button>
          </div>

          {/* Create Modal Form inline/dialog */}
          {isCreating && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-blue-600" />
                  <span>Buat Playlist Baru</span>
                </h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Masukkan nama playlist (contoh: Santai Sore, Workout, dll)..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  autoFocus
                  required
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium border border-slate-200"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rename Modal inline */}
          {renamingPlaylist && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-600" />
                  <span>Ubah Nama Playlist: {renamingPlaylist.name}</span>
                </h3>
                <button
                  onClick={() => setRenamingPlaylist(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRenameSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Nama baru playlist..."
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-white border border-amber-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  autoFocus
                  required
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                  >
                    Perbarui
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingPlaylist(null)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium border border-slate-200"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Playlists Grid */}
          {playlists.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs">
              <ListMusic className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Belum Ada Playlist</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Buat playlist pertama Anda untuk mengelompokkan lagu berdasarkan suasana hati atau genre.
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Buat Playlist</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl) => {
                const songCount = pl.songIds.length;
                const isMenuOpen = activeMenuId === pl.id;

                return (
                  <div
                    key={pl.id}
                    id={`playlist-card-${pl.id}`}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all group relative flex flex-col justify-between"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => setSelectedPlaylistId(pl.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                          <ListMusic className="w-6 h-6" />
                        </div>

                        {/* Menu button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(isMenuOpen ? null : pl.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            aria-label="Opsi Playlist"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown */}
                          {isMenuOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                }}
                              />
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingPlaylist(pl);
                                    setRenameValue(pl.name);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-500" />
                                  <span>Ubah Nama</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePlaylist(pl);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-500" />
                                  <span>Hapus Playlist</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors truncate">
                          {pl.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {songCount} Lagu
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {new Date(pl.createdAt).toLocaleDateString("id-ID")}
                      </span>
                      <button
                        onClick={() => setSelectedPlaylistId(pl.id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Buka Playlist →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
