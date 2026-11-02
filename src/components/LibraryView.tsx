import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  ArrowUpDown,
  Play,
  MoreVertical,
  Music,
  Edit2,
  Trash2,
  ListPlus,
  PlaySquare,
  Volume2,
  Upload,
  Folder,
  FolderPlus,
  FolderEdit,
  ArrowLeft,
  Shuffle,
  FolderInput,
  Heart,
  Flame,
  Clock,
  FolderX,
  Sparkles,
  Info,
  Download,
  DownloadCloud,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { MusicTrack, MusicFolder } from "../types/music";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { formatDuration } from "../services/audioMetadata";

export type LibraryCategory =
  | "all"
  | "folders"
  | "offline"
  | "no-folder"
  | "favorites"
  | "most-played"
  | "recent";

export type SortField =
  | "dateDesc"
  | "dateAsc"
  | "titleAsc"
  | "titleDesc"
  | "artistAsc"
  | "playsDesc"
  | "durationDesc"
  | "durationAsc";

const SORT_STORAGE_KEY = "drive_music_library_sort";

interface LibraryViewProps {
  tracks: MusicTrack[];
  folders: MusicFolder[];
  isLoading: boolean;
  onUploadClick: () => void;
  onUploadToFolder?: (folder: MusicFolder, files: File[]) => void;
  onCreateFolderClick?: (parentFolder?: MusicFolder | null) => void;
  onAddToPlaylistClick: (track: MusicTrack) => void;
  onMoveToFolderClick: (track: MusicTrack) => void;
  onEditMetadataClick: (track: MusicTrack) => void;
  onDeleteTrackClick: (track: MusicTrack) => void;
  onRenameFolderClick: (folder: MusicFolder) => void;
  onDeleteFolderClick: (folder: MusicFolder) => void;
  onToggleFavorite?: (track: MusicTrack) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

// Vibrant gradient backgrounds for tracks/folders without artwork
const GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #3b82f6)",
  "linear-gradient(135deg, #f43f5e, #fb923c)",
  "linear-gradient(135deg, #10b981, #3b82f6)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  folders,
  isLoading,
  onUploadClick,
  onUploadToFolder,
  onCreateFolderClick,
  onAddToPlaylistClick,
  onMoveToFolderClick,
  onEditMetadataClick,
  onDeleteTrackClick,
  onRenameFolderClick,
  onDeleteFolderClick,
  onToggleFavorite,
  searchQuery = "",
  onSearchChange,
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    playQueueWithIndex,
    addToQueue,
    addToQueueNext,
    offlineTrackIds,
    activeDownloads,
    downloadTrackForOfflineManual,
    removeTrackFromOffline,
    isTrackAvailableOffline,
  } = useMusicPlayer();

  const [activeCategory, setActiveCategory] = useState<LibraryCategory>("all");
  const [selectedFolder, setSelectedFolder] = useState<MusicFolder | null>(null);
  const [localSearch, setLocalSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortField>(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (
        saved === "dateDesc" ||
        saved === "dateAsc" ||
        saved === "titleAsc" ||
        saved === "titleDesc" ||
        saved === "artistAsc" ||
        saved === "playsDesc" ||
        saved === "durationDesc" ||
        saved === "durationAsc"
      ) {
        return saved;
      }
    } catch {
      // ignore
    }
    return "dateDesc";
  });

  const handleSortChange = (newSort: SortField) => {
    setSortBy(newSort);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, newSort);
    } catch {
      // ignore
    }
  };
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const folderFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFolderFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || !selectedFolder) return;

    const validAudioExtensions = [".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".opus", ".wma"];
    const validFiles = selectedFiles.filter((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const isAudioType = file.type.startsWith("audio/");
      return isAudioType || validAudioExtensions.includes(ext);
    });

    if (validFiles.length > 0) {
      onUploadToFolder?.(selectedFolder, validFiles);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const effectiveSearch = searchQuery || localSearch;

  // Close menus on outside click or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuTrackId(null);
        setActiveMenuFolderId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute songs inside a folder
  const getTracksForFolder = (folder: MusicFolder) => {
    return tracks.filter(
      (t) =>
        t.driveFolderId === folder.driveFolderId ||
        (t.folderName && t.folderName.toLowerCase() === folder.name.toLowerCase())
    );
  };

  // Play all songs in a folder sequentially
  const handlePlayFolder = (folder: MusicFolder, shuffle: boolean = false) => {
    const folderTracks = getTracksForFolder(folder);
    if (folderTracks.length === 0) return;

    let queue = [...folderTracks];
    if (shuffle) {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }

    playQueueWithIndex(queue, 0);
  };

  // Counts for Category Badges
  const counts = useMemo(() => {
    const noFolder = tracks.filter((t) => !t.driveFolderId && !t.folderName).length;
    const favorites = tracks.filter((t) => t.isFavorite).length;
    const played = tracks.filter((t) => (t.playCount || 0) > 0).length;
    const offline = tracks.filter((t) => offlineTrackIds.includes(t.id)).length;
    return {
      all: tracks.length,
      folders: folders.length,
      offline,
      noFolder,
      favorites,
      played,
      recent: tracks.length,
    };
  }, [tracks, folders, offlineTrackIds]);

  // Filter & Sort tracks based on active category & search query
  const filteredAndSortedTracks = useMemo(() => {
    let result: MusicTrack[] = [];

    if (selectedFolder) {
      result = getTracksForFolder(selectedFolder);
    } else {
      switch (activeCategory) {
        case "offline":
          result = tracks.filter((t) => offlineTrackIds.includes(t.id));
          break;
        case "no-folder":
          result = tracks.filter((t) => !t.driveFolderId && !t.folderName);
          break;
        case "favorites":
          result = tracks.filter((t) => t.isFavorite === true);
          break;
        case "most-played":
          result = [...tracks].sort(
            (a, b) => (b.playCount || 0) - (a.playCount || 0)
          );
          break;
        case "recent":
          result = [...tracks].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
        case "all":
        default:
          result = [...tracks];
          break;
      }
    }

    // Filter by search query
    if (effectiveSearch.trim()) {
      const q = effectiveSearch.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.artist && t.artist.toLowerCase().includes(q)) ||
          (t.album && t.album.toLowerCase().includes(q)) ||
          (t.folderName && t.folderName.toLowerCase().includes(q))
      );
    }

    // Sort if not specifically overriding category sort
    if (activeCategory !== "most-played" && activeCategory !== "recent") {
      result.sort((a, b) => {
        switch (sortBy) {
          case "dateDesc":
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case "dateAsc":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "titleAsc":
            return a.title.localeCompare(b.title);
          case "titleDesc":
            return b.title.localeCompare(a.title);
          case "artistAsc":
            return (a.artist || "").localeCompare(b.artist || "");
          case "playsDesc":
            return (b.playCount || 0) - (a.playCount || 0);
          case "durationDesc": {
            const aValid = typeof a.duration === "number" && !isNaN(a.duration) && a.duration > 0;
            const bValid = typeof b.duration === "number" && !isNaN(b.duration) && b.duration > 0;
            if (!aValid && !bValid) return a.title.localeCompare(b.title);
            if (!aValid) return 1; // lagu tanpa durasi ditempatkan di bawah
            if (!bValid) return -1; // lagu tanpa durasi ditempatkan di bawah
            const diff = b.duration - a.duration;
            return diff !== 0 ? diff : a.title.localeCompare(b.title);
          }
          case "durationAsc": {
            const aValid = typeof a.duration === "number" && !isNaN(a.duration) && a.duration > 0;
            const bValid = typeof b.duration === "number" && !isNaN(b.duration) && b.duration > 0;
            if (!aValid && !bValid) return a.title.localeCompare(b.title);
            if (!aValid) return 1; // lagu tanpa durasi ditempatkan di bawah
            if (!bValid) return -1; // lagu tanpa durasi ditempatkan di bawah
            const diff = a.duration - b.duration;
            return diff !== 0 ? diff : a.title.localeCompare(b.title);
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [tracks, selectedFolder, activeCategory, offlineTrackIds, effectiveSearch, sortBy]);

  // Filter folders
  const filteredFolders = useMemo(() => {
    let result = [...folders];
    if (effectiveSearch.trim()) {
      const q = effectiveSearch.toLowerCase().trim();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return result;
  }, [folders, effectiveSearch]);

  // Quick play all from current filtered category
  const handlePlayCategoryAll = (shuffle: boolean = false) => {
    if (filteredAndSortedTracks.length === 0) return;
    let queue = [...filteredAndSortedTracks];
    if (shuffle) {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }
    playQueueWithIndex(queue, 0);
  };

  // Category navigation tabs definitions
  const CATEGORY_TABS: {
    id: LibraryCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    highlightClass?: string;
  }[] = [
    {
      id: "all",
      label: "Semua Lagu",
      icon: Music,
      count: counts.all,
    },
    {
      id: "folders",
      label: "Folder Musik",
      icon: Folder,
      count: counts.folders,
    },
    {
      id: "offline",
      label: "Tersedia Offline",
      icon: DownloadCloud,
      count: counts.offline,
      highlightClass:
        counts.offline > 0
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : undefined,
    },
    {
      id: "no-folder",
      label: "Tanpa Folder",
      icon: FolderX,
      count: counts.noFolder,
      highlightClass:
        counts.noFolder > 0
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : undefined,
    },
    {
      id: "favorites",
      label: "Favorit",
      icon: Heart,
      count: counts.favorites,
      highlightClass:
        counts.favorites > 0
          ? "bg-rose-50 text-rose-600 border-rose-200"
          : undefined,
    },
    {
      id: "most-played",
      label: "Sering Diputar",
      icon: Flame,
      count: counts.played,
      highlightClass:
        counts.played > 0
          ? "bg-orange-50 text-orange-600 border-orange-200"
          : undefined,
    },
    {
      id: "recent",
      label: "Terbaru",
      icon: Clock,
      count: counts.recent,
    },
  ];

  return (
    <div
      id="library-view"
      className="flex-1 min-h-0 flex flex-col h-full overflow-hidden space-y-3 sm:space-y-4 animate-in fade-in duration-200"
    >
      {/* Fixed Header, Category Tabs, and Search Controls */}
      <div id="library-fixed-controls" className="shrink-0 flex flex-col space-y-3 sm:space-y-3.5">
        {/* Top Header */}
      {!selectedFolder ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
              <span>Library Musik</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {activeCategory === "folders"
                  ? `${folders.length} Folder`
                  : `${filteredAndSortedTracks.length} Lagu`}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Koleksi musik dan folder Anda yang tersimpan di Google Drive
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
            {/* Sort Dropdown (Visible for standard track views) */}
            {activeCategory !== "folders" &&
              activeCategory !== "most-played" &&
              activeCategory !== "recent" && (
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="select-library-sort"
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value as SortField)}
                    className="w-full sm:w-auto pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-2xs truncate"
                  >
                    <option value="dateDesc">Terbaru Ditambahkan</option>
                    <option value="dateAsc">Terlama Ditambahkan</option>
                    <option value="titleAsc">Judul (A - Z)</option>
                    <option value="titleDesc">Judul (Z - A)</option>
                    <option value="artistAsc">Artis (A - Z)</option>
                    <option value="playsDesc">Paling Sering Diputar</option>
                    <option value="durationDesc">Durasi Terlama</option>
                    <option value="durationAsc">Durasi Terpendek</option>
                  </select>
                </div>
              )}

            {/* Quick Play All for current category if there are songs */}
            {activeCategory !== "folders" &&
              filteredAndSortedTracks.length > 0 && (
                <button
                  id="btn-play-all-category"
                  onClick={() => handlePlayCategoryAll(false)}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  title="Putar semua lagu di kategori ini"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-blue-600" />
                  <span>Putar Semua</span>
                </button>
              )}

            {onCreateFolderClick && (
              <button
                id="btn-library-create-folder"
                onClick={() => onCreateFolderClick(null)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
                title="Buat Folder Baru di Google Drive"
              >
                <FolderPlus className="w-4 h-4 text-blue-600" />
                <span className="hidden xs:inline">+ Folder Baru</span>
                <span className="xs:hidden">+ Folder</span>
              </button>
            )}

            <button
              id="btn-library-upload"
              onClick={onUploadClick}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Musik</span>
            </button>
          </div>
        </div>
      ) : (
        /* Folder Detail Header */
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <button
            id="btn-back-to-folders"
            onClick={() => setSelectedFolder(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Koleksi Folder</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Folder className="w-8 h-8" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    Folder Google Drive
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-1">
                  {selectedFolder.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {getTracksForFolder(selectedFolder).length} Lagu tersimpan
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="btn-play-all-folder-detail"
                onClick={() => handlePlayFolder(selectedFolder, false)}
                disabled={getTracksForFolder(selectedFolder).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play All</span>
              </button>

              <button
                onClick={() => handlePlayFolder(selectedFolder, true)}
                disabled={getTracksForFolder(selectedFolder).length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                title="Shuffle Play"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>

              {onUploadToFolder && (
                <>
                  <input
                    ref={folderFileInputRef}
                    type="file"
                    multiple
                    accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.wma"
                    onChange={handleFolderFilesSelected}
                    className="hidden"
                  />
                  <button
                    id="btn-upload-music-folder-detail"
                    onClick={() => folderFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
                    title={`Upload musik langsung ke folder "${selectedFolder.name}" di Google Drive`}
                  >
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Upload Musik</span>
                  </button>
                </>
              )}

              <button
                onClick={() => onRenameFolderClick(selectedFolder)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Rename Folder di Drive & Aplikasi"
              >
                <FolderEdit className="w-4 h-4 text-blue-600" />
                <span>Rename Folder</span>
              </button>

              {onCreateFolderClick && (
                <button
                  id="btn-create-subfolder-detail"
                  onClick={() => onCreateFolderClick(selectedFolder)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  title="Buat Subfolder Baru di Folder ini"
                >
                  <FolderPlus className="w-4 h-4 text-blue-600" />
                  <span>+ Subfolder</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Categories Navigation Bar */}
      {!selectedFolder && (
        <div className="border-b border-slate-200/80 pb-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
            {CATEGORY_TABS.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  id={`tab-category-${cat.id}`}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedFolder(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs font-bold"
                      : "bg-slate-100/70 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-white fill-current"
                        : cat.id === "favorites" && cat.count > 0
                        ? "text-rose-500"
                        : cat.id === "most-played" && cat.count > 0
                        ? "text-orange-500"
                        : "text-slate-500"
                    }`}
                  />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Search Bar */}
      <div className="block md:hidden">
        <div className="relative">
          <input
            type="text"
            placeholder={
              activeCategory === "folders" && !selectedFolder
                ? "Cari folder musik..."
                : "Cari lagu, artis, atau album..."
            }
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              if (onSearchChange) onSearchChange(e.target.value);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Tanpa Folder Informative Banner */}
      {!selectedFolder && activeCategory === "no-folder" && counts.noFolder > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-2xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold text-amber-950">
              Lagu Tanpa Folder ({counts.noFolder} Lagu)
            </p>
            <p className="text-amber-800 mt-0.5 leading-relaxed">
              Lagu-lagu di bawah ini tersimpan di direktori utama (Root) Google
              Drive Anda dan belum dikelompokkan ke folder musik. Anda dapat
              memindahkannya ke folder mana saja dengan mudah melalui tombol menu{" "}
              <strong>⋮ &gt; Pindahkan ke Folder</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Favorit Banner if active */}
      {!selectedFolder && activeCategory === "favorites" && counts.favorites > 0 && (
        <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 text-rose-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <p className="font-bold text-rose-950 text-sm">
                Koleksi Lagu Favorit Anda
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                {counts.favorites} lagu yang Anda sukai, tersinkron otomatis di
                semua perangkat.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePlayCategoryAll(false)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Putar Favorit</span>
            </button>
            <button
              onClick={() => handlePlayCategoryAll(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Shuffle Favorit"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Acak</span>
            </button>
          </div>
        </div>
      )}
      </div>

      {/* ========================================================================= */}
      {/* THE ONLY VERTICAL SCROLLABLE AREA: music-list-scroll-container             */}
      {/* ========================================================================= */}
      <div
        id="music-list-scroll-container"
        className={`music-list-scroll-container music-scroll-container flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5 ${
          currentTrack
            ? "pb-[calc(195px+env(safe-area-inset-bottom,0px))] md:pb-28"
            : "pb-[calc(85px+env(safe-area-inset-bottom,0px))] md:pb-8"
        }`}
      >
        {/* CONTENT AREA */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 bg-slate-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : activeCategory === "folders" && !selectedFolder ? (
        /* FOLDERS GRID VIEW */
        filteredFolders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
              <FolderPlus className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              Belum Ada Folder Musik
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Unggah satu folder musik langsung dari perangkat Anda melalui menu
              Upload.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {onCreateFolderClick && (
                <button
                  onClick={() => onCreateFolderClick(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Buat Folder Baru</span>
                </button>
              )}
              <button
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Folder Musik Sekarang</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map((folder, index) => {
              const folderTracks = getTracksForFolder(folder);
              const songCount = folderTracks.length;
              const hasArt = folderTracks.find((t) => t.artworkUrl)?.artworkUrl;

              return (
                <div
                  key={folder.id}
                  id={`folder-card-${folder.id}`}
                  onClick={() => setSelectedFolder(folder)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all group relative cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-13 h-13 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-white font-bold shadow-xs relative"
                        style={{
                          background: hasArt
                            ? undefined
                            : GRADIENTS[index % GRADIENTS.length],
                        }}
                      >
                        {hasArt ? (
                          <img
                            src={hasArt}
                            alt={folder.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Folder className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 text-base truncate group-hover:text-blue-600 transition-colors">
                          {folder.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {songCount} Lagu
                        </p>
                      </div>
                    </div>

                    {/* 3-dots Menu for folder */}
                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        id={`btn-menu-folder-${folder.id}`}
                        onClick={() =>
                          setActiveMenuFolderId(
                            activeMenuFolderId === folder.id ? null : folder.id
                          )
                        }
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuFolderId === folder.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveMenuFolderId(null)}
                          />
                          <div
                            className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                            onClick={() => setActiveMenuFolderId(null)}
                          >
                            <button
                              onClick={() => onRenameFolderClick(folder)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <FolderEdit className="w-4 h-4 text-blue-600" />
                              <span>Rename Folder</span>
                            </button>

                            <button
                              onClick={() => onDeleteFolderClick(folder)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Hapus Folder</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                    <span className="text-[11px] font-medium text-slate-400">
                      Folder Google Drive
                    </span>

                    <button
                      id={`btn-play-folder-${folder.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayFolder(folder, false);
                      }}
                      disabled={songCount === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play All</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* TRACKS TABLE VIEW */
        filteredAndSortedTracks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
              {activeCategory === "favorites" ? (
                <Heart className="w-8 h-8 text-rose-500" />
              ) : activeCategory === "offline" ? (
                <DownloadCloud className="w-8 h-8 text-emerald-600" />
              ) : activeCategory === "most-played" ? (
                <Flame className="w-8 h-8 text-orange-500" />
              ) : activeCategory === "no-folder" ? (
                <FolderX className="w-8 h-8 text-amber-500" />
              ) : (
                <Music className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              {effectiveSearch
                ? "Tidak Ada Lagu yang Cocok"
                : selectedFolder
                ? `Folder "${selectedFolder.name}" masih kosong`
                : activeCategory === "offline"
                ? "Belum Ada Lagu Tersedia Offline"
                : activeCategory === "favorites"
                ? "Belum Ada Lagu Favorit"
                : activeCategory === "no-folder"
                ? "Semua Lagu Sudah Memiliki Folder"
                : activeCategory === "most-played"
                ? "Belum Ada Riwayat Pemutaran"
                : "Belum Ada Lagu di Library"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {effectiveSearch
                ? "Coba gunakan kata kunci pencarian yang lain."
                : activeCategory === "offline"
                ? 'Klik menu titik tiga (⋮) pada lagu mana pun dan pilih "Unduh untuk Offline" agar lagu dapat diputar kapan saja tanpa koneksi internet.'
                : activeCategory === "favorites"
                ? "Klik ikon hati (❤️) pada lagu apa pun untuk menyimpannya ke daftar Favorit Anda."
                : activeCategory === "no-folder"
                ? "Semua lagu dalam koleksi Anda sudah rapi tersusun di dalam folder musik Google Drive."
                : activeCategory === "most-played"
                ? "Dengarkan lagu favorit Anda untuk melihat daftar lagu yang paling sering Anda putar."
                : "Mulai tambahkan lagu atau folder musik dari perangkat Anda ke Google Drive."}
            </p>
            {activeCategory === "offline" && !effectiveSearch && (
              <button
                onClick={() => setActiveCategory("all")}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 shadow-xs transition-all cursor-pointer"
              >
                <Music className="w-3.5 h-3.5" />
                <span>Lihat Semua Lagu</span>
              </button>
            )}
            {activeCategory === "favorites" && !effectiveSearch && (
              <button
                onClick={() => setActiveCategory("all")}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 shadow-xs transition-all cursor-pointer"
              >
                <Music className="w-3.5 h-3.5" />
                <span>Lihat Semua Lagu</span>
              </button>
            )}
            {!effectiveSearch &&
              activeCategory !== "favorites" &&
              activeCategory !== "offline" &&
              activeCategory !== "no-folder" && (
                <button
                  onClick={onUploadClick}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Musik</span>
                </button>
              )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
            {/* Table Header (Desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 rounded-t-2xl text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-6 flex items-center gap-3">
                <span className="w-6 text-center">#</span>
                <span>Judul & Artis</span>
              </div>
              <div className="col-span-3">Album / Folder</div>
              <div className="col-span-2 text-right">Durasi</div>
              <div className="col-span-1 text-center">Aksi</div>
            </div>

            {/* Track List Items */}
            <div className="divide-y divide-slate-100">
              {filteredAndSortedTracks.map((track, index) => {
                const isCurrentActive = currentTrack?.id === track.id;
                const isCurrentlyPlayingThis = isCurrentActive && isPlaying;
                const isLastItem = index === filteredAndSortedTracks.length - 1;
                const isFirstItem = index === 0;
                const isFav = track.isFavorite === true;
                const plays = track.playCount || 0;

                // Smart menu positioning: if item is near bottom of table, open menu upwards
                const isNearBottom =
                  index >= filteredAndSortedTracks.length - 2 ||
                  (filteredAndSortedTracks.length <= 3 && index >= 1);

                return (
                  <div
                    key={track.id}
                    id={`track-item-${track.id}`}
                    className={`flex md:grid md:grid-cols-12 gap-2.5 md:gap-4 px-3 sm:px-5 py-2.5 sm:py-3.5 items-center justify-between hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                      isFirstItem && "md:rounded-none rounded-t-2xl"
                    } ${isLastItem && "rounded-b-2xl"} ${
                      isCurrentActive ? "bg-blue-50/50" : ""
                    }`}
                    onClick={() => playTrack(track, filteredAndSortedTracks)}
                  >
                    {/* Track info & Number */}
                    <div className="flex-1 min-w-0 md:col-span-6 flex items-center gap-2.5 sm:gap-3">
                      {/* Play / Index Button */}
                      <div className="w-5 sm:w-6 flex items-center justify-center shrink-0">
                        {isCurrentlyPlayingThis ? (
                          <Volume2 className="w-4 h-4 text-blue-600 animate-pulse" />
                        ) : (
                          <>
                            <span className="text-xs font-semibold text-slate-400 group-hover:hidden">
                              {index + 1}
                            </span>
                            <Play className="w-3.5 h-3.5 text-blue-600 fill-current hidden group-hover:block" />
                          </>
                        )}
                      </div>

                      {/* Artwork */}
                      <div
                        className="w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-2xs relative border border-slate-200/60"
                        style={{
                          background: track.artworkUrl
                            ? undefined
                            : GRADIENTS[index % GRADIENTS.length],
                        }}
                      >
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-5 h-5 text-white" />
                        )}

                        {isCurrentlyPlayingThis && (
                          <div className="absolute inset-0 bg-blue-600/40 flex items-center justify-center">
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                          </div>
                        )}
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p
                            className={`text-xs sm:text-sm font-semibold truncate leading-tight ${
                              isCurrentActive
                                ? "text-blue-600 font-bold"
                                : "text-slate-800"
                            }`}
                          >
                            {track.title}
                          </p>

                          {/* Offline Available / Downloading Badge */}
                          {activeDownloads[track.id] !== undefined ? (
                            <span
                              id={`badge-downloading-${track.id}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md font-semibold text-[10px] shrink-0 bg-blue-50 text-blue-600 border border-blue-200/60 animate-pulse"
                              title={`Sedang mengunduh: ${activeDownloads[track.id]}%`}
                            >
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />
                              <span>{activeDownloads[track.id]}%</span>
                            </span>
                          ) : isTrackAvailableOffline(track.id) ? (
                            <span
                              id={`badge-offline-${track.id}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md font-semibold text-[10px] shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                              title="Tersedia Offline"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span className="hidden min-[480px]:inline">Tersedia Offline</span>
                              <span className="min-[480px]:hidden">Offline</span>
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                          <span className="truncate">
                            {track.artist || "Artis Tidak Diketahui"}
                          </span>

                          {/* Play count badge in most-played or if plays > 0 */}
                          {(activeCategory === "most-played" || plays > 0) && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md font-medium text-[10px] shrink-0 ${
                                plays >= 10
                                  ? "bg-orange-50 text-orange-600 font-bold"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                              title={`${plays} kali diputar`}
                            >
                              <Flame className="w-2.5 h-2.5" />
                              <span>{plays}x</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Album / Folder Info */}
                    <div className="hidden md:block md:col-span-3 text-xs text-slate-500 truncate">
                      {track.folderName ? (
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium">
                          <Folder className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="truncate">{track.folderName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">
                          {track.album || "Tanpa Folder"}
                        </span>
                      )}
                    </div>

                    {/* Duration (Desktop: 2 cols in grid) */}
                    <div className="hidden md:block md:col-span-2 text-right text-xs font-medium text-slate-500 tabular-nums">
                      {track.duration > 0
                        ? formatDuration(track.duration)
                        : "--:--"}
                    </div>

                    {/* Action Buttons & Menu (and Mobile Duration) */}
                    <div
                      className="shrink-0 flex items-center gap-1 sm:gap-1.5 md:col-span-1 justify-end md:justify-center relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Mobile Duration (Visible on mobile, placed before Favorite and Menu) */}
                      <span className="md:hidden text-[11px] sm:text-xs font-medium text-slate-400 tabular-nums shrink-0 whitespace-nowrap px-0.5">
                        {track.duration > 0
                          ? formatDuration(track.duration)
                          : "--:--"}
                      </span>

                      {/* Favorite Button (Visible on mobile & hover on desktop) */}
                      {onToggleFavorite && (
                        <button
                          id={`btn-fav-track-${track.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(track);
                          }}
                          title={
                            isFav
                              ? "Hapus dari Favorit"
                              : "Tambahkan ke Favorit"
                          }
                          className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-all shrink-0 cursor-pointer ${
                            isFav
                              ? "text-rose-500 hover:text-rose-600 hover:scale-110"
                              : "text-slate-300 hover:text-rose-400 opacity-60 sm:opacity-0 group-hover:opacity-100 hidden min-[360px]:flex"
                          }`}
                          aria-label={isFav ? "Hapus Favorit" : "Tambah Favorit"}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                              isFav ? "fill-rose-500" : ""
                            }`}
                          />
                        </button>
                      )}

                      <button
                        id={`btn-menu-track-${track.id}`}
                        onClick={() =>
                          setActiveMenuTrackId(
                            activeMenuTrackId === track.id ? null : track.id
                          )
                        }
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                        aria-label="Menu Aksi Lagu"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuTrackId === track.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveMenuTrackId(null)}
                          />

                          <div
                            className={`absolute right-0 ${
                              isNearBottom
                                ? "bottom-full mb-1.5"
                                : "top-full mt-1.5"
                            } w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
                            onClick={() => setActiveMenuTrackId(null)}
                          >
                            <button
                              onClick={() => addToQueueNext(track)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                            >
                              <PlaySquare className="w-4 h-4 text-blue-600" />
                              <span>Putar Berikutnya</span>
                            </button>

                            <button
                              onClick={() => addToQueue(track)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                            >
                              <ListPlus className="w-4 h-4 text-slate-600" />
                              <span>Tambahkan ke Antrean</span>
                            </button>

                            <button
                              onClick={() => onAddToPlaylistClick(track)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                            >
                              <Music className="w-4 h-4 text-purple-600" />
                              <span>Tambahkan ke Playlist</span>
                            </button>

                            {/* Offline Download / Remove Option */}
                            {isTrackAvailableOffline(track.id) ? (
                              <button
                                id={`btn-remove-offline-track-${track.id}`}
                                onClick={() => removeTrackFromOffline(track)}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-amber-800 hover:bg-amber-50/80 flex items-center gap-2.5 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 text-amber-600 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-amber-900 leading-tight">
                                    Hapus Unduhan Offline
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                    File di Drive tetap aman
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <button
                                id={`btn-download-offline-track-${track.id}`}
                                onClick={() => downloadTrackForOfflineManual(track)}
                                disabled={activeDownloads[track.id] !== undefined}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                              >
                                {activeDownloads[track.id] !== undefined ? (
                                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                                ) : (
                                  <DownloadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-slate-800 leading-tight">
                                    {activeDownloads[track.id] !== undefined
                                      ? `Mengunduh (${activeDownloads[track.id]}%)...`
                                      : "Unduh untuk Offline"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                    Simpan ke penyimpanan lokal
                                  </span>
                                </div>
                              </button>
                            )}

                            {onToggleFavorite && (
                              <button
                                onClick={() => onToggleFavorite(track)}
                                className={`w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer ${
                                  isFav
                                    ? "text-rose-600"
                                    : "text-slate-700"
                                }`}
                              >
                                <Heart
                                  className={`w-4 h-4 text-rose-500 ${
                                    isFav ? "fill-rose-500" : ""
                                  }`}
                                />
                                <span>
                                  {isFav
                                    ? "Hapus dari Favorit"
                                    : "Tandai Favorit"}
                                </span>
                              </button>
                            )}

                            <button
                              id={`btn-move-to-folder-track-${track.id}`}
                              onClick={() => onMoveToFolderClick(track)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                            >
                              <FolderInput className="w-4 h-4 text-blue-600" />
                              <span>Pindahkan ke Folder</span>
                            </button>

                            <button
                              onClick={() => onEditMetadataClick(track)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4 text-amber-600" />
                              <span>Edit Metadata Lagu</span>
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              onClick={() => onDeleteTrackClick(track)}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Hapus Lagu</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
      </div>
    </div>
  );
};
