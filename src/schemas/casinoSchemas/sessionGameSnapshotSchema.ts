import { z } from 'zod';
import type { PlayerGameSnapshots } from '../../state/session/PlayerGameSnapshots';

export const sessionGameSnapshotSchema = (() => {
  const snapshotObjectSchema = z.object({}).passthrough();
  const snapshotEnvelopeSchema = z.object({
    beatTheHouse: snapshotObjectSchema.optional(),
    blackjack: snapshotObjectSchema.optional(),
    slots: z.record(z.string(), snapshotObjectSchema).optional(),
  });

  return z.custom<PlayerGameSnapshots>((value) => snapshotEnvelopeSchema.safeParse(value).success);
})();
