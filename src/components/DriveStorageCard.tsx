import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchDriveStorageQuota,
  DriveStorageQuota,
} from "../services/driveService";

// Authentic Google Drive Triangle Vector Icon
const GoogleDriveIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    viewBox="0 0 87.3 78"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
      fill="#0066da"
    />
    <path
      d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.45-1.2 3-1.2 4.5h27.5z"
      fill="#00ac47"
    />
    <path
      d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.45 1.2-3 1.2-4.5h-27.502l5.852 11.5z"
      fill="#ea4335"
    />
    <path
      d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
      fill="#00832d"
    />
    <path
      d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
      fill="#2684fc"
    />
    <path
      d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
      fill="#ffba00"
    />
  </svg>
);

export type StorageConnectionStatus = "active" | "inactive" | "error" | "loading";

export interface DriveStorageCardProps {
  onReconnect?: () => void;
  syncTrigger?: number;
  className?: string;
}

export const DriveStorageCard: React.FC<DriveStorageCardProps> = ({
  onReconnect,
  syncTrigger = 0,
  className = "",
}) => {
  const { user, hasGoogleDriveAuth, getValidAccessToken, reconnectGoogleDrive } = useAuth();

  const [quota, setQuota] = useState<DriveStorageQuota | null>(null);
  const [status, setStatus] = useState<StorageConnectionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load quota with support for caching & manual refresh
  const loadQuota = useCallback(
    async (forceRefresh: boolean = false) => {
      // 1. If user is not authenticated or has no Google auth
      if (!user || !hasGoogleDriveAuth) {
        setStatus("inactive");
        setQuota(null);
        setErrorMessage(null);
        return;
      }

      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        let token = await getValidAccessToken(forceRefresh);
        if (!token) {
          // Token expired, attempt silent reconnect
          const reconnected = await reconnectGoogleDrive();
          if (reconnected) {
            token = await getValidAccessToken(false);
          }
        }

        if (!token) {
          setStatus("inactive");
          setQuota(null);
          return;
        }

        const data = await fetchDriveStorageQuota(token, forceRefresh);
        setQuota(data);
        setStatus("active");
        setErrorMessage(null);
      } catch (err: any) {
        console.warn("[DriveStorageCard] Failed to fetch storage quota:", err);

        // Handle token expiration specifically
        if (err?.code === "token_expired" || err?.message?.includes("kedaluwarsa")) {
          try {
            const reconnected = await reconnectGoogleDrive();
            if (reconnected) {
              const freshToken = await getValidAccessToken(true);
              if (freshToken) {
                const refreshedData = await fetchDriveStorageQuota(freshToken, true);
                setQuota(refreshedData);
                setStatus("active");
                setErrorMessage(null);
                return;
              }
            }
          } catch {}
        }

        // Distinctly handle "Gagal Memuat" (DO NOT conflate with "Tidak Aktif")
        setStatus("error");
        setErrorMessage(err?.message || "Gagal mengambil kapasitas Google Drive.");
      } finally {
        setIsRefreshing(false);
      }
    },
    [user, hasGoogleDriveAuth, getValidAccessToken, reconnectGoogleDrive]
  );

  // Initial load and reaction to auth changes
  useEffect(() => {
    loadQuota(false);
  }, [loadQuota]);

  // React to external synchronization triggers (e.g. after upload, rename, move, delete)
  useEffect(() => {
    if (syncTrigger > 0) {
      loadQuota(true);
    }
  }, [syncTrigger, loadQuota]);

  // Format numbers cleanly
  const usageDisplay = quota ? `${quota.usageGB.toFixed(1)} GB terpakai` : "";
  const limitDisplay = quota
    ? quota.limitGB !== null
      ? `${quota.limitGB.toFixed(1)} GB`
      : "Kapasitas tidak diketahui"
    : "";

  return (
    <div
      id="drive-storage-usage-card"
      className={`p-4 rounded-2xl bg-[#0B1528] text-white border border-blue-900/40 shadow-sm space-y-3 transition-all ${className}`}
    >
      {/* 1. Top Section: Left Icon + Label & Right Status + Refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 p-1.5 flex items-center justify-center shrink-0 border border-white/10 shadow-2xs">
            <GoogleDriveIcon className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white tracking-tight truncate leading-tight">
              Google Drive
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Kapasitas Cloud</span>
          </div>
        </div>

        {/* Status Indicator Badge & Refresh Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "active" && (
            <span
              id="drive-storage-status-active"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Aktif
            </span>
          )}

          {status === "inactive" && (
            <span
              id="drive-storage-status-inactive"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Tidak Aktif
            </span>
          )}

          {status === "error" && (
            <span
              id="drive-storage-status-error"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Gagal Memuat
            </span>
          )}

          {status === "loading" && !quota && (
            <span
              id="drive-storage-status-loading"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              Memuat...
            </span>
          )}

          {/* Refresh Action */}
          <button
            id="btn-refresh-drive-storage"
            onClick={() => loadQuota(true)}
            disabled={isRefreshing}
            title="Perbarui Kuota Google Drive"
            aria-label="Perbarui Kuota Google Drive"
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* 2. Middle Section: Horizontal Progress Bar */}
      <div className="space-y-1.5">
        <div
          id="drive-storage-progress-track"
          className="h-2 w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50"
        >
          {status === "active" && quota && quota.usagePercent !== null ? (
            <div
              id="drive-storage-progress-fill"
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                quota.usagePercent >= 90
                  ? "bg-rose-500"
                  : quota.usagePercent >= 80
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min(100, Math.max(3, quota.usagePercent))}%`,
              }}
            />
          ) : status === "loading" ? (
            <div className="h-full bg-blue-500/40 rounded-full animate-pulse w-2/3" />
          ) : (
            <div className="h-full bg-slate-700/40 rounded-full w-0" />
          )}
        </div>

        {/* 3. Bottom Section: Usage and Total Capacity Display */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span
            id="drive-storage-usage-text"
            className="font-semibold text-slate-100 truncate"
          >
            {status === "active" && quota
              ? usageDisplay
              : status === "inactive"
              ? "Akun belum terhubung"
              : status === "error"
              ? "Gagal membaca kuota"
              : "Memeriksa kapasitas..."}
          </span>

          <span
            id="drive-storage-limit-text"
            className="font-medium text-slate-400 shrink-0 ml-2"
          >
            {status === "active" && quota
              ? limitDisplay
              : status === "active"
              ? "-"
              : ""}
          </span>
        </div>
      </div>

      {/* Optional Inactive / Error Helper Action Bar */}
      {status === "inactive" && onReconnect && (
        <button
          onClick={onReconnect}
          className="w-full mt-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Hubungkan Google Drive</span>
        </button>
      )}

      {status === "error" && (
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-rose-300/90 border-t border-rose-900/30">
          <div className="flex items-center gap-1 min-w-0">
            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">{errorMessage || "Koneksi terputus"}</span>
          </div>
          <button
            onClick={() => loadQuota(true)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline shrink-0 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  );
};
