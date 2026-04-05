class NotificationManager {
  constructor() {
    this.audio = new Audio("/sounds/iphone.mp3");
    this.audio.preload = "auto";
    this.unlocked = false;

    this.settings = {
      soundEnabled: true,
      volume: 1.0, // Set to max for performance/clarity
      muteWhenActive: false // Default to false for better feedback
    };

    this.init();
  }

  init() {
    this.loadSettings();
    this.setupUnlock();
  }

  setupUnlock() {
    const unlock = () => {
      if (this.unlocked) return;
      
      // Attempt to prime the audio engine
      this.audio.play()
        .then(() => {
          this.audio.pause();
          this.audio.currentTime = 0;
          this.unlocked = true;
          console.log("🔊 Sparkle: Audio Engine Unlocked via user action");
          this.cleanupUnlock();
        })
        .catch(err => {
          // Still blocked, wait for next interaction
        });
    };

    this._unlockHandler = unlock;
    document.addEventListener("mousedown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock);
    document.addEventListener("click", unlock);
  }

  cleanupUnlock() {
    document.removeEventListener("mousedown", this._unlockHandler);
    document.removeEventListener("keydown", this._unlockHandler);
    document.removeEventListener("touchstart", this._unlockHandler);
    document.removeEventListener("click", this._unlockHandler);
  }

  play(type = "default") {
    if (!this.settings.soundEnabled || !this.unlocked) return;

    // Reset and Fire
    this.audio.volume = this.settings.volume;
    this.audio.currentTime = 0;

    const playPromise = this.audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // If it still fails even after "unlocked" (browser edge case), fail silently
        if (error.name === "NotAllowedError") return;
        
        console.warn("🔊 Local sound blocked or missing. Attempting remote fallback...");
        const fallback = new Audio('https://cdn.jsdelivr.net/gh/clarix-ai/assets@main/iphone_ping.mp3');
        fallback.volume = this.settings.volume;
        fallback.play().catch(e => {
            // Silently ignore fallback failure if it's a browser restriction
        });
      });
    }

    this.vibrate();
  }

  vibrate() {
    // Only vibrate if unlocked and supported
    if (this.unlocked && "vibrate" in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {
        // Ignore vibration errors (mostly browser permissions)
      }
    }
  }

  saveSettings() {
    localStorage.setItem("sparkle_notif_settings", JSON.stringify(this.settings));
  }

  loadSettings() {
    const saved = localStorage.getItem("sparkle_notif_settings");
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
  }

  test() {
    console.log("🔊 Testing notification sound...");
    this.play();
  }
}

// Global Singleton
window.NotificationManager = new NotificationManager();
