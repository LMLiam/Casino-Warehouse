import { z } from 'zod';
import { audioSettingsSchema } from './audioSettingsSchema';

export type CasinoAudioSettingsFromSchema = z.infer<typeof audioSettingsSchema>;
