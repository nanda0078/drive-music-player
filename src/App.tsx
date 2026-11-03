import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  increment,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import {
  db,
  getAccessToken,
  handleFirestoreError,
  OperationType,
} from "./firebase/config";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MusicPlayerProvider, useMusicPlayer } from "./context/MusicPlayerContext";
import { EqualizerProvider } from "./context/EqualizerContext";
import { SleepTimerProvider } from "./context/SleepTimerContext";
import { ToastProvider, useToast } from "./components/Toast";
import { PwaProvider, usePwa } from "./context/PwaContext";
import { Navbar } from "./components/Navbar";
import { MobileNav } from "./components/MobileNav";
import { LibraryView } from "./components/LibraryView";
import { PlaylistView } from "./components/PlaylistView";
import { UploadView } from "./components/UploadView";
import { MiniPlayer } from "./components/MiniPlayer";
import { NowPlayingModal } from "./components/NowPlayingModal";
import { EqualizerModal } from "./components/EqualizerModal";
import { SleepTimerModal } from "./components/SleepTimerModal";
import { QueueDrawer } from "./components/QueueDrawer";
import { AddToPlaylistModal } from "./components/AddToPlaylistModal";
import { MoveToFolderModal } from "./components/MoveToFolderModal";
import { EditMetadataModal } from "./components/EditMetadataModal";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { CreateFolderModal } from "./components/CreateFolderModal";
import { RenameFolderModal } from "./components/RenameFolderModal";
import { DeleteFolderModal } from "./components/DeleteFolderModal";
import { FolderUploadModal, FolderUploadItem } from "./components/FolderUploadModal";
import { IntegrationSettingsModal } from "./components/IntegrationSettingsModal";
import { ResetAppDataModal } from "./components/ResetAppDataModal";
import { InstallPwaBanner } from "./components/InstallPwaBanner";
import { InstallGuideModal } from "./components/InstallGuideModal";
import { PwaUpdateNotification } from "./components/PwaUpdateNotification";
import { OfflineDownloadOfferBanner } from "./components/OfflineDownloadOfferBanner";
import { DriveStorageCard } from "./components/DriveStorageCard";
import {
  MusicTrack,
  MusicFolder,
  Playlist,
  NavigationTab,
  SelectedUploadFile,
} from "./types/music";
import {
  ensureAppFolder,
  createOrGetSubFolderInDrive,
  createNewFolderInDrive,
  renameDriveFolder,
  moveDriveFileToFolder,
  uploadAudioFileWithProgress,
  trashDriveFile,
  getOrCreateCoversFolder,
  uploadCoverImageToDrive,
} from "./services/driveService";
import {
  Music,
  ListMusic,
  Upload,
  HardDrive,
  Folder,
  Download,
  Smartphone,
  Loader2,
  AlertCircle,
} from "lucide-react";

