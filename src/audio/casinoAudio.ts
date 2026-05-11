import { audioSettingsSchema } from '../schemas/casinoSchemas';

export type AudioCue = 'music' | 'deal' | 'chip' | 'spin' | 'win' | 'bonus' | 'ui' | 'ambience';

export interface CasinoAudioSettings {
  readonly muted: boolean;
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly dealingVolume: number;
  readonly chipsVolume: number;
  readonly slotsVolume: number;
  readonly winsVolume: number;
  readonly bonusVolume: number;
  readonly uiVolume: number;
  readonly ambienceVolume: number;
}

export const defaultAudioSettings = (): CasinoAudioSettings => ({
  muted: false,
  masterVolume: 0.55,
  musicVolume: 0.22,
  effectsVolume: 0.7,
  dealingVolume: 0.65,
  chipsVolume: 0.75,
  slotsVolume: 0.7,
  winsVolume: 0.8,
  bonusVolume: 0.85,
  uiVolume: 0.45,
  ambienceVolume: 0.25,
});

export const sanitizeAudioSettings = (settings: Partial<CasinoAudioSettings>): CasinoAudioSettings => {
  const parsed = audioSettingsSchema.safeParse(settings);
  if (parsed.success) {
    return parsed.data;
  }
  const defaults = defaultAudioSettings();
  return {
    muted: Boolean(settings.muted),
    masterVolume: clampVolume(settings.masterVolume, defaults.masterVolume),
    musicVolume: clampVolume(settings.musicVolume, defaults.musicVolume),
    effectsVolume: clampVolume(settings.effectsVolume, defaults.effectsVolume),
    dealingVolume: clampVolume(settings.dealingVolume, defaults.dealingVolume),
    chipsVolume: clampVolume(settings.chipsVolume, defaults.chipsVolume),
    slotsVolume: clampVolume(settings.slotsVolume, defaults.slotsVolume),
    winsVolume: clampVolume(settings.winsVolume, defaults.winsVolume),
    bonusVolume: clampVolume(settings.bonusVolume, defaults.bonusVolume),
    uiVolume: clampVolume(settings.uiVolume, defaults.uiVolume),
    ambienceVolume: clampVolume(settings.ambienceVolume, defaults.ambienceVolume),
  };
};

export class CasinoAudio {
  private context?: AudioContext;
  private musicOscillator?: OscillatorNode;
  private musicGain?: GainNode;

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
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const now = context.currentTime;
    const config = cueConfig[cue];

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(config.endFrequency, now + config.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(this.cueLevel(cue) * config.volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration + 0.02);
  }

  public toggleMusic(enabled: boolean): void {
    if (!enabled || this.settings.muted) {
      this.stopMusic();
      return;
    }

    const context = this.ensureContext();
    if (this.musicOscillator && this.musicGain) {
      this.musicGain.gain.value = this.musicLevel();
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 110;
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

  private ensureContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  private musicLevel(): number {
    return this.settings.masterVolume * this.settings.musicVolume * 0.18;
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

const cueConfig: Record<
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

const clampVolume = (value: unknown, fallback: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : fallback);
