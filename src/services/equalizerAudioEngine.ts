import { EQ_FREQUENCIES } from "../types/equalizer";

class EqualizerAudioEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampNode: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private bassBoostNode: BiquadFilterNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private isInitialized: boolean = false;
  private isEnabled: boolean = true;
  private isPlaybackActive: boolean = false;

  // Cached parameters
  private currentBands: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private currentPreamp: number = 0;
  private currentBassBoost: number = 0;
  private currentBalance: number = 0;

  constructor() {
    this.loadInitialSettingsFromStorage();
    this.initLifecycleListeners();
  }

  /**
   * Keep AudioContext running during page lifecycle, tab switching, and lockscreen changes
   */
  private initLifecycleListeners(): void {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (this.isPlaybackActive) {
          this.ensureAudioContextRunning().catch(() => {});
        }
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", () => {
        if (this.isPlaybackActive) {
          this.ensureAudioContextRunning().catch(() => {});
        }
      });
      window.addEventListener("focus", () => {
        if (this.isPlaybackActive) {
          this.ensureAudioContextRunning().catch(() => {});
        }
      });
    }
  }

  /**
   * Set active playback status to auto-manage AudioContext suspension/resumption
   */
  public setPlaybackActive(active: boolean): void {
    this.isPlaybackActive = active;
    if (active) {
      this.ensureAudioContextRunning().catch(() => {});
    }
  }

  /**
   * Load stored user preferences directly on engine creation
   */
  private loadInitialSettingsFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const savedEnabled = localStorage.getItem("drive_music_eq_enabled");
      if (savedEnabled !== null) {
        this.isEnabled = JSON.parse(savedEnabled);
      } else {
        this.isEnabled = true;
      }

      const savedBands = localStorage.getItem("drive_music_eq_bands");
      if (savedBands) {
        const parsed = JSON.parse(savedBands);
        if (Array.isArray(parsed) && parsed.length === 10) {
          this.currentBands = parsed;
        }
      }

      const savedPreamp = localStorage.getItem("drive_music_eq_preamp");
      if (savedPreamp !== null) {
        this.currentPreamp = parseFloat(savedPreamp) || 0;
      }

      const savedBassBoost = localStorage.getItem("drive_music_eq_bass_boost");
      if (savedBassBoost !== null) {
        this.currentBassBoost = parseFloat(savedBassBoost) || 0;
      }

      const savedBalance = localStorage.getItem("drive_music_eq_balance");
      if (savedBalance !== null) {
        this.currentBalance = parseFloat(savedBalance) || 0;
      }
    } catch (e) {
      console.warn("[Equalizer] Failed to load stored settings:", e);
    }
  }

  /**
   * Initializes the Web Audio API graph linked to the provided HTMLAudioElement.
   * Safe to call multiple times; only initializes once.
   */
  public initialize(audioElement: HTMLAudioElement): boolean {
    if (this.isInitialized && this.audioCtx && this.sourceNode) {
      this.ensureAudioContextRunning().catch(() => {});
      return true;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) {
        console.warn("[Equalizer] Web Audio API is not supported in this browser.");
        return false;
      }

      if (!this.audioCtx) {
        try {
          // latencyHint: 'playback' prioritizes continuous media playback, power efficiency,
          // and prevents Android Chrome from treating AudioContext as an interactive UI/game sound.
          this.audioCtx = new AudioCtxClass({ latencyHint: "playback" } as AudioContextOptions);
        } catch {
          this.audioCtx = new AudioCtxClass();
        }

        // Auto-recover AudioContext if Android or browser attempts to suspend it during playback
        this.audioCtx.onstatechange = () => {
          if (this.audioCtx?.state === "suspended" && this.isPlaybackActive) {
            this.audioCtx.resume().catch(() => {});
          }
        };
      }

      // Create MediaElementSource node from the persistent audio element
      if (!this.sourceNode) {
        this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
      }

      // Preamp Gain Node
      this.preampNode = this.audioCtx.createGain();

      // Create 10 BiquadFilterNodes for each frequency band with optimal Q and frequency calibration
      this.filterNodes = EQ_FREQUENCIES.map((freq, index) => {
        const filter = this.audioCtx!.createBiquadFilter();
        filter.frequency.value = freq;

        if (index === 0) {
          filter.type = "lowshelf";
        } else if (index === EQ_FREQUENCIES.length - 1) {
          filter.type = "highshelf";
        } else {
          filter.type = "peaking";
          // Q = 1.414 represents standard 1-octave bandwidth filter for 10-band ISO EQ
          filter.Q.value = 1.414;
        }

        filter.gain.value = 0;
        return filter;
      });

      // Dedicated Bass Boost Low-Shelf Filter (around 80Hz)
      this.bassBoostNode = this.audioCtx.createBiquadFilter();
      this.bassBoostNode.type = "lowshelf";
      this.bassBoostNode.frequency.value = 80;
      this.bassBoostNode.gain.value = 0;

      // Stereo Panner Node for Left / Right balance
      if (typeof this.audioCtx.createStereoPanner === "function") {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.pan.value = 0;
      }

      // Limiter / Dynamics Compressor to prevent clipping & distortion
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -0.5; // dB
      this.limiterNode.knee.value = 10;       // dB
      this.limiterNode.ratio.value = 12;      // 12:1 compression for true peak limiting
      this.limiterNode.attack.value = 0.003;  // 3ms fast attack
      this.limiterNode.release.value = 0.25;  // 250ms smooth release

      // Connect the audio graph:
      // source -> preamp -> filter[0] -> ... -> filter[9] -> bassBoost -> [panner] -> limiter -> destination
      let lastNode: AudioNode = this.sourceNode;

      lastNode.connect(this.preampNode);
      lastNode = this.preampNode;

      for (const filter of this.filterNodes) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.bassBoostNode);
      lastNode = this.bassBoostNode;

      if (this.pannerNode) {
        lastNode.connect(this.pannerNode);
        lastNode = this.pannerNode;
      }

      lastNode.connect(this.limiterNode);
      this.limiterNode.connect(this.audioCtx.destination);

      this.isInitialized = true;

      // Apply initial cached values immediately to hardware graph
      this.applyAllValues();

      console.log("[Equalizer] Web Audio API 10-band pipeline successfully initialized and active.");
      return true;
    } catch (err) {
      console.warn("[Equalizer] Failed to initialize Web Audio pipeline:", err);
      return false;
    }
  }

  /**
   * Resumes AudioContext if suspended by browser autoplay policy.
   */
  public async ensureAudioContextRunning(): Promise<void> {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }
    } catch (e) {
      console.warn("[Equalizer] Could not resume audio context:", e);
    }
  }

  /**
   * Enables or bypasses the equalizer processing.
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.ensureAudioContextRunning().catch(() => {});
    this.applyAllValues();
  }

  /**
   * Updates all 10 frequency bands at once.
   */
  public setBands(bands: number[]): void {
    this.currentBands = [...bands];
    this.ensureAudioContextRunning().catch(() => {});
    if (this.isEnabled) {
      this.applyBands();
      this.applyPreampAndLimiter();
    }
  }

  /**
   * Updates a single frequency band gain in dB (-12 to +12).
   */
  public setBandGain(index: number, gainDb: number): void {
    if (index >= 0 && index < this.currentBands.length) {
      this.currentBands[index] = gainDb;
      this.ensureAudioContextRunning().catch(() => {});
      if (this.isEnabled && this.filterNodes[index] && this.audioCtx) {
        const clampedGain = Math.max(-12, Math.min(12, gainDb));
        const now = this.audioCtx.currentTime;
        this.filterNodes[index].gain.setTargetAtTime(clampedGain, now, 0.02);
        this.applyPreampAndLimiter();
      }
    }
  }

  /**
   * Updates Preamp gain in dB (-12 to +12).
   */
  public setPreamp(preampDb: number): void {
    this.currentPreamp = Math.max(-12, Math.min(12, preampDb));
    this.ensureAudioContextRunning().catch(() => {});
    if (this.isEnabled) {
      this.applyPreampAndLimiter();
    }
  }

  /**
   * Updates Bass Boost gain in dB (0 to +12).
   */
  public setBassBoost(bassBoostDb: number): void {
    this.currentBassBoost = Math.max(0, Math.min(12, bassBoostDb));
    this.ensureAudioContextRunning().catch(() => {});
    if (this.isEnabled) {
      if (this.bassBoostNode && this.audioCtx) {
        const now = this.audioCtx.currentTime;
        this.bassBoostNode.gain.setTargetAtTime(this.currentBassBoost, now, 0.02);
      }
      this.applyPreampAndLimiter();
    }
  }

  /**
   * Updates Left / Right balance (-1.0 Left to +1.0 Right).
   */
  public setBalance(balance: number): void {
    this.currentBalance = Math.max(-1, Math.min(1, balance));
    this.ensureAudioContextRunning().catch(() => {});
    if (this.isEnabled && this.pannerNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.pannerNode.pan.setTargetAtTime(this.currentBalance, now, 0.02);
    }
  }

  /**
   * Diagnostics status query
   */
  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      audioCtxState: this.audioCtx?.state || "uninitialized",
      bands: [...this.currentBands],
      preamp: this.currentPreamp,
      bassBoost: this.currentBassBoost,
      balance: this.currentBalance,
    };
  }

  /**
   * Applies all values to Web Audio graph nodes.
   */
  private applyAllValues(): void {
    if (!this.isInitialized || !this.audioCtx) return;

    if (!this.isEnabled) {
      // Flat / Bypass mode: set all gains to 0 dB, preamp to 1.0, bass boost to 0 dB, balance to 0
      const now = this.audioCtx.currentTime;
      for (const filter of this.filterNodes) {
        filter.gain.setTargetAtTime(0, now, 0.02);
      }
      if (this.bassBoostNode) {
        this.bassBoostNode.gain.setTargetAtTime(0, now, 0.02);
      }
      if (this.preampNode) {
        this.preampNode.gain.setTargetAtTime(1.0, now, 0.02);
      }
      if (this.pannerNode) {
        this.pannerNode.pan.setTargetAtTime(0, now, 0.02);
      }
    } else {
      this.applyBands();
      this.applyBassBoost();
      this.applyPreampAndLimiter();
      this.applyBalance();
    }
  }

  private applyBands(): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.filterNodes.forEach((filter, i) => {
      const gain = Math.max(-12, Math.min(12, this.currentBands[i] ?? 0));
      filter.gain.setTargetAtTime(gain, now, 0.02);
    });
  }

  private applyBassBoost(): void {
    if (!this.audioCtx || !this.bassBoostNode) return;
    const now = this.audioCtx.currentTime;
    const gain = Math.max(0, Math.min(12, this.currentBassBoost));
    this.bassBoostNode.gain.setTargetAtTime(gain, now, 0.02);
  }

  private applyBalance(): void {
    if (!this.audioCtx || !this.pannerNode) return;
    const now = this.audioCtx.currentTime;
    const pan = Math.max(-1, Math.min(1, this.currentBalance));
    this.pannerNode.pan.setTargetAtTime(pan, now, 0.02);
  }

  /**
   * Calculates safe overall gain including intelligent clipping prevention headroom.
   */
  private applyPreampAndLimiter(): void {
    if (!this.audioCtx || !this.preampNode) return;

    // Find maximum positive boost across all frequency bands and bass boost
    const maxBandBoost = Math.max(0, ...this.currentBands);
    const totalBoost = maxBandBoost + this.currentBassBoost * 0.5;

    // Calculate auto-attenuation headroom if user boosts heavily to avoid digital clipping
    const autoHeadroomDb = totalBoost > 4 ? -((totalBoost - 4) * 0.4) : 0;
    const effectivePreampDb = this.currentPreamp + autoHeadroomDb;

    // Convert dB to linear gain factor: 10^(dB/20)
    const linearGain = Math.pow(10, effectivePreampDb / 20);

    const now = this.audioCtx.currentTime;
    this.preampNode.gain.setTargetAtTime(linearGain, now, 0.02);
  }
}

export const equalizerEngine = new EqualizerAudioEngine();
