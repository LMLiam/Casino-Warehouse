import { z } from 'zod';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import { slotPhaseSchema } from './slotPhaseSchema';
import { jackpotTierSchema } from './jackpotTierSchema';
import { slotSymbolSchema } from './slotSymbolSchema';
import { slotThemeIdSchema } from './slotThemeIdSchema';

export const slotSnapshotSchema = z
  .object({
    themeId: slotThemeIdSchema,
    themeTitle: z.string(),
    phase: slotPhaseSchema,
    wager: z.number().finite(),
    columns: z.number().int().positive(),
    rows: z.number().int().positive(),
    reels: z.array(slotSymbolSchema),
    lineWin: z.number().finite(),
    jackpotWin: z.object({ tier: jackpotTierSchema, label: z.string(), amount: z.number().finite() }).strict().optional(),
    bonusPicksRemaining: z.number().finite(),
    freeSpinsRemaining: z.number().finite(),
    bonusBank: z.number().finite(),
    returned: z.number().finite(),
    status: z.string(),
  })
  .strict() satisfies z.ZodType<SlotSnapshot>;
