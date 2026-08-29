import { z } from 'zod';
import { hexColourSchema } from './hexColourSchema';
import { jackpotTierSchema } from './jackpotTierSchema';
import { slotSymbolSchema } from './slotSymbolSchema';
import { slotThemeIdSchema } from './slotThemeIdSchema';

export const slotThemeSchema = z
  .object({
    id: slotThemeIdSchema,
    title: z.string().min(1),
    accent: hexColourSchema,
    columns: z.number().int().min(3).max(3),
    rows: z.number().int().min(5).max(5),
    wildSymbol: slotSymbolSchema.optional(),
    reelStrip: z.array(slotSymbolSchema).min(3, 'Slot reel strips need at least three symbols.'),
    payouts: z.partialRecord(slotSymbolSchema, z.number().int().positive()),
    jackpots: z.partialRecord(
      jackpotTierSchema,
      z
        .object({
          symbol: slotSymbolSchema,
          multiplier: z.number().int().positive(),
          label: z.string().min(1),
        })
        .strict(),
    ),
    bonus: z
      .object({
        triggerSymbol: slotSymbolSchema,
        picks: z.number().int().positive(),
        freeSpinsOnTwoBonus: z.number().int().nonnegative(),
        multipliers: z.array(z.number().int().positive()).min(1),
      })
      .strict(),
  })
  .strict();
