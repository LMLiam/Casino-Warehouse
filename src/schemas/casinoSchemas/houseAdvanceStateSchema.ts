import { z } from 'zod';
import { houseAdvanceConfig } from '../../state/profiles/houseAdvanceConfig';
import { creditSchema } from './creditSchema';

export const houseAdvanceStateSchema = z.object({
  outstandingBalance: creditSchema.default(0),
  activeCount: z.coerce.number().finite().int().min(0).max(houseAdvanceConfig.maxActiveCount).default(0),
});
