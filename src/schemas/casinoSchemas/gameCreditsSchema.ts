import { z } from 'zod';
import type { GameCredits } from '../../state/profiles/GameCredits';

export const gameCreditsSchema = z
  .object({
    beatTheHouseHalfChip: z.union([z.literal(0), z.literal(1)]),
  })
  .strict() satisfies z.ZodType<GameCredits>;
