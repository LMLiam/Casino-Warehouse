import { z } from 'zod';
import type { BeatTheHouseSettlementReceipt } from '../../state/serverDataStore/BeatTheHouseSettlementReceipt';
import { houseAdvanceStateSchema } from './houseAdvanceStateSchema';
import { isoTimestampSchema } from './isoTimestampSchema';
import { profileIdSchema } from './profileIdSchema';
import { roomIdSchema } from './roomIdSchema';
import { sessionIdSchema } from './sessionIdSchema';

export const beatTheHouseSettlementReceiptSchema = z
  .object({
    settlementKey: z.string().min(1),
    profileId: profileIdSchema,
    profileCreatedAt: isoTimestampSchema,
    gameId: z.literal('beat-the-house'),
    roomId: roomIdSchema.optional(),
    sessionId: sessionIdSchema.optional(),
    returnedHalfUnits: z.int().nonnegative(),
    profitHalfUnits: z.int(),
    halfChipBefore: z.union([z.literal(0), z.literal(1)]),
    halfChipAfter: z.union([z.literal(0), z.literal(1)]),
    wholeCreditsReleased: z.int().nonnegative(),
    houseAdvanceRepayment: z.int().nonnegative(),
    bankrollAfter: z.int().nonnegative(),
    houseAdvanceAfter: houseAdvanceStateSchema,
  })
  .strict()
  .superRefine((receipt, refinementContext) => {
    const stakeHalfUnits = receipt.returnedHalfUnits - receipt.profitHalfUnits;
    if (!Number.isSafeInteger(stakeHalfUnits) || stakeHalfUnits < 0 || stakeHalfUnits % 2 !== 0) {
      refinementContext.addIssue({ code: 'custom', message: 'Receipt values must describe a whole-chip stake.' });
    }

    const totalHalfUnits = receipt.halfChipBefore + receipt.returnedHalfUnits;
    const releasedHalfUnits = receipt.wholeCreditsReleased * 2;
    const conservedHalfUnits = releasedHalfUnits + receipt.halfChipAfter;
    if (
      !Number.isSafeInteger(totalHalfUnits) ||
      !Number.isSafeInteger(releasedHalfUnits) ||
      !Number.isSafeInteger(conservedHalfUnits) ||
      totalHalfUnits !== conservedHalfUnits ||
      receipt.houseAdvanceRepayment > receipt.wholeCreditsReleased
    ) {
      refinementContext.addIssue({ code: 'custom', message: 'Receipt values do not describe a safe settlement transition.' });
    }
  }) satisfies z.ZodType<BeatTheHouseSettlementReceipt>;
