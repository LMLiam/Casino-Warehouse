import { z } from 'zod';
import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import { casinoProfileSchema } from './casinoProfileSchema';

export const casinoSaveStateSchema = z
  .object({
    profiles: z.array(casinoProfileSchema),
  })
  .strict() satisfies z.ZodType<CasinoSaveState>;
