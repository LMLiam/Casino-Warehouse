import { audioSettingsSchema } from '../../schemas/casinoSchemas/audioSettingsSchema';
import type { CasinoAudioSettings } from './CasinoAudioSettings';
import { defaultAudioSettings } from './defaultAudioSettings';

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

const clampVolume = (value: unknown, fallback: number): number => (Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : fallback);
