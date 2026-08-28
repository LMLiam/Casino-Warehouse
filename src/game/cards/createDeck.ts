import type { Rng } from '../rng/Rng';
import { secureRandomInt } from '../rng/secureRandomInt';
import type { Card } from './Card';
import { ranks } from './ranks';
import { suits } from './suits';

export const createDeck = (rng?: Rng): Card[] => {
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = rng ? Math.floor(rng() * (index + 1)) : secureRandomInt(index + 1);
    const currentCard = deck[index];
    const swapCard = deck[swapIndex];
    if (!currentCard || !swapCard) {
      throw new Error('Deck shuffle index is invalid.');
    }
    deck[index] = swapCard;
    deck[swapIndex] = currentCard;
  }

  return deck;
};
