import React, { useState } from "react";
import {
  Moon,
  Clock,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Music,
  Plus,
  Minus,
  Timer,
  AlertCircle,
} from "lucide-react";
import { useSleepTimer } from "../context/SleepTimerContext";
import { useMusicPlayer } from "../context/MusicPlayerContext";
import { SLEEP_TIMER_PRESETS, SleepTimerPreset } from "../types/sleepTimer";

export const SleepTimerModal: React.FC = () => {
  const {
    isActive,
    mode,
    selectedMinutes,
    isEndOfTrack,
    isSleepTimerModalOpen,
    setIsSleepTimerModalOpen,
    startPresetTimer,
    startCustomTimer,
    startEndOfTrackTimer,
    cancelSleepTimer,
    formatRemainingTime,
  } = useSleepTimer();

  const { currentTrack, duration, currentTime } = useMusicPlayer();

  const [customInputMinutes, setCustomInputMinutes] = useState<number>(20);
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);

  const handlePresetClick = (minutes: SleepTimerPreset) => {
    startPresetTimer(minutes);
    setShowCustomForm(false);
  };

  const handleEndOfTrackClick = () => {
    startEndOfTrackTimer();
    setShowCustomForm(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInputMinutes > 0 && customInputMinutes <= 360) {
      startCustomTimer(customInputMinutes);
      setShowCustomForm(false);
    }
  };

  const remainingFormatted = formatRemainingTime();

  if (!isSleepTimerModalOpen) return null;

  return (
    <div
      id="sleep-timer-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={() => setIsSleepTimerModalOpen(false)}
    >
      <div
        id="sleep-timer-modal-container"
        className="w-full sm:max-w-lg bg-white sm:rounded-3xl rounded-t-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Moon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Pengatur Waktu Tidur</span>
                {isActive && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 animate-pulse">
                    Aktif
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Otomatis jeda musik saat Anda tertidur
              </p>
            </div>
          </div>

          <button
            id="btn-close-sleep-timer"
            onClick={() => setIsSleepTimerModalOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Tutup Pengatur Waktu Tidur"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Active Timer Live Countdown Banner */}
          {isActive ? (
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-3xl p-5 sm:p-6 text-white text-center shadow-xl border border-indigo-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
                <Timer className="w-3.5 h-3.5" />
                <span>
                  {isEndOfTrack
                    ? "Berhenti di Akhir Lagu"
                    : mode === "custom"
                    ? `Waktu Kustom (${selectedMinutes}m)`
                    : `Preset ${selectedMinutes} Menit`}
                </span>
              </div>

              {/* Big Digital Countdown */}
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-wider text-indigo-100 my-2 drop-shadow-md">
                {remainingFormatted || "00:00"}
              </div>

              <p className="text-xs text-slate-300 max-w-xs mx-auto mb-5 leading-relaxed">
                {isEndOfTrack
                  ? `Pemutaran akan otomatis dijeda saat lagu "${currentTrack?.title || "saat ini"}" selesai.`
                  : "Musik akan otomatis dijeda saat hitungan mundur selesai tanpa mereset playlist."}
              </p>

              {/* Cancel Button */}
              <div className="flex items-center justify-center gap-2">
                <button
                  id="btn-cancel-sleep-timer"
                  onClick={cancelSleepTimer}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Batalkan Timer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-900 leading-relaxed">
                Pilih durasi waktu di bawah. Musik akan otomatis berhenti diputar ketika waktu habis.
              </p>
            </div>
          )}

          {/* Special Option: End of Current Track */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-1 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-indigo-600" />
              <span>Opsi Khusus</span>
            </div>

            <button
              id="btn-sleep-end-of-track"
              onClick={handleEndOfTrackClick}
              disabled={!currentTrack}
              className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                isEndOfTrack && isActive
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                  : !currentTrack
                  ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                  : "bg-slate-50/80 hover:bg-indigo-50/60 border-slate-200/80 hover:border-indigo-200 text-slate-800"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isEndOfTrack && isActive
                      ? "bg-white/20 text-white"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  <Music className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm leading-tight truncate">
                      Akhir Lagu Saat Ini
                    </h3>
                    {isEndOfTrack && isActive && (
                      <Check className="w-4 h-4 text-white shrink-0" />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 truncate ${
                      isEndOfTrack && isActive ? "text-indigo-100" : "text-slate-500"
                    }`}
                  >
                    {currentTrack
                      ? `Selesai setelah "${currentTrack.title}"`
                      : "Tidak ada lagu yang sedang diputar"}
                  </p>
                </div>
              </div>

              {currentTrack && duration > 0 && (
                <span
                  className={`text-xs font-mono font-semibold ml-2 shrink-0 px-2 py-1 rounded-lg ${
                    isEndOfTrack && isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/70 text-slate-700"
                  }`}
                >
                  ~{Math.max(0, Math.ceil((duration - currentTime) / 60))} mnt
                </span>
              )}
            </button>
          </div>

          {/* Quick Presets Grid */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pilihan Cepat</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SLEEP_TIMER_PRESETS.map((preset) => {
                const isSelected =
                  isActive && !isEndOfTrack && selectedMinutes === preset.minutes;

                return (
                  <button
                    key={preset.minutes}
                    id={`btn-sleep-preset-${preset.minutes}`}
                    onClick={() => handlePresetClick(preset.minutes)}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 font-bold"
                        : "bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base font-extrabold flex items-center gap-1">
                      <span>{preset.minutes}</span>
                      <span className="text-xs font-medium opacity-80">mnt</span>
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        isSelected ? "text-indigo-100" : "text-slate-500"
                      }`}
                    >
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Time Form */}
          <div className="pt-1">
            {!showCustomForm ? (
              <button
                id="btn-show-custom-sleep-timer"
                onClick={() => setShowCustomForm(true)}
                className="w-full py-3 px-4 rounded-2xl border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/40 text-slate-600 hover:text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Atur Waktu Kustom (Menit Lain)</span>
              </button>
            ) : (
              <form
                onSubmit={handleCustomSubmit}
                className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tentukan Durasi Kustom</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Tutup
                  </button>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomInputMinutes((prev) => Math.max(1, prev - 5))
                    }
                    className="w-10 h-10 rounded-xl bg-white border border-indigo-200 text-indigo-900 font-bold flex items-center justify-center hover:bg-indigo-50 active:scale-95 shadow-xs"
                    aria-label="Kurangi 5 menit"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 shadow-inner">
                    <input
                      type="number"
                      min={1}
                      max={360}
                      value={customInputMinutes}
                      onChange={(e) =>
                        setCustomInputMinutes(
                          Math.max(1, Math.min(360, parseInt(e.target.value) || 1))
                        )
                      }
                      className="w-16 text-center font-mono font-bold text-lg text-indigo-950 focus:outline-hidden"
                      aria-label="Jumlah menit kustom"
                    />
                    <span className="text-xs font-semibold text-slate-500">menit</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCustomInputMinutes((prev) => Math.min(360, prev + 5))
                    }
                    className="w-10 h-10 rounded-xl bg-white border border-indigo-200 text-indigo-900 font-bold flex items-center justify-center hover:bg-indigo-50 active:scale-95 shadow-xs"
                    aria-label="Tambah 5 menit"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                >
                  Mulai Timer {customInputMinutes} Menit
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Playlist dan antrean tetap tersimpan saat musik dijeda.</span>
          </div>

          <button
            onClick={() => setIsSleepTimerModalOpen(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
