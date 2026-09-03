import { z } from 'zod';
import { beatTheHouseRules } from '../../game/beatTheHouse/beatTheHouseRules';
import type { BeatTheHouseShoeSnapshot } from '../../game/beatTheHouse/shoe/BeatTheHouseShoeSnapshot';

export const beatTheHouseShoeSnapshotSchema = z
  .object({
    cardsRemaining: z.int().nonnegative().max(beatTheHouseRules.cardsPerShoe),
    cardsDealt: z.int().nonnegative().max(beatTheHouseRules.cardsPerShoe),
    totalCards: z.int().refine((value) => value === beatTheHouseRules.cardsPerShoe, 'Shoe must contain six decks.'),
    cutCardReached: z.boolean(),
  })
  .refine((snapshot) => snapshot.cardsRemaining + snapshot.cardsDealt === snapshot.totalCards, 'Shoe progress counts are inconsistent.')
  .strict() satisfies z.ZodType<BeatTheHouseShoeSnapshot>;
