import express, { Request as Req, Response as Res } from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";

// Audio MIME type resolver helper
function resolveAudioMimeType(
  requestedMime?: string,
  driveMime?: string | null,
  fileName?: string
): string {
  // 1. If Drive or requested MIME returned a video/mp4, audio/mp4, or m4a container (very common for long YouTube/SnapTube audio)
  const checkMime = (driveMime || requestedMime || "").toLowerCase();
  if (
    checkMime === "video/mp4" ||
    checkMime === "audio/mp4" ||
    checkMime === "audio/x-m4a" ||
    checkMime === "audio/m4a" ||
    checkMime === "audio/aac"
  ) {
    return "audio/mp4";
  }
  if (checkMime === "video/webm" || checkMime === "audio/webm") {
    return "audio/webm";
  }
  if (checkMime === "video/ogg" || checkMime === "audio/ogg" || checkMime === "audio/opus") {
    return "audio/ogg";
  }
  if (checkMime.startsWith("audio/")) {
    if (checkMime === "audio/mp3") return "audio/mpeg";
    if (checkMime === "audio/x-wav") return "audio/wav";
    if (checkMime === "audio/x-flac") return "audio/flac";
    return checkMime;
  }

  // 2. Check fileName / title extension if available
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".m4a") || lowerName.endsWith(".mp4") || lowerName.endsWith(".aac")) {
      return "audio/mp4";
    }
    if (lowerName.endsWith(".webm") || lowerName.endsWith(".opus")) {
      return "audio/webm";
    }
    if (lowerName.endsWith(".ogg") || lowerName.endsWith(".oga")) {
      return "audio/ogg";
    }
    if (lowerName.endsWith(".flac")) {
      return "audio/flac";
    }
    if (lowerName.endsWith(".wav")) {
      return "audio/wav";
    }
    if (lowerName.endsWith(".mp3")) {
      return "audio/mpeg";
    }
  }

  // Default standard fallback
  return "audio/mpeg";
}

