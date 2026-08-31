import type { z } from 'zod';
import { settlementIdSchema } from './settlementIdSchema';

export type SettlementId = z.infer<typeof settlementIdSchema>;
