import { z } from 'zod';
import type { HouseAdvanceState } from '../../state/profiles/HouseAdvanceState';
import { houseAdvanceConfig } from '../../state/profiles/houseAdvanceConfig';
import { creditSchema } from './creditSchema';
import { finiteNumberSchema } from './finiteNumberSchema';

export const houseAdvanceStateSchema = z
  .object({
    outstandingBalance: creditSchema,
    activeCount: finiteNumberSchema.int().min(0).max(houseAdvanceConfig.maxActiveCount),
  })
  .strict() satisfies z.ZodType<HouseAdvanceState>;
