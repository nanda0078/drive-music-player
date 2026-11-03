import React from "react";
import {
  Smartphone,
  X,
  CheckCircle2,
  Download,
  Menu,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { usePwa } from "../context/PwaContext";

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { canInstall, promptInstall } = usePwa();

  if (!isOpen) return null;

  const handlePrompt = async () => {
    onClose();
    await promptInstall();
  };

  return (
    <div
      id="install-guide-modal"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="install-guide-modal-content"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Instalasi Aplikasi Android
              </h3>
              <p className="text-xs text-slate-500">
                Tambahkan Drive Music ke Layar Utama
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup Panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Step-by-Step Guide */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Keunggulan Standalone */}
          <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-2xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed font-medium">
              Aplikasi mandiri (PWA) berjalan di Android tanpa address bar browser, memiliki ikon di Home Screen, hemat kuota & baterai, serta mendukung pemutaran latar belakang.
            </p>
          </div>

          <div className="space-y-3">
            {/* Langkah 1 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200/80 bg-slate-50/40">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                1
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Buka Menu Browser</span>
                  <Menu className="w-3.5 h-3.5 text-slate-500" />
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                  Ketuk ikon menu <strong>titik tiga (⋮)</strong> di sudut kanan atas Google Chrome atau menu garis tiga di Samsung Internet.
                </p>
              </div>
            </div>

            {/* Langkah 2 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200/80 bg-slate-50/40">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Pilih Install / Layar Utama</span>
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                  Cari dan ketuk pilihan <strong>"Install aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong> (<em>Add to Home screen</em>).
                </p>
              </div>
            </div>

            {/* Langkah 3 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200/80 bg-slate-50/40">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                3
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Konfirmasi Pemasangan</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                  Ketuk tombol <strong>"Install"</strong> atau <strong>"Tambah"</strong> pada kotak dialog konfirmasi Android yang tampil.
                </p>
              </div>
            </div>

            {/* Langkah 4 */}
            <div className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200/80 bg-slate-50/40">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                4
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Buka dari Layar Utama</span>
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                  Ikon <strong>Drive Music</strong> akan muncul di Home Screen ponsel. Buka untuk pengalaman aplikasi layar penuh tanpa bilah URL browser!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
          {canInstall && (
            <button
              onClick={handlePrompt}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Otomatis Sekarang</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
