class NotificationManager {
  constructor() {
    // Initial sound source (local fallback to remote)
    this.audio = new Audio("/sounds/iphone.mp3");
    this.audio.preload = "auto";

    this.isUnlocked = false;
    this.userInteracted = false;

    this.settings = {
      soundEnabled: true,
      volume: 0.7,
      muteWhenActive: true
    };

    this.init();
  }

  init() {
    this.unlockAudio();
    this.loadSettings();
  }

  unlockAudio() {
    const unlock = () => {
      if (this.userInteracted) return;

      // "Magic" unlock sequence for mobile browsers
      this.audio.play()
        .then(() => {
          this.audio.pause();
          this.audio.currentTime = 0;
          this.isUnlocked = true;
          console.log("🔊 Sparkle: Audio Engine Unlocked");
        })
        .catch((err) => {
            console.warn("🔊 Sparkle: Audio Unlock pending interaction...", err);
        });

      this.userInteracted = true;
    };

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
  }

  play(type = "default") {
    if (!this.settings.soundEnabled) return;

    // Optional: Don't play if user is actively focused on the tab
    if (this.settings.muteWhenActive && document.hasFocus()) {
       // Only mute if we are IN the chat that received the message? 
       // For now follow the requested focus-mute logic
       return; 
    }

    this.audio.volume = this.settings.volume;
    this.audio.currentTime = 0;
    
    this.audio.play().catch(err => {
      console.warn("🔊 Playback blocked or missing file, using remote fallback...");
      // Remote fallback for iphone.mp3
      const fallback = new Audio('https://cdn.jsdelivr.net/gh/clarix-ai/assets@main/notification.mp3');
      fallback.volume = this.settings.volume;
      fallback.play().catch(() => {});
    });

    this.vibrate();
  }

  vibrate() {
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }

  saveSettings() {
    localStorage.setItem("notificationSettings", JSON.stringify(this.settings));
  }

  loadSettings() {
    const saved = localStorage.getItem("notificationSettings");
    if (saved) {
      this.settings = JSON.parse(saved);
    }
  }

  toggleSound(enabled) {
    this.settings.soundEnabled = enabled !== undefined ? enabled : !this.settings.soundEnabled;
    this.saveSettings();
  }

  setVolume(value) {
    this.settings.volume = value;
    this.saveSettings();
  }
}

// Initialize globally
window.NotificationManager = new NotificationManager();
