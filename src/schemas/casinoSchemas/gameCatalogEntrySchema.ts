import { z } from 'zod';
import { hexColourSchema } from './hexColourSchema';
import { roomGameIdSchema } from './roomGameIdSchema';
import { slotThemeSchema } from './slotThemeSchema';

export const gameCatalogEntrySchema = z
  .object({
    id: roomGameIdSchema,
    title: z.string().min(1),
    kind: z.enum(['beat-the-house', 'blackjack', 'slots']),
    description: z.string().min(1),
    accent: hexColourSchema,
    rules: z.array(z.string().min(1)).min(1),
    paytable: z.array(z.string().min(1)).min(1),
    slotTheme: slotThemeSchema.optional(),
  })
  .strict();
