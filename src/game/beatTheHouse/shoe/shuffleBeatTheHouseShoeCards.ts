import { secureRandomInt } from '../../rng/secureRandomInt';
import type { Rng } from '../../rng/Rng';
import type { Card } from '../../cards/Card';

export const shuffleBeatTheHouseShoeCards = (cards: readonly Card[], rng?: Rng): Card[] => {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rng ? Math.floor(rng() * (index + 1)) : secureRandomInt(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new Error('Beat the House shoe RNG returned an invalid shuffle value.');
    }
    const currentCard = shuffled[index];
    const swapCard = shuffled[swapIndex];
    if (!currentCard || !swapCard) {
      throw new Error('Beat the House shoe shuffle index is invalid.');
    }
    shuffled[index] = swapCard;
    shuffled[swapIndex] = currentCard;
  }
  return shuffled;
};
