import type { Rng } from '../../rng/Rng';
import { BeatTheHouseShoe } from './BeatTheHouseShoe';
import { beatTheHouseRules } from '../beatTheHouseRules';
import { createBeatTheHouseShoeCards } from './createBeatTheHouseShoeCards';
import { selectBeatTheHouseCutThreshold } from './selectBeatTheHouseCutThreshold';
import { shuffleBeatTheHouseShoeCards } from './shuffleBeatTheHouseShoeCards';

export const createBeatTheHouseShoe = (rng?: Rng): BeatTheHouseShoe =>
  new BeatTheHouseShoe({
    remainingCards: shuffleBeatTheHouseShoeCards(createBeatTheHouseShoeCards(), rng),
    totalCards: beatTheHouseRules.cardsPerShoe,
    cutThresholdCardsDealt: selectBeatTheHouseCutThreshold(rng),
    shufflePending: false,
  });
