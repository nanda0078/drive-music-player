import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type PwaInstallStatus =
  | "unsupported" // Browser / context does not support Service Worker or PWA installation
  | "not_configured" // Service worker or manifest not ready / not eligible yet
  | "ready_to_install" // beforeinstallprompt fired, ready for user install action
  | "prompt_pending" // User clicked install, awaiting prompt acceptance
  | "installed"; // Application is running in standalone mode or was installed

export interface ApkBuildInfo {
  available: boolean;
  fileName: string;
  version: string;
  fileSizeBytes?: number;
  fileSizeFormatted?: string;
  downloadUrl?: string;
  builtAt?: string;
  rawPath?: string;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isUpdateAvailable: boolean;
  installStatus: PwaInstallStatus;
  statusLabel: string;
  promptInstall: () => Promise<"accepted" | "dismissed" | "failed">;
  applyUpdate: () => void;
  dismissInstallBanner: () => void;
  isBannerDismissed: boolean;
  apkInfo: ApkBuildInfo;
  refreshApkInfo: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType | null>(null);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [isPromptPending, setIsPromptPending] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    return localStorage.getItem("pwa_install_dismissed") === "true";
  });
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [apkInfo, setApkInfo] = useState<ApkBuildInfo>({
    available: false,
    fileName: "drive-music-player.apk",
    version: "1.0.0",
  });

  // Check standalone display mode
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        (window.navigator as any).standalone === true;

      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    checkStandalone();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      }
    };
  }, []);

  // Listen for beforeinstallprompt & appinstalled
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setCanInstall(true);
      console.log("[PWA] beforeinstallprompt event captured and ready.");
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsInstalled(true);
      setIsPromptPending(false);
      localStorage.removeItem("pwa_install_dismissed");
      console.log("[PWA] App successfully installed to device home screen.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Register Service Worker & handle updates with GitHub Pages subpath support
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const swUrl = new URL(baseUrl.endsWith("/") ? `${baseUrl}sw.js` : `${baseUrl}/sw.js`, window.location.origin).href;
      
      navigator.serviceWorker
        .register(swUrl, { scope: baseUrl })
        .then((registration) => {
          console.log("[PWA] Service Worker registered with scope:", registration.scope);

          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setIsUpdateAvailable(true);
          }

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  setWaitingWorker(installingWorker);
                  setIsUpdateAvailable(true);
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  // Fetch APK info if available
  const refreshApkInfo = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const infoUrl = new URL(baseUrl.endsWith("/") ? `${baseUrl}apk/info.json` : `${baseUrl}/apk/info.json`, window.location.origin).href;
      const res = await fetch(infoUrl, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const apkUrl = new URL(
          baseUrl.endsWith("/") ? `${baseUrl}apk/${data.fileName || "drive-music-player.apk"}` : `${baseUrl}/apk/${data.fileName || "drive-music-player.apk"}`,
          window.location.origin
        ).href;
        setApkInfo({
          ...data,
          downloadUrl: apkUrl,
        });
      }
    } catch (e) {
      console.warn("[APK] Could not load APK info:", e);
    }
  }, []);

  useEffect(() => {
    refreshApkInfo();
  }, [refreshApkInfo]);

  // Determine current install status
  let installStatus: PwaInstallStatus = "not_configured";
  let statusLabel = "Belum Dikonfigurasi";

  if (!("serviceWorker" in navigator)) {
    installStatus = "unsupported";
    statusLabel = "Tidak Didukung Browser";
  } else if (isStandalone || isInstalled) {
    installStatus = "installed";
    statusLabel = "Sudah Terinstal";
  } else if (isPromptPending) {
    installStatus = "prompt_pending";
    statusLabel = "Menunggu Persetujuan";
  } else if (canInstall && deferredPrompt) {
    installStatus = "ready_to_install";
    statusLabel = "Siap Diinstal";
  } else {
    installStatus = "not_configured";
    statusLabel = "Manual / Siap Digunakan";
  }

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "failed"> => {
    if (!deferredPrompt) {
      console.warn("[PWA] promptInstall called but no deferredPrompt is available.");
      return "failed";
    }

    try {
      setIsPromptPending(true);
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      setIsPromptPending(false);

      if (choiceResult.outcome === "accepted") {
        setDeferredPrompt(null);
        setCanInstall(false);
        setIsInstalled(true);
        console.log("[PWA] User accepted installation prompt.");
        return "accepted";
      } else {
        console.log("[PWA] User dismissed installation prompt.");
        return "dismissed";
      }
    } catch (err) {
      console.error("[PWA] Install prompt error:", err);
      setIsPromptPending(false);
      return "failed";
    }
  };

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  const dismissInstallBanner = () => {
    setIsBannerDismissed(true);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  return (
    <PwaContext.Provider
      value={{
        canInstall,
        isInstalled,
        isStandalone,
        isUpdateAvailable,
        installStatus,
        statusLabel,
        promptInstall,
        applyUpdate,
        dismissInstallBanner,
        isBannerDismissed,
        apkInfo,
        refreshApkInfo,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = (): PwaContextType => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
};
