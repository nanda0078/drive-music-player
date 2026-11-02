const APP_FOLDER_NAME = "Drive Music Player";
let cachedAppFolderId: string | null = null;

/**
 * Searches or creates the root "Drive Music Player" application folder in Google Drive.
 */
export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  if (cachedAppFolderId) return cachedAppFolderId;

  try {
    // Search for existing root app folder
    const query = `name = '${APP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchRes.ok) {
      const err = await searchRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal mencari folder aplikasi: ${searchRes.status}`);
    }

    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      cachedAppFolderId = data.files[0].id;
      return cachedAppFolderId!;
    }

    // Create new root folder if not exists
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        description: "Folder penyimpanan musik otomatis untuk Drive Music Player",
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal membuat folder aplikasi: ${createRes.status}`);
    }

    const newFolder = await createRes.json();
    cachedAppFolderId = newFolder.id;
    return cachedAppFolderId!;
  } catch (error: any) {
    console.error("Root folder lookup/creation failed:", error);
    throw error;
  }
}

/**
 * Creates or retrieves a subfolder inside a parent Google Drive folder (e.g. Drive Music Player / <folderName>).
 */
export async function createOrGetSubFolderInDrive(
  parentFolderId: string,
  folderName: string,
  accessToken: string
): Promise<{ id: string; name: string }> {
  try {
    const cleanName = folderName.trim().replace(/'/g, "\\'");
    const query = `name = '${cleanName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return {
          id: data.files[0].id,
          name: data.files[0].name,
        };
      }
    }

    // Create subfolder
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName.trim(),
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal membuat subfolder Google Drive: ${createRes.status}`);
    }

    const newFolder = await createRes.json();
    return {
      id: newFolder.id,
      name: newFolder.name,
    };
  } catch (error: any) {
    console.error("Subfolder creation error:", error);
    throw error;
  }
}

/**
 * Creates a brand new folder inside a parent Google Drive folder.
 * Validates that no existing active folder with the same name exists in that parent.
 */
export async function createNewFolderInDrive(
  parentFolderId: string,
  folderName: string,
  accessToken: string
): Promise<{ id: string; name: string }> {
  try {
    const trimmed = folderName.trim();
    if (!trimmed) {
      throw new Error("Nama folder tidak boleh kosong.");
    }

    const cleanName = trimmed.replace(/'/g, "\\'");
    const query = `name = '${cleanName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        throw new Error(`Folder dengan nama "${trimmed}" sudah ada di lokasi Google Drive ini.`);
      }
    }

    // Create folder using Google Drive API v3
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: trimmed,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
        description: "Folder musik dibuat dari Drive Music Player",
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      if (createRes.status === 401) {
        throw new Error("Sesi Google Drive telah kedaluwarsa. Silakan hubungkan ulang akun Anda.");
      }
      if (createRes.status === 403) {
        throw new Error(
          err.error?.message?.includes("storage") || err.error?.message?.includes("quota")
            ? "Kapasitas penyimpanan Google Drive Anda tidak mencukupi."
            : "Izin akses Google Drive ditolak atau tidak mencukupi."
        );
      }
      throw new Error(err.error?.message || `Gagal membuat folder di Google Drive (${createRes.status}).`);
    }

    const newFolder = await createRes.json();
    return {
      id: newFolder.id,
      name: newFolder.name,
    };
  } catch (error: any) {
    console.error("[DriveService] Create new folder failed:", error);
    throw error;
  }
}

/**
 * Renames a Google Drive folder by Drive Folder ID without moving or re-uploading any files inside it.
 */
export async function renameDriveFolder(
  driveFolderId: string,
  newName: string,
  accessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFolderId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName.trim(),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Rename folder error from Google Drive:", err);
      throw new Error(err.error?.message || `Gagal mengubah nama folder di Google Drive (${res.status})`);
    }

    return true;
  } catch (err: any) {
    console.error("renameDriveFolder failed:", err);
    throw err;
  }
}

export interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Resumable upload of audio file to specified Google Drive folder.
 */
