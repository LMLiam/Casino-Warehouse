import { z } from 'zod';
import { beatTheHouseRules } from '../../game/beatTheHouse/beatTheHouseRules';
import type { BeatTheHouseShoeSaveState } from '../../game/beatTheHouse/shoe/BeatTheHouseShoeSaveState';
import { cardSchema } from './cardSchema';

export const beatTheHouseShoeSaveStateSchema = z
  .object({
    remainingCards: z.array(cardSchema).max(beatTheHouseRules.cardsPerShoe).readonly(),
    totalCards: z.int().refine((value) => value === beatTheHouseRules.cardsPerShoe, 'Shoe must contain six decks.'),
    cutThresholdCardsDealt: z.int().min(beatTheHouseRules.cutThreshold.minimum).max(beatTheHouseRules.cutThreshold.maximum),
    shufflePending: z.boolean(),
  })
  .superRefine((state, context) => {
    const cardsDealt = state.totalCards - state.remainingCards.length;
    if (state.shufflePending !== cardsDealt >= state.cutThresholdCardsDealt) {
      context.addIssue({ code: 'custom', path: ['shufflePending'], message: 'Shoe cut state is inconsistent.' });
    }

    const physicalCounts = new Map<string, number>();
    for (const card of state.remainingCards) {
      const key = `${card.rank}|${card.suit}`;
      const count = (physicalCounts.get(key) ?? 0) + 1;
      if (count > beatTheHouseRules.deckCount) {
        context.addIssue({ code: 'custom', path: ['remainingCards'], message: 'Shoe contains too many copies of a physical card.' });
        break;
      }
      physicalCounts.set(key, count);
    }
  })
  .strict() satisfies z.ZodType<BeatTheHouseShoeSaveState>;
