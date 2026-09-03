import type { Card } from '../../../src/game/cards/Card';
import { createBeatTheHouseShoeCards } from '../../../src/game/beatTheHouse/shoe/createBeatTheHouseShoeCards';
import { BeatTheHouseShoe } from '../../../src/game/beatTheHouse/shoe/BeatTheHouseShoe';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';

export const createDeterministicBeatTheHouseShoe = (options: {
  readonly dealOrder: readonly Card[];
  readonly cardsDealt?: number;
  readonly cutThresholdCardsDealt?: number;
}): BeatTheHouseShoe => {
  const cards = createBeatTheHouseShoeCards();
  const availableCards = [...cards];
  for (const expectedCard of options.dealOrder) {
    const matchingIndex = availableCards.findIndex((card) => card.rank === expectedCard.rank && card.suit === expectedCard.suit);
    if (matchingIndex < 0) {
      throw new Error(`Test shoe cannot contain ${expectedCard.rank} of ${expectedCard.suit}.`);
    }
    availableCards.splice(matchingIndex, 1);
  }

  const cardsDealt = options.cardsDealt ?? 0;
  const remainingCardCount = beatTheHouseRules.cardsPerShoe - cardsDealt;
  const fillerCardCount = remainingCardCount - options.dealOrder.length;
  if (cardsDealt < 0 || fillerCardCount < 0 || fillerCardCount > availableCards.length) {
    throw new Error('Test shoe card count is invalid.');
  }

  const cutThresholdCardsDealt = options.cutThresholdCardsDealt ?? beatTheHouseRules.cutThreshold.minimum;
  return new BeatTheHouseShoe({
    remainingCards: [...availableCards.slice(0, fillerCardCount), ...[...options.dealOrder].reverse()],
    totalCards: beatTheHouseRules.cardsPerShoe,
    cutThresholdCardsDealt,
    shufflePending: cardsDealt >= cutThresholdCardsDealt,
  });
};
