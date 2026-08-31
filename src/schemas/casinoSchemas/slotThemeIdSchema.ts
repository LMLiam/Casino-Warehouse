import { z } from 'zod';

export const slotThemeIdSchema = z.enum(['thai-princess']).brand<'slot-theme'>();
