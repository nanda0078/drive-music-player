import React, { useState } from "react";
import { Download, X, Smartphone, HelpCircle } from "lucide-react";
import { usePwa } from "../context/PwaContext";
import { useToast } from "./Toast";

export const InstallPwaBanner: React.FC = () => {
  const {
    canInstall,
    isInstalled,
    isStandalone,
    isBannerDismissed,
    promptInstall,
    dismissInstallBanner,
    openInstallGuide,
  } = usePwa();
  const { showToast } = useToast();
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  // Do not show if already installed, running in standalone mode, or dismissed by user
  if (isInstalled || isStandalone || isBannerDismissed) {
    return null;
  }

  const handleInstall = async () => {
    try {
      setIsInstalling(true);
      const res = await promptInstall();
      if (res === "accepted") {
        showToast("Aplikasi berhasil ditambahkan ke Layar Utama Android!", "success");
      }
    } catch (err) {
      console.error("Install failed:", err);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      id="pwa-install-banner"
      className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-4 py-2.5 sm:px-6 shadow-md relative z-20 animate-in slide-in-from-top duration-300 border-b border-blue-500/40"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* App Icon */}
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center p-1.5 shrink-0 border border-white/20 shadow-xs">
            <img src="./icon-192.svg" alt="Drive Music" className="w-full h-full object-contain" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-md text-white">
                Android PWA
              </span>
              <h4 className="text-sm font-bold text-white truncate">
                Install Drive Music
              </h4>
            </div>
            <p className="text-xs text-blue-100 mt-0.5 truncate sm:whitespace-normal">
              Pasang di layar utama Android untuk aplikasi mandiri layar penuh tanpa address bar browser.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={openInstallGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Lihat petunjuk langkah-demi-langkah"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Petunjuk</span>
          </button>

          <button
            onClick={dismissInstallBanner}
            className="px-3 py-1.5 text-xs font-medium text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            Nanti Saja
          </button>

          {canInstall ? (
            <button
              id="btn-pwa-install-banner"
              disabled={isInstalling}
              onClick={handleInstall}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isInstalling ? "Memasang..." : "Install Aplikasi"}</span>
            </button>
          ) : (
            <button
              id="btn-pwa-install-guide"
              onClick={openInstallGuide}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah ke Home</span>
            </button>
          )}

          <button
            onClick={dismissInstallBanner}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors sm:block hidden cursor-pointer"
            aria-label="Tutup Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