export function uploadFileToDrive(
  file: File,
  accessToken: string,
  folderId: string,
  onProgress?: UploadProgressCallback
): Promise<{ driveFileId: string; fileName: string; mimeType: string; size: number }> {
  return new Promise((resolve, reject) => {
    // Step 1: Initiate Resumable Upload
    const metadata = {
      name: file.name,
      mimeType: file.type || "audio/mpeg",
      parents: [folderId],
    };

    fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "audio/mpeg",
        "X-Upload-Content-Length": file.size.toString(),
      },
      body: JSON.stringify(metadata),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.error?.message || `Inisialisasi upload gagal (${res.status})`);
          });
        }
        const location = res.headers.get("Location");
        if (!location) {
          throw new Error("Tidak menerima URL sesi upload dari Google Drive.");
        }
        return location;
      })
      .then((sessionUrl) => {
        // Step 2: Upload file data with XMLHttpRequest for accurate progress
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", sessionUrl, true);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress(Math.min(percent, 99)); // Keep 99 until server responds
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              if (onProgress) onProgress(100);
              resolve({
                driveFileId: result.id,
                fileName: result.name || file.name,
                mimeType: result.mimeType || file.type || "audio/mpeg",
                size: file.size,
              });
            } catch {
              reject(new Error("Format respons Drive tidak valid."));
            }
          } else {
            let errorMsg = `Upload gagal dengan status ${xhr.status}`;
            try {
              const errObj = JSON.parse(xhr.responseText);
              if (errObj.error?.message) errorMsg = errObj.error.message;
            } catch {}
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Terjadi kesalahan jaringan saat mengunggah ke Google Drive."));
        };

        xhr.ontimeout = () => {
          reject(new Error("Waktu koneksi habis saat mengunggah musik."));
        };

        xhr.send(file);
      })
      .catch(reject);
  });
}

/**
 * Move file to Trash in Google Drive.
 */
export async function moveDriveFileToTrash(driveFileId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trashed: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("Trash operation warning:", err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error moving file to trash:", err);
    return false;
  }
}

/**
 * Moves a file in Google Drive from its current parent folder to a target parent folder.
 * This preserves the file's ID, avoiding file duplication and syncing its location in Google Drive.
 */
export async function moveDriveFileToFolder(
  driveFileId: string,
  targetDriveFolderId: string,
  accessToken: string
): Promise<boolean> {
  try {
    // 1. Retrieve the existing parents of the file
    const getRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=parents`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    let previousParents = "";
    if (getRes.ok) {
      const fileData = await getRes.json();
      if (fileData.parents && Array.isArray(fileData.parents)) {
        previousParents = fileData.parents.join(",");
      }
    }

    // 2. Move file by specifying addParents and removeParents query parameters
    const updateUrl = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`
    );
    updateUrl.searchParams.set("addParents", targetDriveFolderId);
    if (previousParents) {
      updateUrl.searchParams.set("removeParents", previousParents);
    }
    updateUrl.searchParams.set("fields", "id,parents");

    const patchRes = await fetch(updateUrl.toString(), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}));
      console.error("Google Drive move file failed:", err);
      throw new Error(
        err.error?.message || `Gagal memindahkan file di Google Drive (${patchRes.status})`
      );
    }

    return true;
  } catch (err: any) {
    console.error("moveDriveFileToFolder error:", err);
    throw err;
  }
}

let cachedCoversFolderId: string | null = null;

/**
 * Creates or retrieves the structured "Covers" folder inside Drive Music Player/Covers
 */
export async function getOrCreateCoversFolder(
  rootFolderId: string,
  accessToken: string
): Promise<string> {
  if (cachedCoversFolderId) return cachedCoversFolderId;

  try {
    const subFolder = await createOrGetSubFolderInDrive(rootFolderId, "Covers", accessToken);
    cachedCoversFolderId = subFolder.id;
    return cachedCoversFolderId;
  } catch (err) {
    console.warn("Failed to get/create Covers folder, using root folder as fallback:", err);
    return rootFolderId;
  }
}

/**
 * Uploads a cover image file or blob to the designated Google Drive Covers folder.
 */
