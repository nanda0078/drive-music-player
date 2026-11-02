export type SleepTimerPreset = 5 | 10 | 15 | 30 | 45 | 60;

export type SleepTimerMode = "preset" | "custom" | "end_of_track" | null;

export interface SleepTimerState {
  isActive: boolean;
  mode: SleepTimerMode;
  targetTimestamp: number | null;
  totalSeconds: number | null;
  remainingSeconds: number;
  selectedMinutes: number | null;
  isEndOfTrack: boolean;
}

export const SLEEP_TIMER_PRESETS: { minutes: SleepTimerPreset; label: string }[] = [
  { minutes: 5, label: "5 Menit" },
  { minutes: 10, label: "10 Menit" },
  { minutes: 15, label: "15 Menit" },
  { minutes: 30, label: "30 Menit" },
  { minutes: 45, label: "45 Menit" },
  { minutes: 60, label: "60 Menit (1 Jam)" },
];
