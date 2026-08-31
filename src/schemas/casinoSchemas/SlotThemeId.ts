import type { z } from 'zod';
import { slotThemeIdSchema } from './slotThemeIdSchema';

export type SlotThemeId = z.infer<typeof slotThemeIdSchema>;
