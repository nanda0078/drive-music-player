import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { SleepTimerMode, SleepTimerPreset } from "../types/sleepTimer";
import { useMusicPlayer } from "./MusicPlayerContext";
import { useToast } from "../components/Toast";

interface SleepTimerContextType {
  isActive: boolean;
  mode: SleepTimerMode;
  targetTimestamp: number | null;
  remainingSeconds: number;
  selectedMinutes: number | null;
  isEndOfTrack: boolean;
  isSleepTimerModalOpen: boolean;
  setIsSleepTimerModalOpen: (open: boolean) => void;
  startPresetTimer: (minutes: SleepTimerPreset) => void;
  startCustomTimer: (minutes: number) => void;
  startEndOfTrackTimer: () => void;
  cancelSleepTimer: () => void;
  formatRemainingTime: () => string;
}

const SleepTimerContext = createContext<SleepTimerContextType | undefined>(undefined);

const STORAGE_KEY = "drive_music_sleep_timer_state";

export const SleepTimerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { pausePlayback, registerTrackEndInterceptor, currentTime, duration, currentTrack } =
    useMusicPlayer();
  const { showToast } = useToast();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [mode, setMode] = useState<SleepTimerMode>(null);
  const [targetTimestamp, setTargetTimestamp] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [isEndOfTrack, setIsEndOfTrack] = useState<boolean>(false);
  const [isSleepTimerModalOpen, setIsSleepTimerModalOpen] = useState<boolean>(false);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isEndOfTrackRef = useRef<boolean>(false);
  isEndOfTrackRef.current = isEndOfTrack;

  // Restore saved active timer on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isActive) {
          if (parsed.mode === "end_of_track") {
            setIsActive(true);
            setMode("end_of_track");
            setIsEndOfTrack(true);
          } else if (parsed.targetTimestamp) {
            const now = Date.now();
            const leftSec = Math.ceil((parsed.targetTimestamp - now) / 1000);
            if (leftSec > 0) {
              setIsActive(true);
              setMode(parsed.mode || "preset");
              setTargetTimestamp(parsed.targetTimestamp);
              setRemainingSeconds(leftSec);
              setSelectedMinutes(parsed.selectedMinutes || null);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          }
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Persist state changes
  useEffect(() => {
    try {
      if (isActive) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            isActive,
            mode,
            targetTimestamp,
            selectedMinutes,
            isEndOfTrack,
          })
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore local storage error
    }
  }, [isActive, mode, targetTimestamp, selectedMinutes, isEndOfTrack]);

  // Cancel Timer
  const cancelSleepTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsActive(false);
    setMode(null);
    setTargetTimestamp(null);
    setRemainingSeconds(0);
    setSelectedMinutes(null);
    setIsEndOfTrack(false);
    registerTrackEndInterceptor(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [registerTrackEndInterceptor]);

  // Start Preset or Custom Minutes Timer
  const startTimerWithMinutes = useCallback(
    (minutes: number, timerMode: "preset" | "custom") => {
      if (minutes <= 0) return;

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      const totalSec = Math.round(minutes * 60);
      const targetTime = Date.now() + totalSec * 1000;

      setIsActive(true);
      setMode(timerMode);
      setTargetTimestamp(targetTime);
      setRemainingSeconds(totalSec);
      setSelectedMinutes(minutes);
      setIsEndOfTrack(false);
      registerTrackEndInterceptor(null);

      showToast(`Sleep Timer diatur: ${minutes} menit`, "success");
    },
    [registerTrackEndInterceptor, showToast]
  );

  const startPresetTimer = useCallback(
    (minutes: SleepTimerPreset) => {
      startTimerWithMinutes(minutes, "preset");
    },
    [startTimerWithMinutes]
  );

  const startCustomTimer = useCallback(
    (minutes: number) => {
      startTimerWithMinutes(minutes, "custom");
    },
    [startTimerWithMinutes]
  );

  // Start End of Current Track Timer
  const startEndOfTrackTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsActive(true);
    setMode("end_of_track");
    setIsEndOfTrack(true);
    setTargetTimestamp(null);
    setSelectedMinutes(null);

    // Calculate approximate remaining seconds of current track
    const trackLeftSec = Math.max(0, Math.round((duration || 0) - (currentTime || 0)));
    setRemainingSeconds(trackLeftSec);

    // Register track end interceptor to pause before next track
    registerTrackEndInterceptor(() => {
      pausePlayback();
      cancelSleepTimer();
      showToast("Lagu selesai diputar. Musik dijeda oleh Sleep Timer.", "info");
      return false; // Tells player not to advance to next track
    });

    showToast("Sleep Timer: Berhenti setelah lagu ini selesai", "success");
  }, [duration, currentTime, registerTrackEndInterceptor, pausePlayback, cancelSleepTimer, showToast]);

  // Timer Tick Loop
  useEffect(() => {
    if (!isActive) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    if (mode === "end_of_track") {
      // For end of track, keep remainingSeconds synced with current track playback position
      const leftSec = Math.max(0, Math.round((duration || 0) - (currentTime || 0)));
      setRemainingSeconds(leftSec);
      return;
    }

    if (targetTimestamp) {
      const checkTimer = () => {
        const now = Date.now();
        const diffMs = targetTimestamp - now;
        const diffSec = Math.max(0, Math.ceil(diffMs / 1000));

        setRemainingSeconds(diffSec);

        if (diffSec <= 0) {
          // Timer reached 00:00! Pause playback cleanly
          pausePlayback();
          cancelSleepTimer();
          showToast("Sleep Timer selesai. Musik telah dijeda secara otomatis.", "info");
        }
      };

      // Run immediate check
      checkTimer();

      timerIntervalRef.current = setInterval(checkTimer, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    }
  }, [isActive, mode, targetTimestamp, duration, currentTime, pausePlayback, cancelSleepTimer, showToast]);

  // Format Display Time (e.g. "29:58" or "1:15:30" or "Akhir Lagu")
  const formatRemainingTime = useCallback((): string => {
    if (!isActive) return "";

    if (isEndOfTrack) {
      if (remainingSeconds > 0) {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        return `Akhir Lagu (${mins}:${secs.toString().padStart(2, "0")})`;
      }
      return "Akhir Lagu Ini";
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [isActive, isEndOfTrack, remainingSeconds]);

  return (
    <SleepTimerContext.Provider
      value={{
        isActive,
        mode,
        targetTimestamp,
        remainingSeconds,
        selectedMinutes,
        isEndOfTrack,
        isSleepTimerModalOpen,
        setIsSleepTimerModalOpen,
        startPresetTimer,
        startCustomTimer,
        startEndOfTrackTimer,
        cancelSleepTimer,
        formatRemainingTime,
      }}
    >
      {children}
    </SleepTimerContext.Provider>
  );
};

export const useSleepTimer = () => {
  const context = useContext(SleepTimerContext);
  if (!context) {
    throw new Error("useSleepTimer must be used within SleepTimerProvider");
  }
  return context;
};
