import { logger } from '../../utils/logger';
export interface PoolStats {
  activeCount: number;
  maxSize: number;
}

export class AudioPool {
  private audioCtx: AudioContext;
  private soundUrl: string;
  private maxSize: number;
  private audioBuffer: AudioBuffer | null = null;
  private activeNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];

  constructor(audioCtx: AudioContext, soundUrl: string, maxSize: number) {
    this.audioCtx = audioCtx;
    this.soundUrl = soundUrl;
    this.maxSize = maxSize;
  }

  /**
   * Pre-loads the audio file and decodes the buffer.
   */
  public async warm(): Promise<void> {
    try {
      const response = await fetch(this.soundUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sound at ${this.soundUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
      logger.warn(`[AudioPool] Failed to warm pool for ${this.soundUrl}:`, e);
    }
  }

  /**
   * Plays a sound from the pool.
   * If the active nodes exceed maxSize, the oldest active sound is stopped.
   */
  public play(options: {
    volume: number;
    playbackRate: number;
    loop: boolean;
    applyLowpass?: boolean;
  }): void {
    if (!this.audioBuffer) {
      logger.warn(`[AudioPool] Sound buffer not warmed/loaded for: ${this.soundUrl}`);
      return;
    }

    // 1. Enforce pool capacity limit
    if (this.activeNodes.length >= this.maxSize) {
      const oldest = this.activeNodes.shift();
      if (oldest) {
        try {
          oldest.source.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }
    }

    // 2. Create nodes
    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = this.audioBuffer;
    sourceNode.playbackRate.setValueAtTime(options.playbackRate, this.audioCtx.currentTime);
    sourceNode.loop = options.loop;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(options.volume, this.audioCtx.currentTime);

    let lastNode: AudioNode = sourceNode;

    // Apply Soft theme lowpass filter if requested
    if (options.applyLowpass) {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1300, this.audioCtx.currentTime);
      lastNode.connect(filter);
      lastNode = filter;
    }

    // Connect pipeline
    lastNode.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    // Play
    sourceNode.start(0);

    const nodeEntry = { source: sourceNode, gain: gainNode };
    this.activeNodes.push(nodeEntry);

    // 3. Cleanup on ended
    sourceNode.onended = () => {
      this.activeNodes = this.activeNodes.filter((item) => item.source !== sourceNode);
    };
  }

  /**
   * Stops all active playbacks in this pool.
   */
  public stopAll(): void {
    this.activeNodes.forEach((node) => {
      try {
        node.source.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    this.activeNodes = [];
  }

  /**
   * Gets current pool usage stats.
   */
  public getUsage(): PoolStats {
    return {
      activeCount: this.activeNodes.length,
      maxSize: this.maxSize,
    };
  }
}
