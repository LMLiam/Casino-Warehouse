import { z } from 'zod';
import type { BeatTheHouseSettlementData } from '../../multiplayer/protocol/BeatTheHouseSettlementData';

export const beatTheHouseSettlementDataSchema = z
  .object({
    returnedHalfUnits: z.int().nonnegative(),
    profitHalfUnits: z.int(),
    halfChipBefore: z.union([z.literal(0), z.literal(1)]),
    halfChipAfter: z.union([z.literal(0), z.literal(1)]),
    wholeCreditsReleased: z.int().nonnegative(),
  })
  .strict() satisfies z.ZodType<BeatTheHouseSettlementData>;
