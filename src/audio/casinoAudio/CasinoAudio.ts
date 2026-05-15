import type { AudioCue } from './AudioCue';
import type { CasinoAudioSettings } from './CasinoAudioSettings';
import { defaultAudioSettings } from './defaultAudioSettings';
import { sanitizeAudioSettings } from './sanitizeAudioSettings';

export class CasinoAudio {
  private static readonly audibleGainFloor = 0.0001;
  private static readonly cueAttackSeconds = 0.015;
  private static readonly cueStopPaddingSeconds = 0.02;
  private static readonly musicFrequency = 110;
  private static readonly musicVolumeScale = 0.18;

  private static readonly cueConfig: Record<
    Exclude<AudioCue, 'music'>,
    { readonly type: OscillatorType; readonly startFrequency: number; readonly endFrequency: number; readonly duration: number; readonly volume: number }
  > = {
    deal: { type: 'square', startFrequency: 520, endFrequency: 380, duration: 0.08, volume: 0.22 },
    chip: { type: 'triangle', startFrequency: 760, endFrequency: 960, duration: 0.06, volume: 0.2 },
    spin: { type: 'sawtooth', startFrequency: 220, endFrequency: 620, duration: 0.32, volume: 0.16 },
    win: { type: 'triangle', startFrequency: 540, endFrequency: 1080, duration: 0.36, volume: 0.3 },
    bonus: { type: 'sine', startFrequency: 330, endFrequency: 1320, duration: 0.5, volume: 0.34 },
    ui: { type: 'sine', startFrequency: 640, endFrequency: 700, duration: 0.05, volume: 0.14 },
    ambience: { type: 'triangle', startFrequency: 120, endFrequency: 130, duration: 0.8, volume: 0.08 },
  };

  private context?: AudioContext;
  private musicOscillator?: OscillatorNode;
  private musicGain?: GainNode;
  private audioUnavailable = false;

  public constructor(private settings: CasinoAudioSettings = defaultAudioSettings()) {}

  public updateSettings(settings: CasinoAudioSettings): void {
    this.settings = sanitizeAudioSettings(settings);
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicLevel();
    }
    if (this.settings.muted) {
      this.stopMusic();
    }
  }

  public play(cue: Exclude<AudioCue, 'music'>): void {
    if (this.settings.muted) {
      return;
    }

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const now = context.currentTime;
    const config = CasinoAudio.cueConfig[cue];

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(config.endFrequency, now + config.duration);
    gain.gain.setValueAtTime(CasinoAudio.audibleGainFloor, now);
    gain.gain.exponentialRampToValueAtTime(this.cueLevel(cue) * config.volume, now + CasinoAudio.cueAttackSeconds);
    gain.gain.exponentialRampToValueAtTime(CasinoAudio.audibleGainFloor, now + config.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration + CasinoAudio.cueStopPaddingSeconds);
  }

  public toggleMusic(enabled: boolean): void {
    if (!enabled || this.settings.muted) {
      this.stopMusic();
      return;
    }

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    if (this.musicOscillator && this.musicGain) {
      this.musicGain.gain.value = this.musicLevel();
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = CasinoAudio.musicFrequency;
    gain.gain.value = this.musicLevel();
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    this.musicOscillator = oscillator;
    this.musicGain = gain;
  }

  private stopMusic(): void {
    this.musicOscillator?.stop();
    this.musicOscillator = undefined;
    this.musicGain = undefined;
  }

  private ensureContext(): AudioContext | undefined {
    if (this.audioUnavailable) {
      return undefined;
    }

    try {
      const AudioContextConstructor = globalThis.AudioContext as typeof AudioContext | undefined;
      if (!AudioContextConstructor) {
        this.audioUnavailable = true;
        return undefined;
      }
      this.context ??= new AudioContextConstructor();
    } catch {
      this.audioUnavailable = true;
      return undefined;
    }
    return this.context;
  }

  private musicLevel(): number {
    return this.settings.masterVolume * this.settings.musicVolume * CasinoAudio.musicVolumeScale;
  }

  private effectLevel(): number {
    return this.settings.masterVolume * this.settings.effectsVolume;
  }

  private cueLevel(cue: Exclude<AudioCue, 'music'>): number {
    const categoryVolume =
      cue === 'deal'
        ? this.settings.dealingVolume
        : cue === 'chip'
          ? this.settings.chipsVolume
          : cue === 'spin'
            ? this.settings.slotsVolume
            : cue === 'win'
              ? this.settings.winsVolume
              : cue === 'bonus'
                ? this.settings.bonusVolume
                : cue === 'ambience'
                  ? this.settings.ambienceVolume
                  : this.settings.uiVolume;
    return this.effectLevel() * categoryVolume;
  }
}
