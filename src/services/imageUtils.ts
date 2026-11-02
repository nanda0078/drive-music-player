/**
 * Image processing utilities for Drive Music Player.
 * Automatically crops images to 1:1 square ratio and compresses them
 * to standard size (512x512 px) to optimize bandwidth, Drive storage, and Firestore syncing.
 */

export interface ProcessedCoverImage {
  dataUrl: string;
  blob: Blob;
  blobUrl: string;
  width: number;
  height: number;
}

/**
 * Loads an image from a File, Blob, or URL and returns an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Gagal membaca file gambar"));
    img.src = src;
  });
}

/**
 * Crops an image to a 1:1 square (center crop) and resizes it to target max dimension (default 512x512).
 * Returns an optimized JPEG data URL and Blob.
 */
export async function processCoverImage(
  input: File | Blob | string,
  maxSize: number = 512,
  quality: number = 0.82
): Promise<ProcessedCoverImage> {
  let sourceUrl: string;
  let isTempBlobUrl = false;

  if (typeof input === "string") {
    sourceUrl = input;
  } else {
    sourceUrl = URL.createObjectURL(input);
    isTempBlobUrl = true;
  }

  try {
    const img = await loadImage(sourceUrl);

    // Calculate center 1:1 crop coordinates
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;

    const minDimension = Math.min(originalWidth, originalHeight);
    const cropX = (originalWidth - minDimension) / 2;
    const cropY = (originalHeight - minDimension) / 2;

    // Target dimensions (capped at maxSize, e.g. 512x512)
    const targetSize = Math.min(maxSize, Math.max(128, minDimension));

    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context 2D tidak tersedia");
    }

    // High quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw center-cropped square
    ctx.drawImage(
      img,
      cropX,
      cropY,
      minDimension,
      minDimension,
      0,
      0,
      targetSize,
      targetSize
    );

    // Convert to JPEG data URL with optimized compression
    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    // Convert to Blob for Google Drive upload
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Gagal mengonversi canvas ke Blob"));
        },
        "image/jpeg",
        quality
      );
    });

    const blobUrl = URL.createObjectURL(blob);

    return {
      dataUrl,
      blob,
      blobUrl,
      width: targetSize,
      height: targetSize,
    };
  } finally {
    if (isTempBlobUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

/**
 * Validates whether a file is an accepted image format (JPG, JPEG, PNG, WEBP).
 */
export function isValidImageFile(file: File): boolean {
  const validMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (validMimes.includes(file.type.toLowerCase())) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp"].includes(ext || "");
}
