export type EQFrequency = 31 | 62 | 125 | 250 | 500 | 1000 | 2000 | 4000 | 8000 | 16000;

export const EQ_FREQUENCIES: EQFrequency[] = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_FREQUENCY_LABELS: Record<EQFrequency, string> = {
  31: "31Hz",
  62: "62Hz",
  125: "125Hz",
  250: "250Hz",
  500: "500Hz",
  1000: "1kHz",
  2000: "2kHz",
  4000: "4kHz",
  8000: "8kHz",
  16000: "16kHz",
};

export interface EQPreset {
  id: string;
  name: string;
  isCustom?: boolean;
  bands: number[]; // 10 values from -12 to +12
  preamp: number;  // -12 to +12 dB
  bassBoost: number; // 0 to +12 dB
  balance: number; // -1 (Left) to +1 (Right)
}

export const BUILT_IN_PRESETS: EQPreset[] = [
  {
    id: "flat",
    name: "Flat",
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
    balance: 0,
  },
  {
    id: "bass_boost",
    name: "Bass Boost",
    bands: [6, 5, 4, 2, 0.5, 0, 0, 0, 0, 0],
    preamp: -1.5,
    bassBoost: 6,
    balance: 0,
  },
  {
    id: "deep_bass",
    name: "Deep Bass",
    bands: [8, 6.5, 5, 2.5, 0, 0, 0, 0, 0, 0],
    preamp: -2.5,
    bassBoost: 8.5,
    balance: 0,
  },
  {
    id: "vocal",
    name: "Vocal",
    bands: [-1.5, -1, 0, 2.5, 4, 3.5, 2, 1, 0, -1],
    preamp: 0,
    bassBoost: 0,
    balance: 0,
  },
  {
    id: "pop",
    name: "Pop",
    bands: [1.5, 2.5, 3.5, 2, 0, -1, 1, 2.5, 3, 2.5],
    preamp: -0.5,
    bassBoost: 2,
    balance: 0,
  },
  {
    id: "rock",
    name: "Rock",
    bands: [4.5, 3.5, 2, 0, -1, 0.5, 2.5, 4, 4.5, 4],
    preamp: -1,
    bassBoost: 3,
    balance: 0,
  },
  {
    id: "electronic",
    name: "Electronic",
    bands: [5, 4.5, 2, 0, -1.5, 1.5, 1, 2.5, 4.5, 5],
    preamp: -1.5,
    bassBoost: 4.5,
    balance: 0,
  },
  {
    id: "acoustic",
    name: "Acoustic",
    bands: [3, 2.5, 1.5, 0.5, 1.5, 2, 2.5, 3, 2.5, 2],
    preamp: 0,
    bassBoost: 1,
    balance: 0,
  },
  {
    id: "classical",
    name: "Classical",
    bands: [4, 3, 2, 1.5, -0.5, -0.5, 0.5, 2, 3, 3.5],
    preamp: 0,
    bassBoost: 1,
    balance: 0,
  },
  {
    id: "treble_boost",
    name: "Treble Boost",
    bands: [0, 0, 0, 0, 0, 1, 2.5, 4.5, 6.5, 7.5],
    preamp: -1,
    bassBoost: 0,
    balance: 0,
  },
];
