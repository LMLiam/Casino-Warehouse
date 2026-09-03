import { z } from 'zod';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import { cardSchema } from './cardSchema';
import { gameSnapshotSchema } from './gameSnapshotSchema';
import { beatTheHouseShoeSaveStateSchema } from './beatTheHouseShoeSaveStateSchema';

export const beatTheHouseSaveStateSchema = gameSnapshotSchema
  .omit({ lastEvents: true, dealer: true, shoe: true })
  .extend({
    shoe: beatTheHouseShoeSaveStateSchema,
    dealer: z
      .object({
        cards: z.array(cardSchema),
        holeCard: cardSchema.optional(),
        holeRevealed: z.boolean(),
        bust: z.boolean(),
        blackAce: z.boolean(),
        finalCard: cardSchema.optional(),
      })
      .strict(),
    lastBets: gameSnapshotSchema.shape.bets.optional(),
  })
  .strict() satisfies z.ZodType<BeatTheHouseSaveState>;
