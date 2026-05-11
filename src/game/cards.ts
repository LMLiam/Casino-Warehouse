import { secureRandomInt, type Rng } from './rng';

export const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

export const suitSymbols: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const rankValue = (rank: Rank): number =>
  ({
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  })[rank];

export const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds';

export const isBlackAce = (card: Card | undefined): boolean => Boolean(card && card.rank === 'A' && (card.suit === 'spades' || card.suit === 'clubs'));

export const cardLabel = (card: Card): string => `${card.rank}${suitSymbols[card.suit]}`;

export const createDeck = (rng?: Rng): Card[] => {
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = rng ? Math.floor(rng() * (index + 1)) : secureRandomInt(index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
};

export const rigDeck = (dealOrder: Card[]): Card[] => [...dealOrder].reverse();