export async function uploadCoverImageToDrive(
  imageBlob: Blob,
  fileName: string,
  coversFolderId: string,
  accessToken: string
): Promise<{ driveFileId: string; name: string }> {
  const metadata = {
    name: fileName,
    mimeType: imageBlob.type || "image/jpeg",
    parents: [coversFolderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" })
  );
  form.append("file", imageBlob);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal mengunggah cover ke Google Drive (${res.status})`);
  }

  const result = await res.json();
  return {
    driveFileId: result.id,
    name: result.name || fileName,
  };
}

export const ensureAppFolder = getOrCreateAppFolder;
export const uploadAudioFileWithProgress = uploadFileToDrive;
export const trashDriveFile = moveDriveFileToTrash;

/**
 * Google Drive Storage Quota Data Contract
 */
export interface DriveStorageQuota {
  usage: number; // bytes
  limit: number | null; // bytes or null (unlimited/unknown)
  usageInDrive: number;
  usageInDriveTrash: number;
  usageGB: number;
  limitGB: number | null;
  usagePercent: number | null;
  timestamp: number;
}

const STORAGE_QUOTA_CACHE_KEY = "gdrive_music_storage_quota_cache";
const STORAGE_QUOTA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function clearDriveStorageQuotaCache(): void {
  try {
    sessionStorage.removeItem(STORAGE_QUOTA_CACHE_KEY);
    localStorage.removeItem(STORAGE_QUOTA_CACHE_KEY);
  } catch {}
}

/**
 * Fetches Google Drive storage quota using Google Drive API v3:
 * GET https://www.googleapis.com/drive/v3/about?fields=storageQuota
 * Converts bytes to GB using division by 1,000,000,000.
 */
export async function fetchDriveStorageQuota(
  accessToken: string,
  forceRefresh: boolean = false
): Promise<DriveStorageQuota> {
  // 1. Check lightweight cache
  if (!forceRefresh) {
    try {
      const cached =
        sessionStorage.getItem(STORAGE_QUOTA_CACHE_KEY) ||
        localStorage.getItem(STORAGE_QUOTA_CACHE_KEY);
      if (cached) {
        const parsed: DriveStorageQuota = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < STORAGE_QUOTA_CACHE_TTL_MS) {
          return parsed;
        }
      }
    } catch {}
  }

  // 2. Fetch directly with fallback to server proxy
  let rawData: any = null;

  try {
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok) {
      rawData = await res.json();
    } else {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) {
        const tokenErr = new Error("Token Google Drive kedaluwarsa.");
        (tokenErr as any).code = "token_expired";
        throw tokenErr;
      }
      throw new Error(errMsg);
    }
  } catch (directErr: any) {
    if (directErr?.code === "token_expired") {
      throw directErr;
    }

    // Attempt local proxy fallback
    try {
      const proxyRes = await fetch(
        `/api/drive/storage-quota?token=${encodeURIComponent(accessToken)}`
      );
      if (proxyRes.ok) {
        rawData = await proxyRes.json();
      } else {
        const pErr = await proxyRes.json().catch(() => ({}));
        if (proxyRes.status === 401) {
          const tokenErr = new Error("Token Google Drive kedaluwarsa.");
          (tokenErr as any).code = "token_expired";
          throw tokenErr;
        }
        throw new Error(pErr?.error || `HTTP ${proxyRes.status}`);
      }
    } catch (proxyErr: any) {
      throw directErr || proxyErr;
    }
  }

  const quota = rawData?.storageQuota;
  if (!quota) {
    throw new Error("Data storageQuota tidak ditemukan dalam respon Google Drive.");
  }

  // 3. Mathematical conversion as requested:
  // Convert bytes to GB using 1,000,000,000.
  // Percentage = (usage / limit) * 100.
  // If limit is not available or 0, capacity is unknown and no false percentage is generated.
  const rawUsage = quota.usage != null ? Number(quota.usage) : 0;
  const rawLimit =
    quota.limit != null && Number(quota.limit) > 0 ? Number(quota.limit) : null;
  const rawUsageInDrive = quota.usageInDrive != null ? Number(quota.usageInDrive) : 0;
  const rawUsageInDriveTrash =
    quota.usageInDriveTrash != null ? Number(quota.usageInDriveTrash) : 0;

  const usageGB = rawUsage / 1_000_000_000;
  const limitGB = rawLimit !== null ? rawLimit / 1_000_000_000 : null;
  const usagePercent =
    limitGB !== null && limitGB > 0
      ? Math.min(100, Math.max(0, (rawUsage / rawLimit!) * 100))
      : null;

  const result: DriveStorageQuota = {
    usage: rawUsage,
    limit: rawLimit,
    usageInDrive: rawUsageInDrive,
    usageInDriveTrash: rawUsageInDriveTrash,
    usageGB,
    limitGB,
    usagePercent,
    timestamp: Date.now(),
  };

  // Cache in storage
  try {
    const jsonStr = JSON.stringify(result);
    sessionStorage.setItem(STORAGE_QUOTA_CACHE_KEY, jsonStr);
    localStorage.setItem(STORAGE_QUOTA_CACHE_KEY, jsonStr);
  } catch {}

  return result;
}