const MainAppContent: React.FC = () => {
  const { showToast } = useToast();
  const {
    canInstall,
    isInstalled,
    isStandalone,
    promptInstall,
    isInstallGuideOpen,
    setIsInstallGuideOpen,
  } = usePwa();
  const {
    user,
    authStatus,
    isAuthReady,
    hasGoogleDriveAuth,
    isReauthNeeded,
    isLoggingIn,
    loginWithGoogle,
    reconnectGoogleDrive,
    logout,
  } = useAuth();

  const {
    isOnline,
    currentTrack,
    queue,
    playTrack,
    setIsQueueOpen,
    resetPlayerState,
    updateTrackInContext,
    registerTrackPlayListener,
  } = useMusicPlayer();

  const [currentTab, setCurrentTab] = useState<NavigationTab>("library");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [folders, setFolders] = useState<MusicFolder[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>("");
  const [storageSyncTrigger, setStorageSyncTrigger] = useState<number>(0);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResetAppModalOpen, setIsResetAppModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<MusicTrack | null>(null);
  const [moveToFolderTrack, setMoveToFolderTrack] = useState<MusicTrack | null>(null);
  const [editMetadataTrack, setEditMetadataTrack] = useState<MusicTrack | null>(null);
  const [deleteTrack, setDeleteTrack] = useState<MusicTrack | null>(null);
  const [renameFolder, setRenameFolder] = useState<MusicFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<MusicFolder | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [createFolderParent, setCreateFolderParent] = useState<{ id: string; name: string } | null>(null);
  const [folderUploadTarget, setFolderUploadTarget] = useState<MusicFolder | null>(null);
  const [folderUploadFiles, setFolderUploadFiles] = useState<File[]>([]);
  const [isFolderUploadModalOpen, setIsFolderUploadModalOpen] = useState<boolean>(false);

  // Listen to Firestore `music` collection for active user
  useEffect(() => {
    if (!user) {
      setTracks([]);
      setIsLoadingTracks(false);
      return;
    }

    setIsLoadingTracks(true);
    const q = query(
      collection(db, "music"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedTracks: MusicTrack[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            title: data.title,
            artist: data.artist || "Artis Tidak Diketahui",
            album: data.album,
            duration: data.duration || 0,
            driveFileId: data.driveFileId,
            driveFolderId: data.driveFolderId,
            folderName: data.folderName,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            format: data.format,
            artworkUrl: data.artworkUrl,
            isFavorite: data.isFavorite === true,
            playCount: typeof data.playCount === "number" ? data.playCount : 0,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
        });

        // Client-side sort by date desc
        loadedTracks.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setTracks(loadedTracks);
        setIsLoadingTracks(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "music");
        setIsLoadingTracks(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Listen to Firestore `folders` collection for active user
  useEffect(() => {
    if (!user) {
      setFolders([]);
      return;
    }

    const q = query(
      collection(db, "folders"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedFolders: MusicFolder[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name,
            driveFolderId: data.driveFolderId,
            userId: data.userId,
            songCount: data.songCount,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
        });

        loadedFolders.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setFolders(loadedFolders);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "folders");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Listen to Firestore `playlists` collection for active user
  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      return;
    }

    const q = query(
      collection(db, "playlists"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedPlaylists: Playlist[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            name: data.name,
            songIds: data.songIds || [],
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
        });

        loadedPlaylists.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setPlaylists(loadedPlaylists);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "playlists");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Track play count increment listener
  useEffect(() => {
    if (!user) return;
    registerTrackPlayListener((track: MusicTrack) => {
      if (!track?.id) return;
      try {
        const musicRef = doc(db, "music", track.id);
        updateDoc(musicRef, {
          playCount: increment(1),
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          console.warn("Failed to increment play count:", err);
        });
      } catch (err) {
        console.warn("Error incrementing play count:", err);
      }
    });

    return () => {
      registerTrackPlayListener(null);
    };
  }, [user, registerTrackPlayListener]);

  // Google Sign In & App Authentication Handler
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      showToast("Berhasil terhubung ke Google Drive!", "success");
    } catch (err: any) {
      console.error("Login failed:", err);
      showToast(err?.message || "Gagal menghubungkan Google Drive.", "error");
    }
  };

  // Explicit Manual Logout Handler
  const handleLogout = async () => {
    try {
      resetPlayerState();
      await logout();
      showToast("Berhasil keluar dari akun.", "info");
    } catch (err: any) {
      showToast("Gagal keluar.", "error");
    }
  };

  // Upload Batch Handler (supports both single files and complete folders)
  const handleUploadBatch = async (
    files: SelectedUploadFile[],
    updateFileStatus: (
      id: string,
      status: SelectedUploadFile["status"],
      progress: number,
      errorMsg?: string,
      driveId?: string
    ) => void,
    folderName?: string
  ) => {
    if (!user) {
      handleLogin();
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      showToast("Sesi Google Drive kedaluwarsa. Silakan hubungkan kembali.", "error");
      handleLogin();
      return;
    }

    setIsUploading(true);
    let successCount = 0;

    try {
      // 1. Ensure root app folder exists in Drive
      const rootFolderId = await ensureAppFolder(token);
      let targetFolderId = rootFolderId;
      let targetFolderName = "";

      // 2. If upload mode is folder, create/retrieve subfolder inside Google Drive
      if (folderName && folderName.trim()) {
        targetFolderName = folderName.trim();
        const subFolder = await createOrGetSubFolderInDrive(rootFolderId, targetFolderName, token);
        targetFolderId = subFolder.id;

        // Ensure folder record exists in Firestore `folders` collection
        const existingFolder = folders.find((f) => f.driveFolderId === subFolder.id);
        if (!existingFolder) {
          const folderDocRef = doc(collection(db, "folders"));
          await setDoc(folderDocRef, {
            userId: user.uid,
            name: targetFolderName,
            driveFolderId: subFolder.id,
            songCount: files.length,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 3. Upload each file to the designated Google Drive folder
      for (const item of files) {
        updateFileStatus(item.id, "Mengunggah", 5);

        try {
          // Upload file directly to Drive folder
          const driveFile = await uploadAudioFileWithProgress(
            item.file,
            token,
            targetFolderId,
            (progress) => {
              updateFileStatus(item.id, "Mengunggah", progress);
            }
          );

          // Upload cover image to Drive Covers folder if coverBlob exists
          let coverDriveFileId: string | null = null;
          if (item.coverBlob) {
            try {
              const coversFolderId = await getOrCreateCoversFolder(rootFolderId, token);
              const safeCoverFileName = `cover_${Date.now()}_${item.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
              const coverResult = await uploadCoverImageToDrive(
                item.coverBlob,
                safeCoverFileName,
                coversFolderId,
                token
              );
              coverDriveFileId = coverResult.driveFileId;
            } catch (coverErr) {
              console.warn("Cover image upload to Drive was skipped or failed, persisting dataUrl in Firestore:", coverErr);
            }
          }

          // Save metadata to Firestore `music` collection
          const musicDocRef = doc(collection(db, "music"));
          await setDoc(musicDocRef, {
            userId: user.uid,
            title: item.title,
            artist: item.artist,
            album: item.album || (targetFolderName || "Single"),
            year: item.year || null,
            genre: item.genre || null,
            duration: item.duration || 0,
            driveFileId: driveFile.driveFileId,
            driveFolderId: targetFolderId,
            folderName: targetFolderName || null,
            fileName: item.file.name,
            fileSize: item.file.size,
            mimeType: item.file.type || "audio/mpeg",
            format: item.format,
            artworkUrl: item.artworkDataUrl || null,
            coverFileId: coverDriveFileId || item.coverFileId || null,
            coverSource: item.coverSource || (item.artworkDataUrl ? "embedded" : "none"),
            coverUpdatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          updateFileStatus(item.id, "Berhasil", 100, undefined, driveFile.driveFileId);
          successCount++;
        } catch (err: any) {
          console.error("Upload single error:", err);
          updateFileStatus(item.id, "Gagal", 0, err?.message || "Upload gagal");
        }
      }

      if (successCount > 0) {
        setStorageSyncTrigger((prev) => prev + 1);
        if (targetFolderName) {
          showToast(
            `${successCount} lagu berhasil diunggah ke folder "${targetFolderName}" di Google Drive!`,
            "success"
          );
        } else {
          showToast(`${successCount} file musik berhasil diunggah ke Google Drive!`, "success");
        }
      }
    } catch (err: any) {
      console.error("Batch upload error:", err);
      showToast(err?.message || "Terjadi kesalahan saat mengunggah musik.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Open Upload to Folder modal
  const handleOpenFolderUpload = (folder: MusicFolder, files: File[]) => {
    if (!user) {
      handleLogin();
      return;
    }
    setFolderUploadTarget(folder);
    setFolderUploadFiles(files);
    setIsFolderUploadModalOpen(true);
  };

  // Execute Upload into the selected Google Drive folder
  const handleExecuteFolderUpload = async (
    targetFolder: MusicFolder,
    items: FolderUploadItem[],
    updateItemStatus: (
      id: string,
      status: FolderUploadItem["status"],
      progress: number,
      error?: string
    ) => void
  ) => {
    if (!user) {
      handleLogin();
      throw new Error("Anda harus login terlebih dahulu.");
    }
    if (!navigator.onLine) {
      throw new Error("Koneksi internet tidak tersedia. Tidak dapat mengunggah file saat offline.");
    }

    const token = await getAccessToken();
    if (!token) {
      showToast("Sesi Google Drive kedaluwarsa. Silakan hubungkan kembali.", "error");
      handleLogin();
      throw new Error("Sesi Google Drive kedaluwarsa. Silakan hubungkan akun Google Drive.");
    }

    let successCount = 0;
    const rootFolderId = await ensureAppFolder(token);

    for (const item of items) {
      if (item.status === "Berhasil") {
        successCount++;
        continue;
      }

      updateItemStatus(item.id, "Mengunggah", 5);

      try {
        // Upload audio directly to target Google Drive folder
        const driveFile = await uploadAudioFileWithProgress(
          item.file,
          token,
          targetFolder.driveFolderId,
          (progress) => {
            updateItemStatus(item.id, "Mengunggah", progress);
          }
        );

        // Upload album cover if available
        let coverDriveFileId: string | null = null;
        if (item.coverBlob) {
          try {
            const coversFolderId = await getOrCreateCoversFolder(rootFolderId, token);
            const safeCoverFileName = `cover_${Date.now()}_${item.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
            const coverResult = await uploadCoverImageToDrive(
              item.coverBlob,
              safeCoverFileName,
              coversFolderId,
              token
            );
            coverDriveFileId = coverResult.driveFileId;
          } catch (coverErr) {
            console.warn("Cover image upload to Drive failed or skipped:", coverErr);
          }
        }

        // Save track metadata to Firestore `music` collection
        const ext = item.file.name.split(".").pop()?.toUpperCase() || "AUDIO";
        const musicDocRef = doc(collection(db, "music"));
        await setDoc(musicDocRef, {
          userId: user.uid,
          title: item.title,
          artist: item.artist,
          album: item.album || targetFolder.name,
          year: null,
          genre: null,
          duration: item.duration || 0,
          driveFileId: driveFile.driveFileId,
          driveFolderId: targetFolder.driveFolderId,
          folderName: targetFolder.name,
          fileName: item.file.name,
          fileSize: item.file.size,
          mimeType: item.file.type || "audio/mpeg",
          format: ext,
          artworkUrl: item.artworkDataUrl || null,
          coverFileId: coverDriveFileId || null,
          coverSource: item.artworkDataUrl ? "embedded" : "none",
          coverUpdatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        updateItemStatus(item.id, "Berhasil", 100);
        successCount++;
      } catch (err: any) {
        console.error(`Gagal upload lagu "${item.title}":`, err);
        updateItemStatus(item.id, "Gagal", 0, err?.message || "Upload gagal");
      }
    }

    if (successCount > 0) {
      // Update songCount on the folder doc in Firestore
      try {
        const folderDocRef = doc(db, "folders", targetFolder.id);
        await updateDoc(folderDocRef, {
          songCount: increment(successCount),
          updatedAt: serverTimestamp(),
        });
      } catch (fErr) {
        console.warn("Gagal update folder songCount di Firestore:", fErr);
      }

      setStorageSyncTrigger((prev) => prev + 1);
      showToast(
        `${successCount} lagu berhasil diunggah langsung ke folder "${targetFolder.name}"!`,
        "success"
      );
    }
  };

  // Create New Folder Handler (creates Google Drive folder + saves to Firestore)
  const handleCreateFolder = async (folderName: string) => {
    if (!user) {
      throw new Error("Anda harus login terlebih dahulu.");
    }
    if (!navigator.onLine) {
      throw new Error("Koneksi internet tidak tersedia. Tidak dapat membuat folder di Google Drive saat offline.");
    }

    const token = await getAccessToken();
    if (!token) {
      handleLogin();
      throw new Error("Sesi Google Drive kedaluwarsa atau belum terhubung. Silakan hubungkan akun Google Drive.");
    }

    // 1. Determine target parent folder
    const targetParentId = createFolderParent ? createFolderParent.id : await ensureAppFolder(token);

    // 2. Create the folder in Google Drive
    const driveFolder = await createNewFolderInDrive(targetParentId, folderName, token);

    // 3. Save new folder document in Firestore
    const folderDocRef = doc(collection(db, "folders"));
    await setDoc(folderDocRef, {
      userId: user.uid,
      name: folderName,
      driveFolderId: driveFolder.id,
      songCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Feedback
    showToast(`Folder "${folderName}" berhasil dibuat di Google Drive`, "success");
    setStorageSyncTrigger((prev) => prev + 1);
  };

  // Rename Folder Handler (renames Google Drive folder + updates Firestore)
  const handleRenameFolder = async (folder: MusicFolder, newName: string) => {
    if (!user) return;
    const token = await getAccessToken();
    if (!token) {
      showToast("Token Google Drive tidak tersedia. Silakan hubungkan kembali.", "error");
      handleLogin();
      return;
    }

    try {
      // 1. Rename folder on Google Drive
      await renameDriveFolder(folder.driveFolderId, newName, token);

      // 2. Update Firestore `folders` document
      await updateDoc(doc(db, "folders", folder.id), {
        name: newName,
        updatedAt: serverTimestamp(),
      });

      // 3. Update cached folderName on tracks in Firestore that belong to this driveFolderId
      const tracksToUpdate = tracks.filter((t) => t.driveFolderId === folder.driveFolderId);
      for (const t of tracksToUpdate) {
        try {
          await updateDoc(doc(db, "music", t.id), {
            folderName: newName,
            updatedAt: serverTimestamp(),
          });
        } catch (updateErr) {
          console.warn("Track folder name update warning:", updateErr);
        }
      }

      setStorageSyncTrigger((prev) => prev + 1);
      showToast(`Folder berhasil diubah namanya menjadi "${newName}" di Google Drive & Library!`, "success");
    } catch (err: any) {
      console.error("Rename folder failed:", err);
      showToast(err?.message || "Gagal mengubah nama folder di Google Drive.", "error");
      throw err;
    }
  };

  // Delete Folder Handler
  const handleDeleteFolder = async (folder: MusicFolder, deleteFromDrive: boolean) => {
    if (!user) return;

    try {
      // 1. Optional move to trash in Google Drive
      if (deleteFromDrive) {
        const token = await getAccessToken();
        if (token) {
          try {
            await trashDriveFile(folder.driveFolderId, token);
          } catch (driveErr) {
            console.warn("Drive trash warning for folder:", driveErr);
          }
        }
      }

      // 2. Delete folder doc from Firestore
      await deleteDoc(doc(db, "folders", folder.id));
      setStorageSyncTrigger((prev) => prev + 1);
      showToast(`Folder "${folder.name}" dihapus dari Library.`, "success");
    } catch (err: any) {
      console.error("Delete folder error:", err);
      showToast("Gagal menghapus folder.", "error");
    }
  };

  // Delete Track Handler (moves to trash in Drive & deletes from Firestore)
  const handleConfirmDeleteTrack = async (track: MusicTrack) => {
    if (!user) return;

    try {
      const token = await getAccessToken();
      if (token && track.driveFileId) {
        try {
          await trashDriveFile(track.driveFileId, token);
        } catch (driveErr) {
          console.warn("Drive trash warning:", driveErr);
        }
      }

      // Delete from Firestore
      await deleteDoc(doc(db, "music", track.id));

      // Remove from any playlists referencing this track
      for (const pl of playlists) {
        if (pl.songIds.includes(track.id)) {
          const updatedSongIds = pl.songIds.filter((id) => id !== track.id);
          await updateDoc(doc(db, "playlists", pl.id), {
            songIds: updatedSongIds,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setStorageSyncTrigger((prev) => prev + 1);
      showToast("Lagu berhasil dihapus.", "success");
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast("Gagal menghapus lagu.", "error");
    }
  };

  // Edit Metadata Handler (including Cover Album support)
  const handleSaveMetadata = async (
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
  ) => {
    try {
      const docUpdates: any = {
        title: updates.title,
        artist: updates.artist,
        updatedAt: serverTimestamp(),
      };

      if (updates.album) {
        docUpdates.album = updates.album;
      } else {
        docUpdates.album = deleteField();
      }

      if (updates.year) {
        docUpdates.year = updates.year;
      } else {
        docUpdates.year = deleteField();
      }

      if (updates.genre) {
        docUpdates.genre = updates.genre;
      } else {
        docUpdates.genre = deleteField();
      }

      // If a new coverBlob was provided, try uploading to Drive Covers folder
      let uploadedCoverFileId = updates.coverFileId;
      if (updates.coverBlob) {
        const token = await getAccessToken();
        if (token) {
          try {
            const rootFolderId = await ensureAppFolder(token);
            const coversFolderId = await getOrCreateCoversFolder(rootFolderId, token);
            const safeCoverFileName = `cover_${Date.now()}_${updates.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
            const coverRes = await uploadCoverImageToDrive(
              updates.coverBlob,
              safeCoverFileName,
              coversFolderId,
              token
            );
            uploadedCoverFileId = coverRes.driveFileId;
          } catch (coverErr) {
            console.warn("Cover image upload to Drive failed, continuing with Firestore dataUrl sync:", coverErr);
          }
        }
      }

      if (updates.artworkUrl) {
        docUpdates.artworkUrl = updates.artworkUrl;
        docUpdates.coverSource = updates.coverSource || "manual";
        docUpdates.coverUpdatedAt = serverTimestamp();
        if (uploadedCoverFileId) {
          docUpdates.coverFileId = uploadedCoverFileId;
        }
      } else if (updates.artworkUrl === null) {
        // User explicitly removed cover
        docUpdates.artworkUrl = deleteField();
        docUpdates.coverFileId = deleteField();
        docUpdates.coverSource = "none";
        docUpdates.coverUpdatedAt = serverTimestamp();
      }

      await updateDoc(doc(db, "music", trackId), docUpdates);
      showToast("Metadata dan cover album berhasil diperbarui.", "success");
    } catch (err: any) {
      console.error("Update metadata error:", err);
      showToast("Gagal memperbarui metadata lagu.", "error");
    }
  };

  // Playlist handlers
  const handleCreatePlaylist = async (name: string) => {
    if (!user) return;
    try {
      const newDocRef = doc(collection(db, "playlists"));
      await setDoc(newDocRef, {
        userId: user.uid,
        name,
        songIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(`Playlist "${name}" dibuat.`, "success");
    } catch (err) {
      showToast("Gagal membuat playlist.", "error");
    }
  };

  const handleRenamePlaylist = async (playlistId: string, newName: string) => {
    try {
      await updateDoc(doc(db, "playlists", playlistId), {
        name: newName,
        updatedAt: serverTimestamp(),
      });
      showToast(`Playlist diubah namanya menjadi "${newName}".`, "success");
    } catch (err) {
      showToast("Gagal mengubah nama playlist.", "error");
    }
  };

  const handleDeletePlaylist = async (playlist: Playlist) => {
    try {
      await deleteDoc(doc(db, "playlists", playlist.id));
      showToast(`Playlist "${playlist.name}" dihapus.`, "success");
    } catch (err) {
      showToast("Gagal menghapus playlist.", "error");
    }
  };

  const handleAddSongToPlaylist = async (playlistId: string, trackId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    if (pl.songIds.includes(trackId)) {
      showToast("Lagu sudah ada di playlist ini.", "info");
      return;
    }

    try {
      const updated = [...pl.songIds, trackId];
      await updateDoc(doc(db, "playlists", playlistId), {
        songIds: updated,
        updatedAt: serverTimestamp(),
      });
      showToast("Lagu berhasil ditambahkan ke playlist.", "success");
    } catch (err) {
      showToast("Gagal menambahkan lagu ke playlist.", "error");
    }
  };

  const handleCreateAndAddSong = async (playlistName: string, trackId: string) => {
    if (!user) return;
    try {
      const newDocRef = doc(collection(db, "playlists"));
      await setDoc(newDocRef, {
        userId: user.uid,
        name: playlistName,
        songIds: [trackId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast("Lagu berhasil ditambahkan ke playlist.", "success");
    } catch (err) {
      showToast("Gagal membuat playlist.", "error");
    }
  };

  const handleRemoveSongFromPlaylist = async (playlistId: string, trackId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    try {
      const updated = pl.songIds.filter((id) => id !== trackId);
      await updateDoc(doc(db, "playlists", playlistId), {
        songIds: updated,
        updatedAt: serverTimestamp(),
      });
      showToast("Dihapus dari playlist.", "info");
    } catch (err) {
      showToast("Gagal menghapus lagu dari playlist.", "error");
    }
  };

  const handleReorderPlaylistSongs = async (playlistId: string, newSongIds: string[]) => {
    try {
      await updateDoc(doc(db, "playlists", playlistId), {
        songIds: newSongIds,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      showToast("Gagal menyusun ulang playlist.", "error");
    }
  };

  // Toggle favorite status for a track
  const handleToggleFavorite = async (track: MusicTrack) => {
    if (!track?.id) return;
    const newFavStatus = !track.isFavorite;

    // Optimistic UI update
    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, isFavorite: newFavStatus } : t))
    );

    if (currentTrack?.id === track.id) {
      updateTrackInContext({ ...currentTrack, isFavorite: newFavStatus });
    }

    try {
      const musicRef = doc(db, "music", track.id);
      await updateDoc(musicRef, {
        isFavorite: newFavStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(
        newFavStatus
          ? `❤️ "${track.title}" ditambahkan ke Favorit.`
          : `"${track.title}" dihapus dari Favorit.`,
        "info"
      );
    } catch (err: any) {
      // Rollback on error
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, isFavorite: !newFavStatus } : t))
      );
      showToast("Gagal memperbarui status favorit.", "error");
    }
  };

  // Move track to another existing folder, create new folder & move, or move to Root
  const handleMoveTrackToFolder = async (
    track: MusicTrack,
    targetFolder: MusicFolder | null,
    newFolderName?: string
  ) => {
    try {
      let token = await getAccessToken();
      if (!token) {
        await reconnectGoogleDrive();
        token = await getAccessToken();
      }
      if (!token) {
        throw new Error("Koneksi Google Drive diperlukan untuk memindahkan file lagu.");
      }

      // Root application folder in Google Drive
      const rootFolderId = await ensureAppFolder(token);

      let targetDriveFolderId = rootFolderId;
      let targetFolderName: string | undefined = undefined;

      // Case A: User creates a new folder inline and moves track into it
      if (newFolderName && newFolderName.trim()) {
        const trimmedName = newFolderName.trim();
        const createdSubFolder = await createOrGetSubFolderInDrive(
          rootFolderId,
          trimmedName,
          token
        );
        targetDriveFolderId = createdSubFolder.id;
        targetFolderName = createdSubFolder.name;

        // Check if folder exists in Firestore folders collection, otherwise create it
        if (user) {
          const existing = folders.find(
            (f) => f.name.toLowerCase() === trimmedName.toLowerCase()
          );
          if (!existing) {
            const folderDocRef = doc(collection(db, "folders"));
            await setDoc(folderDocRef, {
              userId: user.uid,
              name: trimmedName,
              driveFolderId: targetDriveFolderId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } else if (targetFolder) {
        // Case B: Move to existing subfolder
        targetDriveFolderId = targetFolder.driveFolderId;
        targetFolderName = targetFolder.name;
      } else {
        // Case C: Move to Root folder (tanpa subfolder)
        targetDriveFolderId = rootFolderId;
        targetFolderName = undefined;
      }

      // 1. Move file location directly in Google Drive API (preserves file ID, zero duplication)
      await moveDriveFileToFolder(track.driveFileId, targetDriveFolderId, token);

      // 2. Update Firestore record
      const nowStr = new Date().toISOString();
      const trackDocRef = doc(db, "music", track.id);

      const updateData: any = {
        driveFolderId: targetDriveFolderId,
        updatedAt: serverTimestamp(),
      };
      if (targetFolderName) {
        updateData.folderName = targetFolderName;
      } else {
        updateData.folderName = deleteField();
      }

      await updateDoc(trackDocRef, updateData);

      // 3. Update local state
      const updatedTrack: MusicTrack = {
        ...track,
        driveFolderId: targetDriveFolderId,
        folderName: targetFolderName,
        updatedAt: nowStr,
      };

      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? updatedTrack : t))
      );

      // 4. Update track in MusicPlayerContext if currently active or in queue
      updateTrackInContext(updatedTrack);

      setStorageSyncTrigger((prev) => prev + 1);
      const destLabel = targetFolderName ? `folder "${targetFolderName}"` : "Folder Utama (Root)";
      showToast(`Lagu "${track.title}" berhasil dipindahkan ke ${destLabel}. File di Google Drive tersinkronisasi.`, "success");
    } catch (err: any) {
      console.error("Move track to folder error:", err);
      showToast(err?.message || "Gagal memindahkan lagu ke folder.", "error");
      throw err;
    }
  };

  // Reset entire application data (tracks, folders, playlists, queue, state & caches)
  const handleResetAllAppData = async () => {
    try {
      setIsResetting(true);

      // 1. Delete all Firestore records belonging to this user
      if (user) {
        // Query music collection
        const musicQuery = query(collection(db, "music"), where("userId", "==", user.uid));
        const musicSnap = await getDocs(musicQuery);

        // Query folders collection
        const folderQuery = query(collection(db, "folders"), where("userId", "==", user.uid));
        const folderSnap = await getDocs(folderQuery);

        // Query playlists collection
        const playlistQuery = query(collection(db, "playlists"), where("userId", "==", user.uid));
        const playlistSnap = await getDocs(playlistQuery);

        const allDocRefs = [
          ...musicSnap.docs.map((d) => d.ref),
          ...folderSnap.docs.map((d) => d.ref),
          ...playlistSnap.docs.map((d) => d.ref),
        ];

        // Delete documents in batches (up to 450 per batch)
        const BATCH_SIZE = 450;
        for (let i = 0; i < allDocRefs.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = allDocRefs.slice(i, i + BATCH_SIZE);
          chunk.forEach((ref) => batch.delete(ref));
          await batch.commit();
        }
      }

      // 2. Reset audio player state and player localStorage
      resetPlayerState();

      // 3. Clear any remaining application localStorage caches
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith("drive_music_") ||
              key.startsWith("gdrive_") ||
              key.includes("music") ||
              key.includes("scan") ||
              key.includes("track"))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        console.warn("Storage cleanup notice:", e);
      }

      // 4. Reset local React state to 0
      setTracks([]);
      setFolders([]);
      setPlaylists([]);
      setGlobalSearch("");
      setIsResetAppModalOpen(false);

      showToast("Seluruh isi aplikasi berhasil direset (0 data).", "success");
    } catch (err: any) {
      console.error("Reset application data error:", err);
      showToast(err?.message || "Gagal mereset data aplikasi.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Next in queue items (for desktop right side panel)
  const nextInQueueTracks = React.useMemo(() => {
    if (!currentTrack || queue.length === 0) return [];
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) return queue.slice(0, 3);
    return queue.slice(currentIndex + 1, currentIndex + 4);
  }, [currentTrack, queue]);

  // Total tracks size formatted
  const totalStorageApprox = React.useMemo(() => {
    const totalBytes = tracks.reduce((acc, t) => acc + (t.fileSize || 0), 0);
    const mb = totalBytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  }, [tracks]);

  // Loading Splash Screen while checking and restoring persistent auth session
  if (!isAuthReady) {
    return (
      <div
        id="app-auth-loading-screen"
        className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center select-none"
      >
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 animate-pulse">
            <Music className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Drive Music</h2>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Memulihkan sesi login & memuat koleksi musik...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id="app-root"
      className="h-[100dvh] h-screen bg-[#F8FAFC] flex flex-col text-slate-900 font-sans max-w-full overflow-hidden box-border"
    >
      {/* Top Navbar with search and Sleek Interface header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        hasGoogleAuth={hasGoogleDriveAuth}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOnline={isOnline}
        isLoggingIn={isLoggingIn}
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
      />

      {/* PWA Install Banner for Mobile / Android devices */}
      <InstallPwaBanner />

      {/* Main Body Layout: Left Sidebar (Desktop) + Center Main + Right Now Playing (Wide Screens) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Left Sidebar */}
        <aside
          id="desktop-sidebar"
          className="w-64 bg-white border-r border-slate-200 p-6 hidden lg:flex flex-col shrink-0 space-y-4"
        >
          <nav className="space-y-1">
            <button
              onClick={() => setCurrentTab("library")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${
                currentTab === "library"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Music className="w-5 h-5" />
              <span>Library</span>
            </button>

            <button
              onClick={() => setCurrentTab("playlist")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${
                currentTab === "playlist"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <ListMusic className="w-5 h-5" />
              <span>Playlists</span>
            </button>

            <button
              onClick={() => setCurrentTab("upload")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left cursor-pointer ${
                currentTab === "upload"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Upload className="w-5 h-5" />
              <span>Upload Musik</span>
            </button>
          </nav>

          {/* Install to Android / Desktop card if installable */}
          {canInstall && !isInstalled && !isStandalone && (
            <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200/80 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-blue-900 text-xs font-bold">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Install di Android</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-tight">
                Akses lebih cepat langsung dari Home Screen tanpa address bar browser.
              </p>
              <button
                onClick={promptInstall}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Aplikasi</span>
              </button>
            </div>
          )}

          {/* Google Drive Storage Usage Card with Real Google Drive API Quota */}
          <div className="mt-auto pt-2">
            <DriveStorageCard
              onReconnect={reconnectGoogleDrive}
              syncTrigger={storageSyncTrigger}
            />
          </div>
        </aside>

        {/* Center Main Content Area */}
        <main
          id="main-content"
          className={`flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full box-border ${
            !user
              ? "p-3.5 sm:p-6 lg:p-8 overflow-y-auto"
              : currentTab === "library"
              ? "p-3 sm:p-5 lg:p-6 overflow-hidden"
              : "p-3.5 sm:p-6 lg:p-8 overflow-y-auto pb-[calc(185px+env(safe-area-inset-bottom,0px))] md:pb-28"
          }`}
        >
          {!user ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs max-w-2xl mx-auto my-6 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-500/20">
                <Music className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                  Drive Music Player
                </h2>
                <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto leading-relaxed">
                  Putar koleksi musik dan folder lagu pribadi Anda langsung dari Google Drive dengan streaming cepat dan background playback.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <HardDrive className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="text-xs font-bold text-slate-800">Upload Folder</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Unggah seluruh folder musik sekaligus dengan sinkronisasi Drive.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Music className="w-5 h-5 text-indigo-600 mb-2" />
                  <h4 className="text-xs font-bold text-slate-800">Background Play</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Musik tetap berputar saat berpindah tab atau mengunci layar.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <ListMusic className="w-5 h-5 text-emerald-600 mb-2" />
                  <h4 className="text-xs font-bold text-slate-800">Play All Folder</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Putar seluruh lagu dalam folder dengan 1 kali klik.
                  </p>
                </div>
              </div>

              <button
                id="btn-hero-connect-google"
                disabled={isLoggingIn}
                onClick={handleLogin}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <HardDrive className="w-4 h-4" />
                <span>{isLoggingIn ? "Menghubungkan..." : "Hubungkan Akun Google Drive"}</span>
              </button>
            </div>
          ) : (
            <>
              {isReauthNeeded && (
                <div
                  id="reauth-notice-banner"
                  className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800 shrink-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate">Sesi Google Drive perlu diperbarui untuk streaming lagu online.</span>
                  </div>
                  <button
                    onClick={reconnectGoogleDrive}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold rounded-lg transition-all text-xs shrink-0 cursor-pointer"
                  >
                    Hubungkan Kembali
                  </button>
                </div>
              )}

              {currentTab === "library" && (
                <LibraryView
                  tracks={tracks}
                  folders={folders}
                  isLoading={isLoadingTracks}
                  onUploadClick={() => setCurrentTab("upload")}
                  onUploadToFolder={handleOpenFolderUpload}
                  onCreateFolderClick={(parent) => {
                    setCreateFolderParent(parent ? { id: parent.driveFolderId, name: parent.name } : null);
                    setIsCreateFolderOpen(true);
                  }}
                  onAddToPlaylistClick={(track) => setAddToPlaylistTrack(track)}
                  onMoveToFolderClick={(track) => setMoveToFolderTrack(track)}
                  onEditMetadataClick={(track) => setEditMetadataTrack(track)}
                  onDeleteTrackClick={(track) => setDeleteTrack(track)}
                  onRenameFolderClick={(f) => setRenameFolder(f)}
                  onDeleteFolderClick={(f) => setDeleteFolder(f)}
                  onToggleFavorite={handleToggleFavorite}
                  searchQuery={globalSearch}
                  onSearchChange={setGlobalSearch}
                />
              )}

              {currentTab === "playlist" && (
                <PlaylistView
                  playlists={playlists}
                  tracks={tracks}
                  onCreatePlaylist={handleCreatePlaylist}
                  onRenamePlaylist={handleRenamePlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onRemoveSongFromPlaylist={handleRemoveSongFromPlaylist}
                  onReorderPlaylistSongs={handleReorderPlaylistSongs}
                  onOpenLibrary={() => setCurrentTab("library")}
                />
              )}

              {currentTab === "upload" && (
                <UploadView
                  onUploadBatch={handleUploadBatch}
                  isUploading={isUploading}
                  hasGoogleAuth={hasGoogleDriveAuth}
                  onConnectGoogle={reconnectGoogleDrive}
                />
              )}
            </>
          )}
        </main>

        {/* Desktop Right Aside: Now Playing Spotlight & Up Next (Visible on Large Screens) */}
        {user && currentTrack && (
          <aside
            id="desktop-right-aside"
            className="w-80 bg-white border-l border-slate-200 hidden xl:flex flex-col shrink-0 p-6 overflow-y-auto"
          >
            <div className="flex flex-col items-center text-center">
              {/* Large Cover Art with Sleek styling */}
              <div className="w-48 h-48 bg-slate-100 rounded-2xl shadow-lg mb-5 flex items-center justify-center overflow-hidden border border-slate-200">
                {currentTrack.artworkUrl ? (
                  <img
                    src={currentTrack.artworkUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white">
                    <Music className="w-20 h-20" />
                  </div>
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-800 truncate w-full px-2">
                {currentTrack.title}
              </h3>
              <p className="text-sm text-slate-500 font-medium truncate w-full px-2 mt-0.5">
                {currentTrack.artist || "Artis Tidak Diketahui"}
              </p>
              <p className="text-xs text-slate-400 mt-1 truncate w-full px-2">
                {currentTrack.folderName ? `Folder: ${currentTrack.folderName}` : currentTrack.album || "Single"}
              </p>
            </div>

            {/* Next in Queue Section */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Berikutnya dalam Antrean</span>
                <button
                  onClick={() => setIsQueueOpen(true)}
                  className="text-blue-600 hover:text-blue-700 text-xs font-semibold cursor-pointer"
                >
                  Lihat Semua ({queue.length})
                </button>
              </div>

              {nextInQueueTracks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Tidak ada lagu berikutnya</p>
              ) : (
                <div className="space-y-3">
                  {nextInQueueTracks.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => playTrack(item)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer group transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80 flex items-center justify-center">
                        {item.artworkUrl ? (
                          <img
                            src={item.artworkUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {item.artist || "Artis Tidak Diketahui"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Mini Player */}
      <MiniPlayer onToggleFavorite={handleToggleFavorite} />

      {/* Mobile Bottom Navigation */}
      <MobileNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Now Playing Fullscreen Modal */}
      <NowPlayingModal
        onAddToPlaylist={() => {
          if (currentTrack) {
            setAddToPlaylistTrack(currentTrack);
          }
        }}
      />

      {/* Queue Drawer */}
      <QueueDrawer />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        track={addToPlaylistTrack}
        playlists={playlists}
        onClose={() => setAddToPlaylistTrack(null)}
        onAddToPlaylist={handleAddSongToPlaylist}
        onCreateAndAdd={handleCreateAndAddSong}
      />

      {/* Move To Folder Modal */}
      <MoveToFolderModal
        isOpen={Boolean(moveToFolderTrack)}
        track={moveToFolderTrack}
        folders={folders}
        onClose={() => setMoveToFolderTrack(null)}
        onMoveToFolder={handleMoveTrackToFolder}
      />

      {/* Edit Metadata Modal */}
      <EditMetadataModal
        track={editMetadataTrack}
        onClose={() => setEditMetadataTrack(null)}
        onSaveMetadata={handleSaveMetadata}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        track={deleteTrack}
        onClose={() => setDeleteTrack(null)}
        onConfirmDelete={handleConfirmDeleteTrack}
      />

      {/* Create New Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setCreateFolderParent(null);
        }}
        existingFolderNames={folders.map((f) => f.name)}
        currentParentName={createFolderParent?.name}
        onCreateFolder={handleCreateFolder}
      />

      {/* Rename Folder Modal */}
      <RenameFolderModal
        isOpen={Boolean(renameFolder)}
        folder={renameFolder}
        onClose={() => setRenameFolder(null)}
        onRename={handleRenameFolder}
      />

      {/* Delete Folder Modal */}
      <DeleteFolderModal
        folder={deleteFolder}
        onClose={() => setDeleteFolder(null)}
        onConfirmDelete={handleDeleteFolder}
      />

      {/* Upload Music to Specific Folder Modal */}
      <FolderUploadModal
        isOpen={isFolderUploadModalOpen}
        folder={folderUploadTarget}
        files={folderUploadFiles}
        onClose={() => {
          setIsFolderUploadModalOpen(false);
          setFolderUploadTarget(null);
          setFolderUploadFiles([]);
        }}
        onExecuteUpload={handleExecuteFolderUpload}
      />

      {/* Integration Settings Modal */}
      <IntegrationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        hasGoogleAuth={hasGoogleDriveAuth}
        onReconnectGoogle={reconnectGoogleDrive}
        isOnline={isOnline}
        onOpenResetModal={() => setIsResetAppModalOpen(true)}
      />

      {/* Reset Application Data Modal (0 Data) */}
      <ResetAppDataModal
        isOpen={isResetAppModalOpen}
        onClose={() => setIsResetAppModalOpen(false)}
        onConfirmReset={handleResetAllAppData}
        isResetting={isResetting}
        totalTracks={tracks.length}
        totalFolders={folders.length}
        totalPlaylists={playlists.length}
      />

      {/* Audio Equalizer Modal */}
      <EqualizerModal />

      {/* Sleep Timer Modal */}
      <SleepTimerModal />

      {/* PWA Update Notification Toast */}
      <PwaUpdateNotification />

      {/* Offline Download Offer Banner when Online Stream Fails */}
      <OfflineDownloadOfferBanner />

      {/* Android PWA Install Step-by-Step Guide Modal */}
      <InstallGuideModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <PwaProvider>
        <AuthProvider>
          <MusicPlayerProvider>
            <EqualizerProvider>
              <SleepTimerProvider>
                <MainAppContent />
              </SleepTimerProvider>
            </EqualizerProvider>
          </MusicPlayerProvider>
        </AuthProvider>
      </PwaProvider>
    </ToastProvider>
  );
}
