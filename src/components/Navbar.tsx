import React from "react";
import { User } from "firebase/auth";
import {
  Music,
  Settings,
  LogIn,
  LogOut,
  Wifi,
  WifiOff,
  Search,
  Download,
  Smartphone,
  SlidersHorizontal,
  Moon,
} from "lucide-react";
import { NavigationTab } from "../types/music";
import { usePwa } from "../context/PwaContext";
import { useEqualizer } from "../context/EqualizerContext";
import { useSleepTimer } from "../context/SleepTimerContext";

interface NavbarProps {
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  user: User | null;
  hasGoogleAuth: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  isOnline: boolean;
  isLoggingIn: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  hasGoogleAuth,
  onLogin,
  onLogout,
  onOpenSettings,
  isOnline,
  isLoggingIn,
  searchQuery = "",
  onSearchChange,
}) => {
  const { canInstall, isInstalled, isStandalone, promptInstall } = usePwa();
  const { isEqEnabled, setIsEqualizerOpen } = useEqualizer();
  const { isActive: isSleepTimerActive, setIsSleepTimerModalOpen, formatRemainingTime } = useSleepTimer();

  return (
    <header
      id="app-header"
      className="h-16 sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 md:px-8 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors w-full max-w-full box-border"
    >
      {/* Brand */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        <div
          id="brand-logo"
          className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
        >
          <Music className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-base sm:text-lg tracking-tight text-slate-800 leading-none truncate">
            Drive Music
          </span>
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block mt-0.5">
            Cloud Player
          </span>
        </div>
      </div>

      {/* Center Search Input (Active when on Library or globally on desktop) */}
      {onSearchChange && (
        <div className="flex-1 max-w-md px-4 sm:px-8 hidden md:block">
          <div className="relative">
            <input
              id="navbar-search-input"
              type="text"
              placeholder="Cari lagu, artis, atau album..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                if (currentTab !== "library") {
                  setCurrentTab("library");
                }
              }}
              className="w-full bg-slate-100 border border-transparent focus:border-blue-500 rounded-full py-2 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Install PWA Button if available (desktop / tablet) */}
        {canInstall && !isInstalled && !isStandalone && (
          <button
            id="btn-navbar-install-pwa"
            onClick={promptInstall}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Install aplikasi ke Android / Layar Utama"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        )}

        {/* Network & Drive Status (Large Screens) */}
        <div className="hidden lg:flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
              <WifiOff className="w-3.5 h-3.5" />
              Offline
            </span>
          )}
        </div>

        {/* Sleep Timer Global Button */}
        <button
          id="btn-navbar-sleep-timer"
          onClick={() => setIsSleepTimerModalOpen(true)}
          title={
            isSleepTimerActive
              ? `Sleep Timer Aktif: ${formatRemainingTime()}`
              : "Pengatur Waktu Tidur (Sleep Timer)"
          }
          className={`w-9 h-9 sm:w-auto sm:h-9 flex items-center justify-center sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
            isSleepTimerActive
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-bold"
              : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100 active:bg-slate-200"
          }`}
          aria-label="Buka Pengatur Waktu Tidur"
        >
          <Moon className={`w-4 h-4 ${isSleepTimerActive ? "fill-current" : ""}`} />
          <span className="hidden sm:inline sm:ml-1.5">
            {isSleepTimerActive ? formatRemainingTime() : "Timer"}
          </span>
          {isSleepTimerActive && (
            <span className="w-2 h-2 rounded-full bg-indigo-600 absolute top-1.5 right-1.5 sm:static sm:ml-1 sm:w-1.5 sm:h-1.5 animate-pulse"></span>
          )}
        </button>

        {/* Equalizer Global Button */}
        <button
          id="btn-navbar-equalizer"
          onClick={() => setIsEqualizerOpen(true)}
          title="Audio Equalizer (10-Band EQ & Presets)"
          className={`w-9 h-9 sm:w-auto sm:h-9 flex items-center justify-center sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
            isEqEnabled
              ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-bold"
              : "text-slate-600 hover:text-blue-600 hover:bg-slate-100 active:bg-slate-200"
          }`}
          aria-label="Buka Audio Equalizer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline sm:ml-1.5">Equalizer</span>
          {isEqEnabled && (
            <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 right-1.5 sm:static sm:ml-1 sm:w-1.5 sm:h-1.5 animate-pulse"></span>
          )}
        </button>

        {/* Settings Button */}
        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          title="Pengaturan Integrasi & PWA"
          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-all cursor-pointer"
          aria-label="Pengaturan Integrasi"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>

        {/* User Auth Controls */}
        {user && hasGoogleAuth ? (
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div
              className="w-8 h-8 rounded-full border border-slate-200 shadow-2xs overflow-hidden bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 cursor-pointer hover:ring-2 hover:ring-blue-500/20 transition-all shrink-0"
              title={user.displayName || user.email || "Pengguna"}
              onClick={onOpenSettings}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{user.displayName?.[0] || user.email?.[0] || "U"}</span>
              )}
            </div>

            <button
              id="btn-logout"
              onClick={onLogout}
              title="Keluar Akun"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Keluar Akun"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            id="btn-connect-google"
            onClick={onLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">{isLoggingIn ? "Menghubungkan..." : "Hubungkan Drive"}</span>
            <span className="sm:hidden">{isLoggingIn ? "..." : "Login"}</span>
          </button>
        )}
      </div>
    </header>
  );
};
