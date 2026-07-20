export type SoundTheme = 'Sparkle Original' | 'Classic' | 'Soft' | 'Minimal';

export class ThemeController {
  private currentTheme: SoundTheme = 'Sparkle Original';

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const stored = localStorage.getItem('sparkle_audio_theme');
      if (stored) {
        this.currentTheme = stored as SoundTheme;
      }
    } catch (e) {
      console.warn('[ThemeController] Failed to load theme setting:', e);
    }
  }

  public save(): void {
    try {
      localStorage.setItem('sparkle_audio_theme', this.currentTheme);
    } catch (e) {
      console.warn('[ThemeController] Failed to save theme setting:', e);
    }
  }

  public getCurrentTheme(): SoundTheme {
    return this.currentTheme;
  }

  public setTheme(theme: SoundTheme): void {
    this.currentTheme = theme;
    this.save();
  }

  /**
   * Resolves the asset URL for a given sound filename under the current theme.
   * If a theme other than 'Sparkle Original' is selected, it attempts to load from the theme's subfolder.
   * Standardizes paths: `/sounds/themes/minimal/send.mp3`, etc.
   */
  public resolveSoundUrl(filename: string): string {
    const isGlobalUploadedSound = [
      'iphone.mp3',
      'sparkle Facebook notification.mp3',
      'inchat message receive.mp3',
      'outchat notification.mp3'
    ].includes(filename);

    if (this.currentTheme === 'Sparkle Original' || isGlobalUploadedSound) {
      return `/sounds/${filename}`;
    }
    const themeDir = this.currentTheme.toLowerCase().replace(' ', '_');
    return `/sounds/themes/${themeDir}/${filename}`;
  }

  public reset(): void {
    this.currentTheme = 'Sparkle Original';
    this.save();
  }
}
