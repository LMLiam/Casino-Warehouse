import { beatTheHouseRules } from '../beatTheHouseRules';
import { isCard } from '../../blackjackTable/isCard';
import type { BeatTheHouseShoeSaveState } from './BeatTheHouseShoeSaveState';

export const validateBeatTheHouseShoeSaveState = (state: BeatTheHouseShoeSaveState): void => {
  if (
    !state ||
    !Array.isArray(state.remainingCards) ||
    !Number.isSafeInteger(state.totalCards) ||
    state.totalCards <= 0 ||
    state.remainingCards.length > state.totalCards ||
    !Number.isSafeInteger(state.cutThresholdCardsDealt) ||
    state.cutThresholdCardsDealt <= 0 ||
    state.cutThresholdCardsDealt > state.totalCards ||
    typeof state.shufflePending !== 'boolean'
  ) {
    throw new Error('Beat the House shoe save state is invalid.');
  }

  const cardsDealt = state.totalCards - state.remainingCards.length;
  if (state.shufflePending !== cardsDealt >= state.cutThresholdCardsDealt) {
    throw new Error('Beat the House shoe cut state is inconsistent.');
  }
  if (state.totalCards === beatTheHouseRules.cardsPerShoe && state.cutThresholdCardsDealt < beatTheHouseRules.cutThreshold.minimum) {
    throw new Error('Beat the House shoe threshold is below the production range.');
  }
  if (state.totalCards === beatTheHouseRules.cardsPerShoe && state.cutThresholdCardsDealt > beatTheHouseRules.cutThreshold.maximum) {
    throw new Error('Beat the House shoe threshold is above the production range.');
  }

  const physicalCounts = new Map<string, number>();
  for (const card of state.remainingCards) {
    if (!isCard(card)) {
      throw new Error('Beat the House shoe contains an invalid card.');
    }
    const key = `${card.rank}|${card.suit}`;
    const count = (physicalCounts.get(key) ?? 0) + 1;
    if (state.totalCards === beatTheHouseRules.cardsPerShoe && count > beatTheHouseRules.deckCount) {
      throw new Error('Beat the House shoe contains too many copies of a card.');
    }
    physicalCounts.set(key, count);
  }
};
