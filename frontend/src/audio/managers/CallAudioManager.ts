import { EventBus } from '../EventBus';

export class CallAudioManager {
  private static instance: CallAudioManager | null = null;
  private activeCallStatus: 'idle' | 'ringing' | 'connecting' | 'busy' = 'idle';
  private eventBus: EventBus;

  constructor(audioCtx: AudioContext | null, eventBus: EventBus) {
    this.eventBus = eventBus;

    // Listen to call commands
    this.eventBus.on('call_ringtone', () => this.playRingtone());
    this.eventBus.on('call_connecting', () => this.playConnecting());
    this.eventBus.on('call_busy', () => this.playBusy());
    this.eventBus.on('call_hangup', () => this.playHangup());
    this.eventBus.on('call_stop', () => this.stopAll());
  }

  public static getInstance(audioCtx?: AudioContext, eventBus?: EventBus): CallAudioManager {
    if (!CallAudioManager.instance) {
      if (!eventBus) {
        throw new Error('EventBus required to initialize CallAudioManager');
      }
      CallAudioManager.instance = new CallAudioManager(audioCtx || null, eventBus);
    }
    return CallAudioManager.instance;
  }

  public playRingtone(): void {
    this.stopAll();
    this.activeCallStatus = 'ringing';
    this.eventBus.emit('play_sound', 'ringtone', { loop: true });
  }

  public playConnecting(): void {
    this.stopAll();
    this.activeCallStatus = 'connecting';
    this.eventBus.emit('play_sound', 'connecting', { loop: true });
  }

  public playBusy(): void {
    this.stopAll();
    this.activeCallStatus = 'busy';
    this.eventBus.emit('play_sound', 'busy');
  }

  public playHangup(): void {
    this.stopAll();
    this.activeCallStatus = 'idle';
    this.eventBus.emit('play_sound', 'hangup');
  }

  public stopAll(): void {
    this.eventBus.emit('stop_sound', 'ringtone');
    this.eventBus.emit('stop_sound', 'connecting');
    this.eventBus.emit('stop_sound', 'busy');
    this.eventBus.emit('stop_sound', 'hangup');
    this.activeCallStatus = 'idle';
  }

  public getStatus(): string {
    return this.activeCallStatus;
  }
}
