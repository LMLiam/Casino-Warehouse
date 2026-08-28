import { z } from 'zod';
import type { Card } from '../../game/cards/Card';
import { ranks } from '../../game/cards/ranks';
import { suits } from '../../game/cards/suits';

export const cardSchema = z
  .object({
    rank: z.enum(ranks),
    suit: z.enum(suits),
  })
  .strict() satisfies z.ZodType<Card>;
