import { z } from 'zod';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import { slotPhaseSchema } from './slotPhaseSchema';
import { jackpotTierSchema } from './jackpotTierSchema';
import { finiteNumberSchema } from './finiteNumberSchema';
import { slotSymbolSchema } from './slotSymbolSchema';
import { slotThemeIdSchema } from './slotThemeIdSchema';

export const slotSnapshotSchema = z
  .object({
    themeId: slotThemeIdSchema,
    themeTitle: z.string(),
    phase: slotPhaseSchema,
    wager: finiteNumberSchema,
    columns: z.int().positive(),
    rows: z.int().positive(),
    reels: z.array(slotSymbolSchema),
    lineWin: finiteNumberSchema,
    jackpotWin: z.object({ tier: jackpotTierSchema, label: z.string(), amount: finiteNumberSchema }).strict().optional(),
    bonusPicksRemaining: finiteNumberSchema,
    freeSpinsRemaining: finiteNumberSchema,
    bonusBank: finiteNumberSchema,
    returned: finiteNumberSchema,
    status: z.string(),
  })
  .strict() satisfies z.ZodType<SlotSnapshot>;