async function fetchFromGoogleDrive(
  fileId: string,
  token: string,
  rangeHeader?: string
): Promise<Response> {
  const initialUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`;

  let currentUrl = initialUrl;
  let currentHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (rangeHeader) {
    currentHeaders["Range"] = rangeHeader;
  }

  let lastResponse: Response | null = null;

  // Follow redirects manually up to 5 times while preserving the crucial Range header
  for (let hop = 0; hop < 5; hop++) {
    lastResponse = await fetch(currentUrl, {
      method: "GET",
      headers: currentHeaders,
      redirect: "manual",
    });

    // If redirected (e.g. to doc-XX-XX-docs.googleusercontent.com)
    if ([301, 302, 303, 307, 308].includes(lastResponse.status)) {
      const location = lastResponse.headers.get("location");
      if (!location) break;

      currentUrl = location;
      // When following redirect to googleusercontent.com (which has signed security tokens),
      // forward the Range header for seeking, and forward Authorization if still googleapis.com
      currentHeaders = {};
      if (rangeHeader) {
        currentHeaders["Range"] = rangeHeader;
      }
      if (currentUrl.includes("googleapis.com")) {
        currentHeaders["Authorization"] = `Bearer ${token}`;
      }
      continue;
    }
    break;
  }

  // If response is HTML (e.g., large file virus scan warning page), attempt bypass with confirmation token
  if (lastResponse && lastResponse.ok && (lastResponse.headers.get("content-type") || "").includes("text/html")) {
    const htmlText = await lastResponse.text().catch(() => "");
    const confirmMatch =
      htmlText.match(/confirm=([a-zA-Z0-9_\-]+)/) ||
      htmlText.match(/name="confirm"\s+value="([^"]+)"/);
    const confirmToken = confirmMatch ? confirmMatch[1] : "t";

    const ucUrl = `https://drive.google.com/uc?id=${encodeURIComponent(
      fileId
    )}&export=download&confirm=${confirmToken}&acknowledgeAbuse=true`;

    let ucCurrentUrl = ucUrl;
    let ucHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (rangeHeader) {
      ucHeaders["Range"] = rangeHeader;
    }

    for (let hop = 0; hop < 5; hop++) {
      const ucRes = await fetch(ucCurrentUrl, {
        method: "GET",
        headers: ucHeaders,
        redirect: "manual",
      });

      if ([301, 302, 303, 307, 308].includes(ucRes.status)) {
        const ucLoc = ucRes.headers.get("location");
        if (!ucLoc) break;
        ucCurrentUrl = ucLoc;
        ucHeaders = {};
        if (rangeHeader) ucHeaders["Range"] = rangeHeader;
        if (ucCurrentUrl.includes("googleapis.com")) {
          ucHeaders["Authorization"] = `Bearer ${token}`;
        }
        continue;
      }

      if (ucRes.ok || ucRes.status === 206) {
        const ct = ucRes.headers.get("content-type") || "";
        if (!ct.includes("text/html")) {
          return ucRes;
        }
      }
      break;
    }
  }

  return lastResponse!;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global CORS and Streaming headers middleware for API routes
  app.use("/api", (req: Req, res: Res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Range, Authorization, Content-Type, Accept, X-Requested-With");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health check endpoint
  app.get("/api/health", (_req: Req, res: Res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "Drive Music Player API",
    });
  });

  // Google Drive Storage Quota endpoint
  app.get("/api/drive/storage-quota", async (req: Req, res: Res) => {
    try {
      const token = (req.query.token as string) || (req.headers.authorization?.replace(/^Bearer\s+/i, "") as string);
      if (!token) {
        res.status(401).json({ error: "Missing Google OAuth access token", code: "missing_token" });
        return;
      }

      const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!aboutRes.ok) {
        const errData = await aboutRes.json().catch(() => ({}));
        res.status(aboutRes.status).json({
          error: errData.error?.message || `Google Drive error ${aboutRes.status}`,
          code: aboutRes.status === 401 ? "token_expired" : "drive_error",
          status: aboutRes.status,
        });
        return;
      }

      const data = await aboutRes.json();
      res.json(data);
    } catch (err: any) {
      console.error("[Storage Quota API] Error:", err);
      res.status(500).json({ error: "Failed to fetch storage quota", details: err?.message });
    }
  });

  // Metadata endpoint to retrieve exact file size and MIME type for adaptive chunking
  app.get("/api/audio/metadata/:fileId", async (req: Req, res: Res) => {
    try {
      const fileId = req.params.fileId;
      const token = (req.query.token as string) || (req.headers.authorization?.replace(/^Bearer\s+/i, "") as string);

      if (!fileId) {
        res.status(400).json({ error: "Missing fileId parameter" });
        return;
      }
      if (!token) {
        res.status(401).json({ error: "Missing Google OAuth access token" });
        return;
      }

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId
        )}?fields=id,name,size,mimeType,webContentLink&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!metaRes.ok) {
        const errData = await metaRes.json().catch(() => ({}));
        res.status(metaRes.status).json({
          error: errData.error?.message || `Google Drive error ${metaRes.status}`,
          status: metaRes.status,
        });
        return;
      }

      const metaData = await metaRes.json();
      res.json({
        id: metaData.id,
        name: metaData.name,
        size: metaData.size ? parseInt(metaData.size, 10) : 0,
        mimeType: resolveAudioMimeType(undefined, metaData.mimeType, metaData.name),
        rawMimeType: metaData.mimeType,
      });
    } catch (err: any) {
      console.error("[Metadata API] Error:", err);
      res.status(500).json({ error: "Failed to fetch file metadata", details: err?.message });
    }
  });

  // Google Drive Audio Streaming Endpoint with Full HTTP Range Requests & Large File Support
  const handleStreamRequest = async (req: Req, res: Res) => {
    // Handle OPTIONS request for CORS preflight
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(405).json({ error: "Method not allowed. Use GET or HEAD." });
      return;
    }

    try {
      const fileId = (req.params.fileId as string) || (req.query.fileId as string);
      const token = (req.query.token as string) || (req.headers.authorization?.replace(/^Bearer\s+/i, "") as string);
      const requestedMime = req.query.mimeType as string | undefined;
      const fileName = req.query.fileName as string | undefined;

      if (!fileId) {
        res.status(400).json({ error: "Missing fileId parameter", code: "missing_file_id" });
        return;
      }

      if (!token) {
        res.status(401).json({ error: "Missing Google OAuth access token", code: "missing_token" });
        return;
      }

      // Forward client Range header if present (for seeking, scrubbing & chunked streaming)
      const rangeHeader = req.headers.range;

      const driveRes = await fetchFromGoogleDrive(fileId, token, rangeHeader);

      // Handle non-successful status from Google Drive
      if (!driveRes.ok && driveRes.status !== 206) {
        const errorText = await driveRes.text().catch(() => "Unknown drive error");
        console.warn(`[Stream Proxy] Google Drive response status: ${driveRes.status} for file ${fileId}`);
        
        let errorCode = "drive_error";
        let errorMessage = "Failed to stream audio from Google Drive";

        if (driveRes.status === 401) {
          errorCode = "token_expired";
          errorMessage = "Google Drive OAuth token expired or invalid";
        } else if (driveRes.status === 403) {
          errorCode = "forbidden";
          errorMessage = "Access to Google Drive file forbidden or insufficient permissions";
        } else if (driveRes.status === 404) {
          errorCode = "not_found";
          errorMessage = "File not found on Google Drive";
        } else if (driveRes.status === 416) {
          errorCode = "range_not_satisfiable";
          errorMessage = "Requested range not satisfiable";
        }

        res.status(driveRes.status).json({
          error: errorMessage,
          code: errorCode,
          status: driveRes.status,
          details: errorText,
        });
        return;
      }

      // Forward status code (200 OK or 206 Partial Content)
      res.status(driveRes.status);

      // Determine robust audio MIME type
      const driveContentType = driveRes.headers.get("content-type");
      const finalMimeType = resolveAudioMimeType(requestedMime, driveContentType, fileName);

      // Pass essential streaming headers for browser media player
      const contentRange = driveRes.headers.get("content-range");
      const contentLength = driveRes.headers.get("content-length");
      const acceptRanges = driveRes.headers.get("accept-ranges") || "bytes";

      res.setHeader("Accept-Ranges", acceptRanges);
      res.setHeader("Content-Type", finalMimeType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Range, Content-Length, Accept-Ranges, Content-Type"
      );

      if (contentRange) {
        res.setHeader("Content-Range", contentRange);
      }
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      // Allow caching of audio chunks for seamless seek and battery efficiency
      res.setHeader("Cache-Control", "private, max-age=3600");

      // For HEAD requests, stop here
      if (req.method === "HEAD") {
        res.end();
        return;
      }

      // Stream the response body directly without loading entire file in memory
      if (driveRes.body) {
        const nodeStream = Readable.fromWeb(driveRes.body as any);
        nodeStream.pipe(res);

        nodeStream.on("error", (err) => {
          console.warn("[Stream Proxy] Stream piping notice:", err?.message || err);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        req.on("close", () => {
          nodeStream.destroy();
        });
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error("[Stream Proxy] Exception:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal stream server error", message: err?.message });
      }
    }
  };

  app.all("/api/stream", handleStreamRequest);
  app.all("/api/audio/stream/:fileId", handleStreamRequest);
  app.all("/api/audio/download/:fileId", handleStreamRequest);
  app.all("/api/download/:fileId", handleStreamRequest);

  // Vite integration: middleware for development, static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Req, res: Res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Drive Music Player server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
