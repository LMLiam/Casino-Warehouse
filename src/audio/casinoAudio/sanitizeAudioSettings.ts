import { audioSettingsSchema } from '../../schemas/casinoSchemas/audioSettingsSchema';
import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import type { CasinoAudioSettings } from './CasinoAudioSettings';
import { defaultAudioSettings } from './defaultAudioSettings';

export const sanitizeAudioSettings = (settings: JsonValue | Partial<CasinoAudioSettings>): CasinoAudioSettings => {
  const parsed = audioSettingsSchema.safeParse(settings);
  return parsed.success ? parsed.data : defaultAudioSettings();
};
