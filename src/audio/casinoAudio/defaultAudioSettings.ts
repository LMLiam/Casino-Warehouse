import type { CasinoAudioSettings } from './CasinoAudioSettings';

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
