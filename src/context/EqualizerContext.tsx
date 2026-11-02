import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  EQPreset,
  BUILT_IN_PRESETS,
} from "../types/equalizer";
import { equalizerEngine } from "../services/equalizerAudioEngine";

interface EqualizerContextType {
  isEqEnabled: boolean;
  bands: number[];
  preamp: number;
  bassBoost: number;
  balance: number;
  activePresetId: string;
  customPresets: EQPreset[];
  isEqualizerOpen: boolean;

  setIsEqualizerOpen: (open: boolean) => void;
  toggleEq: () => void;
  setIsEqEnabled: (enabled: boolean) => void;
  setBand: (index: number, value: number) => void;
  setPreampValue: (value: number) => void;
  setBassBoostValue: (value: number) => void;
  setBalanceValue: (value: number) => void;
  applyPreset: (preset: EQPreset) => void;
  resetToFlat: () => void;
  saveCustomPreset: (name: string) => string;
  renameCustomPreset: (id: string, newName: string) => void;
  deleteCustomPreset: (id: string) => void;
  initAudioEngine: (audioElement: HTMLAudioElement) => void;
}

const EqualizerContext = createContext<EqualizerContextType | undefined>(undefined);

const EQ_STORAGE_KEYS = {
  ENABLED: "drive_music_eq_enabled",
  BANDS: "drive_music_eq_bands",
  PREAMP: "drive_music_eq_preamp",
  BASS_BOOST: "drive_music_eq_bass_boost",
  BALANCE: "drive_music_eq_balance",
  ACTIVE_PRESET: "drive_music_eq_active_preset",
  CUSTOM_PRESETS: "drive_music_eq_custom_presets",
};

