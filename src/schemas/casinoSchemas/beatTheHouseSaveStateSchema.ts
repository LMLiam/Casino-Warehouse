import { z } from 'zod';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import { cardSchema } from './cardSchema';
import { gameSnapshotSchema } from './gameSnapshotSchema';

export const beatTheHouseSaveStateSchema = gameSnapshotSchema
  .omit({ lastEvents: true })
  .extend({
    deck: z.array(cardSchema),
    lastBets: gameSnapshotSchema.shape.bets.optional(),
  })
  .strict() satisfies z.ZodType<BeatTheHouseSaveState>;
