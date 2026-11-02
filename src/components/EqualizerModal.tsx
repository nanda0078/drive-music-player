import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  Check,
  ShieldCheck,
  Zap,
  Volume2,
  Sliders,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEqualizer } from "../context/EqualizerContext";
import {
  EQ_FREQUENCIES,
  EQ_FREQUENCY_LABELS,
  BUILT_IN_PRESETS,
  EQPreset,
} from "../types/equalizer";

export const EqualizerModal: React.FC = () => {
  const {
    isEqEnabled,
    bands,
    preamp,
    bassBoost,
    balance,
    activePresetId,
    customPresets,
    isEqualizerOpen,
    setIsEqualizerOpen,
    toggleEq,
    setBand,
    setPreampValue,
    setBassBoostValue,
    setBalanceValue,
    applyPreset,
    resetToFlat,
    saveCustomPreset,
    renameCustomPreset,
    deleteCustomPreset,
  } = useEqualizer();

  const [isSavingCustom, setIsSavingCustom] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>("");
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renamingPresetName, setRenamingPresetName] = useState<string>("");

  const presetContainerRef = useRef<HTMLDivElement | null>(null);

  const handleScrollPresets = (direction: "left" | "right") => {
    if (!presetContainerRef.current) return;
    const offset = direction === "left" ? -220 : 220;
    presetContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  const handlePresetWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Enable direct horizontal scrolling via mouse wheel
    if (e.deltaY !== 0 && e.deltaX === 0 && presetContainerRef.current) {
      presetContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // All presets combined
  const allPresets = useMemo(() => {
    return [...BUILT_IN_PRESETS, ...customPresets];
  }, [customPresets]);

  // Auto-scroll active preset into view if outside visible viewport
  useEffect(() => {
    if (!isEqualizerOpen || !presetContainerRef.current) return;
    const container = presetContainerRef.current;
    const activeEl = container.querySelector<HTMLElement>("[data-preset-active='true']");
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      const isOutOfView = elRect.left < containerRect.left || elRect.right > containerRect.right;
      if (isOutOfView) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [activePresetId, isEqualizerOpen]);

  // Generate SVG points for the frequency curve visualizer
  const curvePoints = useMemo(() => {
    const width = 600;
    const height = 90;
    const paddingX = 30;
    const usableWidth = width - paddingX * 2;
    const centerY = height / 2;
    const maxDb = 12;

    const points = bands.map((db, idx) => {
      const x = paddingX + (idx / (bands.length - 1)) * usableWidth;
      // Invert Y because SVG 0 is top
      const effectiveDb = isEqEnabled ? db : 0;
      const y = centerY - (effectiveDb / maxDb) * (height / 2 - 10);
      return { x, y };
    });

    if (points.length === 0) return "";

    // Generate smooth bezier curve path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [bands, isEqEnabled]);

  // Fill area path for the curve
  const areaPath = useMemo(() => {
    if (!curvePoints) return "";
    return `${curvePoints} L 570 90 L 30 90 Z`;
  }, [curvePoints]);

  if (!isEqualizerOpen) return null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPresetName.trim()) {
      saveCustomPreset(newPresetName.trim());
      setNewPresetName("");
      setIsSavingCustom(false);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (renamingPresetName.trim()) {
      renameCustomPreset(id, renamingPresetName.trim());
      setRenamingPresetId(null);
      setRenamingPresetName("");
    }
  };

  return (
    <div
      id="equalizer-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={() => setIsEqualizerOpen(false)}
    >
      <div
        id="equalizer-modal-container"
        className="w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Audio Equalizer</span>
                {isEqEnabled && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    Aktif
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                10-Band Graphic Equalizer & Sound Enhancement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* EQ ON/OFF Switch */}
            <button
              id="btn-toggle-eq"
              onClick={toggleEq}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                isEqEnabled
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-600"
              }`}
              title={isEqEnabled ? "Nonaktifkan EQ" : "Aktifkan EQ"}
            >
              <Zap className={`w-3.5 h-3.5 ${isEqEnabled ? "fill-current" : ""}`} />
              <span>{isEqEnabled ? "EQ ON" : "EQ OFF"}</span>
            </button>

            {/* Close Button */}
            <button
              id="btn-close-equalizer"
              onClick={() => setIsEqualizerOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              aria-label="Tutup Equalizer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overflow-x-hidden flex-1">
          {/* Preset Selector */}
          <div className="space-y-2.5 min-w-0 max-w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Preset Suara</span>
              </span>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Scroll Left & Right buttons for Desktop Navigation */}
                <div className="hidden sm:flex items-center gap-0.5 border border-slate-200/80 rounded-lg p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => handleScrollPresets("left")}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
                    title="Geser preset ke kiri"
                    aria-label="Geser ke kiri"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollPresets("right")}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
                    title="Geser preset ke kanan"
                    aria-label="Geser ke kanan"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={resetToFlat}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reset Semua Band ke 0 dB"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Flat</span>
                </button>

                <button
                  onClick={() => setIsSavingCustom(!isSavingCustom)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Simpan Kustom</span>
                </button>
              </div>
            </div>

            {/* Inline Save Custom Form */}
            {isSavingCustom && (
              <form
                onSubmit={handleSaveSubmit}
                className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3 flex gap-2 animate-in fade-in zoom-in-95 duration-150"
              >
                <input
                  type="text"
                  placeholder="Nama preset kustom Anda..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-2xs cursor-pointer"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingCustom(false)}
                  className="px-2 py-1.5 bg-white text-slate-600 rounded-xl text-xs border border-slate-200 cursor-pointer"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Presets Horizontal Scroll Area */}
            <div
              id="equalizer-presets-scroll"
              ref={presetContainerRef}
              onWheel={handlePresetWheel}
              className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-2.5 pt-0.5 preset-scroll-container max-w-full touch-pan-x"
            >
              {allPresets.map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    data-preset-id={preset.id}
                    data-preset-active={isActive ? "true" : "false"}
                    className="relative shrink-0 flex items-center"
                  >
                    <button
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
                        isActive
                          ? "bg-blue-600 text-white font-bold ring-2 ring-blue-400/30"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60"
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                      <span>{preset.name}</span>
                    </button>

                    {/* Custom Preset Actions */}
                    {preset.isCustom && (
                      <div className="flex items-center ml-1 space-x-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingPresetId(preset.id);
                            setRenamingPresetName(preset.name);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                          title="Ubah Nama"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomPreset(preset.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="Hapus Preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rename Modal inline */}
            {renamingPresetId && (
              <form
                onSubmit={(e) => handleRenameSubmit(e, renamingPresetId)}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-2 animate-in fade-in duration-150 mt-2"
              >
                <input
                  type="text"
                  value={renamingPresetName}
                  onChange={(e) => setRenamingPresetName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs focus:outline-hidden"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 shadow-2xs"
                >
                  Simpan Nama
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingPresetId(null)}
                  className="px-2 py-1.5 bg-white text-slate-600 rounded-xl text-xs border border-slate-200"
                >
                  Batal
                </button>
              </form>
            )}
          </div>

          {/* Visual Frequency Response Curve */}
          <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 relative overflow-hidden shadow-inner">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1 px-1">
              <span>+12 dB</span>
              <span className="text-blue-400 font-semibold">Respons Frekuensi Visual</span>
              <span>-12 dB</span>
            </div>

            <svg
              viewBox="0 0 600 90"
              className="w-full h-16 sm:h-20 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Center 0dB reference line */}
              <line
                x1="0"
                y1="45"
                x2="600"
                y2="45"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Area fill */}
              <path d={areaPath} fill="url(#eqGradient)" />

              {/* Response curve */}
              <path
                d={curvePoints}
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* 10-Band Graphic Equalizer Sliders */}
          <div className="bg-slate-50/90 rounded-2xl p-3 sm:p-4 border border-slate-200/80">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>10-Band Graphic Equalizer</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Rentang: -12 dB s/d +12 dB
              </span>
            </div>

            {/* Scrollable / Responsive Sliders Grid */}
            <div className="flex items-end justify-between gap-1 sm:gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
              {EQ_FREQUENCIES.map((freq, index) => {
                const gain = bands[index] ?? 0;
                const isPositive = gain > 0;
                const isZero = gain === 0;

                return (
                  <div
                    key={freq}
                    className="flex flex-col items-center min-w-[34px] sm:min-w-[42px] flex-1 group"
                  >
                    {/* dB Value Badge (Tap to reset single band) */}
                    <button
                      onClick={() => setBand(index, 0)}
                      className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded-md mb-2 transition-colors cursor-pointer ${
                        isZero
                          ? "text-slate-400 bg-slate-200/50"
                          : isPositive
                          ? "text-blue-700 bg-blue-100 font-extrabold"
                          : "text-amber-700 bg-amber-100 font-extrabold"
                      }`}
                      title="Klik untuk reset band ini ke 0 dB"
                    >
                      {isPositive ? `+${gain.toFixed(1)}` : `${gain.toFixed(1)}`}
                    </button>

                    {/* Vertical Slider Wrapper */}
                    <div className="h-32 sm:h-40 flex items-center justify-center relative py-1">
                      {/* Vertical track background bar */}
                      <div className="absolute w-1.5 h-full bg-slate-200 rounded-full" />
                      {/* Center 0dB mark */}
                      <div className="absolute w-3 h-0.5 bg-slate-400/60 rounded-full" />

                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={gain}
                        disabled={!isEqEnabled}
                        onChange={(e) => setBand(index, parseFloat(e.target.value))}
                        className="h-32 sm:h-40 w-6 appearance-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed accent-blue-600 focus:outline-hidden"
                        style={{
                          WebkitAppearance: "slider-vertical",
                        } as any}
                        aria-label={`EQ Band ${EQ_FREQUENCY_LABELS[freq]}`}
                      />
                    </div>

                    {/* Frequency Label */}
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 mt-2 truncate w-full text-center">
                      {EQ_FREQUENCY_LABELS[freq]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sound Enhancements: Preamp, Bass Boost, Balance & Limiter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Preamp */}
            <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Preamp</span>
                <span
                  onClick={() => setPreampValue(0)}
                  className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer"
                  title="Klik untuk reset 0 dB"
                >
                  {preamp > 0 ? `+${preamp.toFixed(1)}` : `${preamp.toFixed(1)}`} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={preamp}
                disabled={!isEqEnabled}
                onChange={(e) => setPreampValue(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600 disabled:opacity-40 focus:outline-hidden"
                aria-label="Preamp Gain"
              />
              <p className="text-[10px] text-slate-400">
                Kontrol overall gain sebelum pemfilteran.
              </p>
            </div>

            {/* Bass Boost */}
            <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Bass Boost</span>
                <span
                  onClick={() => setBassBoostValue(0)}
                  className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer"
                  title="Klik untuk reset 0 dB"
                >
                  +{bassBoost.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={bassBoost}
                disabled={!isEqEnabled}
                onChange={(e) => setBassBoostValue(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600 disabled:opacity-40 focus:outline-hidden"
                aria-label="Bass Boost"
              />
              <p className="text-[10px] text-slate-400">
                Penguatan nada rendah (low-shelf 80Hz).
              </p>
            </div>

            {/* Balance L/R */}
            <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Balance (L / R)</span>
                <span
                  onClick={() => setBalanceValue(0)}
                  className="text-[10px] font-mono font-bold text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded cursor-pointer"
                  title="Klik untuk reset tengah"
                >
                  {balance === 0
                    ? "Center"
                    : balance < 0
                    ? `L ${Math.abs(Math.round(balance * 100))}%`
                    : `R ${Math.round(balance * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={balance}
                disabled={!isEqEnabled}
                onChange={(e) => setBalanceValue(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-700 disabled:opacity-40 focus:outline-hidden"
                aria-label="Left Right Balance"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Kiri</span>
                <span>Tengah</span>
                <span>Kanan</span>
              </div>
            </div>
          </div>

          {/* Limiter & Clipping Protection Notice */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 border border-blue-200/60 text-xs">
            <div className="flex items-center gap-2 text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold">Dynamics Limiter & Anti-Clipping: </span>
                <span className="text-blue-700 text-[11px]">
                  Melindungi audio dari distorsi, crackling, dan volume berlebih.
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] shrink-0">
              Auto Aktif
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Web Audio API 10-Band + Auto Clipping Protection</span>
          </div>

          <button
            onClick={() => setIsEqualizerOpen(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
