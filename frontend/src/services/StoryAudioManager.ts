    // StoryAudioManager.ts - Global premium story audio manager using Web Audio API
class StoryAudioManager {
    private static instance: StoryAudioManager | null = null;

    private audio: HTMLAudioElement;
    private ctx: AudioContext | null = null;
    private source: MediaElementAudioSourceNode | null = null;
    private analyser: AnalyserNode | null = null;
    private gainNode: GainNode | null = null;
    private fadeInterval: any = null;

    private currentTrackUrl: string | null = null;
    private isInitialized = false;

    private constructor() {
        this.audio = new Audio();
        this.audio.crossOrigin = 'anonymous'; // Prevent CORS issues on Web Audio API
        this.audio.loop = true; // Loop audio while the story is visible
    }

    public static getInstance(): StoryAudioManager {
        if (!StoryAudioManager.instance) {
            StoryAudioManager.instance = new StoryAudioManager();
        }
        return StoryAudioManager.instance;
    }

    private initWebAudio() {
        if (this.isInitialized) return;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            this.ctx = new AudioContextClass();
            this.source = this.ctx.createMediaElementSource(this.audio);
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 64; // Small size for fast responsive wave bars visualizer
            
            this.gainNode = this.ctx.createGain();
            
            // Connection pipeline: Source -> Analyser -> GainNode -> Destination
            this.source.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.ctx.destination);
            
            this.isInitialized = true;
            console.log('[StoryAudioManager] Web Audio API context successfully initialized.');
        } catch (e) {
            console.error('[StoryAudioManager] Web Audio API failed to initialize:', e);
        }
    }

    public preload(url: string) {
        if (!url) return;
        try {
            const tempAudio = new Audio();
            tempAudio.src = url;
            tempAudio.preload = 'auto';
            tempAudio.load();
        } catch (err) {
            console.warn('[StoryAudioManager] Preload failed:', err);
        }
    }

    public async play(url: string, startOffset: number = 0, duration: number = 15) {
        if (!url) return;
        
        this.initWebAudio();
        
        // Resume AudioContext if suspended (browser autoplay restrictions)
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // If it's a new URL or not currently loaded, set src
        if (this.currentTrackUrl !== url) {
            this.audio.src = url;
            this.currentTrackUrl = url;
            this.audio.load();
        }

        this.audio.currentTime = startOffset;
        
        // Stop any active fading interval
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }

        if (this.gainNode && this.ctx) {
            // Web Audio fade in
            this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            this.audio.play().catch(e => console.warn('[StoryAudioManager] Play request failed/blocked:', e));
            this.gainNode.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.4); // 400ms fade-in
        } else {
            // Basic volume fade in fallback
            this.audio.volume = 1;
            this.audio.play().catch(e => console.warn('[StoryAudioManager] Play request failed/blocked:', e));
        }
    }

    public pause() {
        this.fadeOut(400, () => {
            this.audio.pause();
        });
    }

    public stop() {
        this.fadeOut(400, () => {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.currentTrackUrl = null;
        });
    }

    public fadeOut(durationMs: number = 400, callback?: () => void) {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }

        if (this.gainNode && this.ctx && !this.audio.paused) {
            const time = this.ctx.currentTime;
            try {
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, time);
                this.gainNode.gain.linearRampToValueAtTime(0, time + durationMs / 1000);
            } catch (err) {
                // Fallback if parameter setting fails
                this.audio.volume = 0;
            }
            
            setTimeout(() => {
                if (callback) callback();
            }, durationMs);
        } else {
            // Fallback interval fade for non-Web Audio browsers
            let vol = this.audio.volume;
            if (vol === 0 || this.audio.paused) {
                if (callback) callback();
                return;
            }
            const step = vol / (durationMs / 30);
            this.fadeInterval = setInterval(() => {
                vol = Math.max(0, vol - step);
                this.audio.volume = vol;
                if (vol === 0) {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    this.audio.pause();
                    this.audio.volume = 1; // restore volume limit
                    if (callback) callback();
                }
            }, 30);
        }
    }

    public getByteFrequencyData(): Uint8Array {
        if (!this.analyser) {
            return new Uint8Array(0);
        }
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    public dispose() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        this.audio.pause();
        this.audio.src = '';
        this.currentTrackUrl = null;
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this.source = null;
        this.analyser = null;
        this.gainNode = null;
        this.isInitialized = false;
    }
}

export default StoryAudioManager;
