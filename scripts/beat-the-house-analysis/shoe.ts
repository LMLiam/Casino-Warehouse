import type { Rng } from '../../src/game/rng/Rng';
import { beatTheHouseRules } from '../../src/game/beatTheHouse/beatTheHouseRules';
import { BeatTheHouseShoe } from '../../src/game/beatTheHouse/shoe/BeatTheHouseShoe';
import { createBeatTheHouseShoeCards } from '../../src/game/beatTheHouse/shoe/createBeatTheHouseShoeCards';
import { shuffleBeatTheHouseShoeCards } from '../../src/game/beatTheHouse/shoe/shuffleBeatTheHouseShoeCards';
import type { BeatTheHouseShoeSaveState } from '../../src/game/beatTheHouse/shoe/BeatTheHouseShoeSaveState';

export const createAnalysisShoe = (rng: Rng, minimum: number, maximum: number): BeatTheHouseShoe => {
  const range = maximum - minimum + 1;
  const cutThresholdCardsDealt = minimum + Math.floor(rng() * range);
  const state: BeatTheHouseShoeSaveState = {
    remainingCards: shuffleBeatTheHouseShoeCards(createBeatTheHouseShoeCards(), rng),
    totalCards: beatTheHouseRules.cardsPerShoe,
    cutThresholdCardsDealt,
    shufflePending: false,
  };
  return new BeatTheHouseShoe(state);
};
