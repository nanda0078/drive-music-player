/**
 * Background Audio & Media Session Service
 * 
 * Provides robust background audio persistence, Media Session API integration,
 * WakeLock management, and Capacitor / Android Foreground Service compatibility.
 */

import { MusicTrack } from "../types/music";

class BackgroundAudioService {
  private wakeLockSentinel: any = null;
  private isWakeLockRequested: boolean = false;
  private workerTimer: Worker | null = null;
  private timerCallbacks: Map<string, () => void> = new Map();

  constructor() {
    this.initVisibilityListener();
    this.initBackgroundWorkerTimer();
  }

  /**
   * Initialize lightweight Web Worker to prevent timer throttling in background tabs / locked screens
   */
  private initBackgroundWorkerTimer() {
    try {
      if (typeof window !== "undefined" && typeof Worker !== "undefined") {
        const workerBlob = new Blob(
          [
            `
            let timers = {};
            self.onmessage = function(e) {
              const { id, action, interval } = e.data;
              if (action === 'start') {
                if (timers[id]) clearInterval(timers[id]);
                timers[id] = setInterval(function() {
                  self.postMessage({ id });
                }, interval || 1000);
              } else if (action === 'stop') {
                if (timers[id]) {
                  clearInterval(timers[id]);
                  delete timers[id];
                }
              }
            };
            `,
          ],
          { type: "application/javascript" }
        );
        const workerUrl = URL.createObjectURL(workerBlob);
        this.workerTimer = new Worker(workerUrl);
        this.workerTimer.onmessage = (e) => {
          const { id } = e.data;
          const cb = this.timerCallbacks.get(id);
          if (cb) cb();
        };
      }
    } catch (e) {
      console.warn("[BackgroundAudio] Web Worker timer not available, using fallback:", e);
    }
  }

  /**
   * Start a reliable background interval
   */
  public setBackgroundInterval(id: string, callback: () => void, intervalMs: number = 1000) {
    this.timerCallbacks.set(id, callback);
    if (this.workerTimer) {
      this.workerTimer.postMessage({ id, action: "start", interval: intervalMs });
    }
  }

  /**
   * Start reliable background audio watchdog via Web Worker (immune to mobile CPU/tab throttling)
   */
  public startPlaybackWatchdog(callback: () => void) {
    this.setBackgroundInterval("playback_watchdog", callback, 2500);
  }

  /**
   * Stop background audio watchdog
   */
  public stopPlaybackWatchdog() {
    this.clearBackgroundInterval("playback_watchdog");
  }

  /**
   * Clear a background interval
   */
  public clearBackgroundInterval(id: string) {
    this.timerCallbacks.delete(id);
    if (this.workerTimer) {
      this.workerTimer.postMessage({ id, action: "stop" });
    }
  }

  /**
   * Acquire Screen / System WakeLock to ensure audio continues playing on mobile
   */
  public async requestWakeLock(): Promise<void> {
    this.isWakeLockRequested = true;
    if ("wakeLock" in navigator && typeof (navigator as any).wakeLock?.request === "function") {
      try {
        if (!this.wakeLockSentinel) {
          this.wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
          this.wakeLockSentinel.addEventListener("release", () => {
            this.wakeLockSentinel = null;
          });
        }
      } catch (err: any) {
        // Wake lock can fail if low battery or permission denied
        console.log("[BackgroundAudio] WakeLock request notice:", err?.message || err);
      }
    }

    // Capacitor Native Bridge support if available
    this.enableCapacitorBackgroundMode();
  }

