import { z } from 'zod';

export const jackpotTierSchema = z.enum(['mini', 'minor', 'major', 'grand']);
