import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { usePwa } from "../context/PwaContext";

export const PwaUpdateNotification: React.FC = () => {
  const { isUpdateAvailable, applyUpdate } = usePwa();

  if (!isUpdateAvailable) return null;

  return (
    <div
      id="pwa-update-toast"
      className="fixed bottom-24 sm:bottom-28 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom duration-300 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white leading-tight">
            Pembaruan Tersedia
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            Versi terbaru aplikasi telah siap digunakan.
          </p>
        </div>
      </div>

      <button
        onClick={applyUpdate}
        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Perbarui</span>
      </button>
    </div>
  );
};
