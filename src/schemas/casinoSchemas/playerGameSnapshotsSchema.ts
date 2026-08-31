import { z } from 'zod';
import type { PlayerGameSnapshots } from '../../state/session/PlayerGameSnapshots';
import { beatTheHouseSaveStateSchema } from './beatTheHouseSaveStateSchema';
import { blackjackSnapshotSchema } from './blackjackSnapshotSchema';
import { slotSnapshotSchema } from './slotSnapshotSchema';
import { slotThemeIdSchema } from './slotThemeIdSchema';

export const playerGameSnapshotsSchema = z
  .object({
    beatTheHouse: beatTheHouseSaveStateSchema.optional(),
    blackjack: blackjackSnapshotSchema.optional(),
    slots: z.partialRecord(slotThemeIdSchema, slotSnapshotSchema).optional(),
  })
  .strict() satisfies z.ZodType<PlayerGameSnapshots>;