export const EqualizerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Persistence states
  const [isEqEnabled, setIsEqEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(EQ_STORAGE_KEYS.ENABLED);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [bands, setBandsState] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(EQ_STORAGE_KEYS.BANDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 10) return parsed;
      }
    } catch {}
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  });

  const [preamp, setPreampState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(EQ_STORAGE_KEYS.PREAMP);
      return saved !== null ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [bassBoost, setBassBoostState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(EQ_STORAGE_KEYS.BASS_BOOST);
      return saved !== null ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [balance, setBalanceState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(EQ_STORAGE_KEYS.BALANCE);
      return saved !== null ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    try {
      return localStorage.getItem(EQ_STORAGE_KEYS.ACTIVE_PRESET) || "flat";
    } catch {
      return "flat";
    }
  });

  const [customPresets, setCustomPresets] = useState<EQPreset[]>(() => {
    try {
      const saved = localStorage.getItem(EQ_STORAGE_KEYS.CUSTOM_PRESETS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isEqualizerOpen, setIsEqualizerOpen] = useState<boolean>(false);

  // Initialize Web Audio Engine
  const initAudioEngine = useCallback((audioElement: HTMLAudioElement) => {
    equalizerEngine.initialize(audioElement);
    equalizerEngine.setEnabled(isEqEnabled);
    equalizerEngine.setBands(bands);
    equalizerEngine.setPreamp(preamp);
    equalizerEngine.setBassBoost(bassBoost);
    equalizerEngine.setBalance(balance);
  }, [isEqEnabled, bands, preamp, bassBoost, balance]);

  // Synchronize state with audio engine on initial mount & discover existing audio player
  useEffect(() => {
    if (typeof document !== "undefined") {
      const existingAudio = document.getElementById("global-drive-audio-player") as HTMLAudioElement | null;
      if (existingAudio) {
        equalizerEngine.initialize(existingAudio);
      }
    }
    equalizerEngine.setEnabled(isEqEnabled);
    equalizerEngine.setBands(bands);
    equalizerEngine.setPreamp(preamp);
    equalizerEngine.setBassBoost(bassBoost);
    equalizerEngine.setBalance(balance);
  }, []);

  // Persist Enabled state
  const setIsEqEnabled = useCallback((enabled: boolean) => {
    setIsEqEnabledState(enabled);
    equalizerEngine.setEnabled(enabled);
    try {
      localStorage.setItem(EQ_STORAGE_KEYS.ENABLED, JSON.stringify(enabled));
    } catch {}
  }, []);

  const toggleEq = useCallback(() => {
    setIsEqEnabled(!isEqEnabled);
  }, [isEqEnabled, setIsEqEnabled]);

  // Set single frequency band
  const setBand = useCallback((index: number, value: number) => {
    setBandsState((prev) => {
      const updated = [...prev];
      updated[index] = value;
      equalizerEngine.setBandGain(index, value);
      try {
        localStorage.setItem(EQ_STORAGE_KEYS.BANDS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // Mark as custom preset if modified manually
    setActivePresetId("custom");
    try {
      localStorage.setItem(EQ_STORAGE_KEYS.ACTIVE_PRESET, "custom");
    } catch {}
  }, []);

  // Set Preamp
  const setPreampValue = useCallback((val: number) => {
    setPreampState(val);
    equalizerEngine.setPreamp(val);
    try {
      localStorage.setItem(EQ_STORAGE_KEYS.PREAMP, val.toString());
    } catch {}
    setActivePresetId("custom");
  }, []);

  // Set Bass Boost
  const setBassBoostValue = useCallback((val: number) => {
    setBassBoostState(val);
    equalizerEngine.setBassBoost(val);
    try {
      localStorage.setItem(EQ_STORAGE_KEYS.BASS_BOOST, val.toString());
    } catch {}
    setActivePresetId("custom");
  }, []);

  // Set Balance
  const setBalanceValue = useCallback((val: number) => {
    setBalanceState(val);
    equalizerEngine.setBalance(val);
    try {
      localStorage.setItem(EQ_STORAGE_KEYS.BALANCE, val.toString());
    } catch {}
  }, []);

  // Apply a preset
  const applyPreset = useCallback((preset: EQPreset) => {
    setBandsState([...preset.bands]);
    setPreampState(preset.preamp);
    setBassBoostState(preset.bassBoost);
    setBalanceState(preset.balance);
    setActivePresetId(preset.id);

    equalizerEngine.setBands(preset.bands);
    equalizerEngine.setPreamp(preset.preamp);
    equalizerEngine.setBassBoost(preset.bassBoost);
    equalizerEngine.setBalance(preset.balance);

    try {
      localStorage.setItem(EQ_STORAGE_KEYS.BANDS, JSON.stringify(preset.bands));
      localStorage.setItem(EQ_STORAGE_KEYS.PREAMP, preset.preamp.toString());
      localStorage.setItem(EQ_STORAGE_KEYS.BASS_BOOST, preset.bassBoost.toString());
      localStorage.setItem(EQ_STORAGE_KEYS.BALANCE, preset.balance.toString());
      localStorage.setItem(EQ_STORAGE_KEYS.ACTIVE_PRESET, preset.id);
    } catch {}
  }, []);

  // Reset to flat
  const resetToFlat = useCallback(() => {
    const flat = BUILT_IN_PRESETS.find((p) => p.id === "flat") || {
      id: "flat",
      name: "Flat",
      bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      preamp: 0,
      bassBoost: 0,
      balance: 0,
    };
    applyPreset(flat);
  }, [applyPreset]);

  // Save new custom preset
  const saveCustomPreset = useCallback((name: string): string => {
    const trimmed = name.trim() || `Preset Kustom ${customPresets.length + 1}`;
    const newId = `custom_${Date.now()}`;
    const newPreset: EQPreset = {
      id: newId,
      name: trimmed,
      isCustom: true,
      bands: [...bands],
      preamp,
      bassBoost,
      balance,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    setActivePresetId(newId);

    try {
      localStorage.setItem(EQ_STORAGE_KEYS.CUSTOM_PRESETS, JSON.stringify(updated));
      localStorage.setItem(EQ_STORAGE_KEYS.ACTIVE_PRESET, newId);
    } catch {}

    return newId;
  }, [bands, preamp, bassBoost, balance, customPresets]);

  // Rename custom preset
  const renameCustomPreset = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setCustomPresets((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
      try {
        localStorage.setItem(EQ_STORAGE_KEYS.CUSTOM_PRESETS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Delete custom preset
  const deleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem(EQ_STORAGE_KEYS.CUSTOM_PRESETS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (activePresetId === id) {
      resetToFlat();
    }
  }, [activePresetId, resetToFlat]);

  return (
    <EqualizerContext.Provider
      value={{
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
        setIsEqEnabled,
        setBand,
        setPreampValue,
        setBassBoostValue,
        setBalanceValue,
        applyPreset,
        resetToFlat,
        saveCustomPreset,
        renameCustomPreset,
        deleteCustomPreset,
        initAudioEngine,
      }}
    >
      {children}
    </EqualizerContext.Provider>
  );
};

export const useEqualizer = (): EqualizerContextType => {
  const context = useContext(EqualizerContext);
  if (!context) {
    throw new Error("useEqualizer must be used within an EqualizerProvider");
  }
  return context;
};