  /**
   * Release WakeLock when audio stops or is paused
   */
  public releaseWakeLock(): void {
    this.isWakeLockRequested = false;
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release().catch(() => {});
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Re-acquire WakeLock on visibility change if audio is still actively playing
   */
  private initVisibilityListener() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && this.isWakeLockRequested && !this.wakeLockSentinel) {
          await this.requestWakeLock();
        }
      });
    }
  }

  /**
   * Configure Capacitor background mode / foreground service if running inside Android / iOS native wrapper
   */
  private enableCapacitorBackgroundMode() {
    try {
      const win = typeof window !== "undefined" ? (window as any) : null;
      if (!win) return;

      // 1. Check for standard Capacitor Background Mode plugin
      const Cap = win.Capacitor;
      if (Cap?.Plugins?.BackgroundMode) {
        Cap.Plugins.BackgroundMode.enable().catch(() => {});
        Cap.Plugins.BackgroundMode.setSettings?.({
          title: "Drive Music Player",
          text: "Memutar musik di latar belakang",
          icon: "icon",
          color: "2563EB",
          resume: true,
          hidden: false,
          bigText: true,
        }).catch(() => {});
      }

      // 2. Check for Capacitor Music Controls / Foreground Service
      if (Cap?.Plugins?.ForegroundService) {
        Cap.Plugins.ForegroundService.start({
          title: "Drive Music Player",
          body: "Memutar lagu di latar belakang",
          id: 1001,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("[BackgroundAudio] Capacitor native bridge check notice:", e);
    }
  }

  /**
   * Generate crisp high-resolution artwork for Android Notification, Lockscreen & Car displays
   */
  public generateArtworkSvg(title: string, artist: string): string {
    const safeTitle = (title || "Drive Music").slice(0, 24).replace(/[<>&"]/g, "");
    const safeArtist = (artist || "Google Drive").slice(0, 24).replace(/[<>&"]/g, "");

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E3A8A"/>
            <stop offset="50%" stop-color="#2563EB"/>
            <stop offset="100%" stop-color="#4F46E5"/>
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect width="512" height="512" rx="64" fill="url(#bgGrad)"/>
        <circle cx="256" cy="210" r="96" fill="#FFFFFF" fill-opacity="0.12" filter="url(#glow)"/>
        <path d="M224 160v100a40 40 0 1 1-28-38.3V184l88-20v76a40 40 0 1 1-28-38.3V140l-120 20z" fill="#FFFFFF"/>
        <text x="256" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF" text-anchor="middle">${safeTitle}</text>
        <text x="256" y="424" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#93C5FD" text-anchor="middle">${safeArtist}</text>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
  }

  /**
   * Setup Media Session API metadata & action handlers
   */
  public updateMediaSession(
    track: MusicTrack | null,
    isPlaying: boolean,
    actions: {
      onPlay: () => void;
      onPause: () => void;
      onPrevious: () => void;
      onNext: () => void;
      onSeekTo: (position: number) => void;
      onSeekBackward: (offset?: number) => void;
      onSeekForward: (offset?: number) => void;
      onStop: () => void;
    }
  ) {
    if (!("mediaSession" in navigator)) return;

    if (track) {
      const defaultArt = this.generateArtworkSvg(track.title, track.artist || "Drive Music");
      const artworkSrc = track.artworkUrl || defaultArt;
      const isSvg = artworkSrc.startsWith("data:image/svg") || artworkSrc.endsWith(".svg");
      const artworkType = isSvg ? "image/svg+xml" : "image/png";

      const artwork = [
        { src: artworkSrc, sizes: "96x96", type: artworkType },
        { src: artworkSrc, sizes: "128x128", type: artworkType },
        { src: artworkSrc, sizes: "192x192", type: artworkType },
        { src: artworkSrc, sizes: "256x256", type: artworkType },
        { src: artworkSrc, sizes: "384x384", type: artworkType },
        { src: artworkSrc, sizes: "512x512", type: artworkType },
      ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || "Lagu Tanpa Judul",
        artist: track.artist || "Artis Tidak Diketahui",
        album: track.folderName ? `Folder: ${track.folderName}` : track.album || "Drive Music Player",
        artwork,
      });

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      // Register Handlers defensively
      try {
        navigator.mediaSession.setActionHandler("play", actions.onPlay);
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("pause", actions.onPause);
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("previoustrack", actions.onPrevious);
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("nexttrack", actions.onNext);
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            actions.onSeekTo(details.seekTime);
          }
        });
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("seekbackward", (details) => {
          actions.onSeekBackward(details.seekOffset || 10);
        });
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("seekforward", (details) => {
          actions.onSeekForward(details.seekOffset || 10);
        });
      } catch {}
      try {
        navigator.mediaSession.setActionHandler("stop", actions.onStop);
      } catch {}
    } else {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    }
  }

  /**
   * Update current playback position in OS Lockscreen / Media Notification Seekbar
   */
  public updatePositionState(currentTime: number, duration: number, playbackRate: number = 1) {
    if ("mediaSession" in navigator && duration > 0) {
      try {
        const validPos = Math.max(0, Math.min(currentTime, duration));
        navigator.mediaSession.setPositionState({
          duration: Math.max(0.1, duration),
          playbackRate: playbackRate || 1,
          position: validPos,
        });
      } catch {
        // Silently ignore unsupported position state
      }
    }
  }
}

export const backgroundAudioService = new BackgroundAudioService();
