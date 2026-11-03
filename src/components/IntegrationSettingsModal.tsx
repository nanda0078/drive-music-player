import React from "react";
import {
  X,
  Settings,
  HardDrive,
  Database,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  Clock,
  Smartphone,
  Download,
  HelpCircle,
} from "lucide-react";
import { User } from "firebase/auth";
import { DriveStorageCard } from "./DriveStorageCard";
import { AUTOHIDE_STORAGE_KEY, AUTOHIDE_OPTIONS } from "./MiniPlayer";
import { usePwa } from "../context/PwaContext";

interface IntegrationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasGoogleAuth: boolean;
  onReconnectGoogle: () => void;
  isOnline: boolean;
  onOpenResetModal?: () => void;
}

export const IntegrationSettingsModal: React.FC<IntegrationSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  hasGoogleAuth,
  onReconnectGoogle,
  isOnline,
  onOpenResetModal,
}) => {
  const {
    canInstall,
    isInstalled,
    isStandalone,
    promptInstall,
    openInstallGuide,
  } = usePwa();

  const [autoHideVal, setAutoHideVal] = React.useState<number>(() => {
    try {
      const s = localStorage.getItem(AUTOHIDE_STORAGE_KEY);
      return s !== null ? parseInt(s, 10) : 5000;
    } catch {
      return 5000;
    }
  });

  const handleSelectAutoHide = (val: number) => {
    setAutoHideVal(val);
    try {
      localStorage.setItem(AUTOHIDE_STORAGE_KEY, val.toString());
      window.dispatchEvent(new Event("autohide-setting-changed"));
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div
      id="integration-settings-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="integration-settings-modal-content"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">Pengaturan Integrasi & PWA</h3>
              <p className="text-xs text-slate-500">Status Google Drive, Firebase, dan Layanan Cloud</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[480px] overflow-y-auto">
          {/* 1. Google Drive Integration Status */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Google Drive API</h4>
                  <p className="text-xs text-slate-500">Penyimpanan file audio & streaming</p>
                </div>
              </div>

              {hasGoogleAuth && user ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                  <AlertCircle className="w-3.5 h-3.5" /> Belum Terhubung
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Akun Pengguna:</span>
                <span className="font-medium text-slate-800">{user?.email || "Belum Login"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Folder Aplikasi:</span>
                <span className="font-semibold text-blue-700">Drive Music Player</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Izin Akses (Scope):</span>
                <span className="font-medium text-slate-700">drive.file (Akses Minimal)</span>
              </div>
            </div>

            <DriveStorageCard onReconnect={onReconnectGoogle} />

            <button
              onClick={onReconnectGoogle}
              className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{hasGoogleAuth ? "Hubungkan Ulang Akun Google" : "Hubungkan Akun Google"}</span>
            </button>
          </div>

          {/* 2. Firebase Firestore Database Status */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Firebase Firestore</h4>
                  <p className="text-xs text-slate-500">Database metadata musik, folder & playlist</p>
                </div>
              </div>

              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Collections:</span>
                <span className="font-medium text-slate-800">music, folders, playlists</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security Rules:</span>
                <span className="font-semibold text-emerald-600">Terisolasi per User ID</span>
              </div>
            </div>
          </div>

          {/* 3. Streaming Backend API Status */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">HTTP Range Streaming API</h4>
                  <p className="text-xs text-slate-500">Express Backend Service (/api/stream)</p>
                </div>
              </div>

              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <CheckCircle2 className="w-3.5 h-3.5" /> 206 Partial Ready
              </span>
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 space-y-1">
              <p>
                Audio di-stream secara bertahap via byte-range requests untuk penghematan memori, seek instan, dan kestabilan background playback.
              </p>
            </div>
          </div>

          {/* 4. Aplikasi Android (PWA / Standalone) */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Aplikasi Android (PWA)</h4>
                  <p className="text-xs text-slate-500">Layar Utama & Mode Mandiri Standalone</p>
                </div>
              </div>

              {isStandalone || isInstalled ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terpasang
                </span>
              ) : canInstall ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60">
                  <Download className="w-3.5 h-3.5" /> Siap Diinstal
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60">
                  Web Browser
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Nama Aplikasi:</span>
                <span className="font-semibold text-slate-800">Drive Music</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode Tampilan:</span>
                <span className="font-medium text-slate-800">
                  {isStandalone ? "Aplikasi Mandiri (Standalone)" : "Web Browser"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Service Worker:</span>
                <span className="font-medium text-emerald-600">Aktif & Siap Offline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kompatibilitas:</span>
                <span className="font-medium text-slate-700">PWA & Capacitor (APK Ready)</span>
              </div>
            </div>

            {!isStandalone && !isInstalled ? (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {canInstall && (
                  <button
                    id="btn-settings-install-pwa"
                    onClick={promptInstall}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install Aplikasi Sekarang</span>
                  </button>
                )}
                <button
                  id="btn-settings-install-guide"
                  onClick={openInstallGuide}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Petunjuk Layar Utama</span>
                </button>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/60 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Aplikasi telah terpasang dan berjalan dalam mode mandiri di perangkat Anda.</span>
              </div>
            )}
          </div>

          {/* 5. Auto Hide Bottom Player Settings */}
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Auto Hide Bottom Player</h4>
                  <p className="text-xs text-slate-500">Sembunyikan panel pemutar musik otomatis saat tidak ada aktivitas</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {AUTOHIDE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectAutoHide(opt.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                    autoHideVal === opt.value
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Gerakkan kursor atau ketuk area pemicu di bagian bawah layar untuk memunculkan pemutar musik kembali. Audio tetap diputar tanpa gangguan.
            </p>
          </div>

          {/* 6. Reset & Clean Application Data */}
          {onOpenResetModal && (
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Reset Seluruh Data Aplikasi</h4>
                    <p className="text-xs text-slate-500">Kosongkan semua lagu, folder, playlist & cache (0 Data)</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-rose-200/60 space-y-1">
                <p className="text-slate-600">
                  Membersihkan seluruh metadata aplikasi agar kembali kosong seperti saat pertama dipasang. File lagu asli di Google Drive Anda tetap aman dan tidak dihapus.
                </p>
              </div>

              <button
                id="btn-open-reset-app-modal"
                onClick={() => {
                  onClose();
                  onOpenResetModal();
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Buka Menu Reset Data Aplikasi (0 Data)</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
