import { z } from 'zod';
import { volumeSchema } from './volumeSchema';

export const audioSettingsSchema = z.object({
  muted: z.coerce.boolean().default(false),
  masterVolume: volumeSchema.default(0.55),
  musicVolume: volumeSchema.default(0.22),
  effectsVolume: volumeSchema.default(0.7),
  dealingVolume: volumeSchema.default(0.65),
  chipsVolume: volumeSchema.default(0.75),
  slotsVolume: volumeSchema.default(0.7),
  winsVolume: volumeSchema.default(0.8),
  bonusVolume: volumeSchema.default(0.85),
  uiVolume: volumeSchema.default(0.45),
  ambienceVolume: volumeSchema.default(0.25),
});
