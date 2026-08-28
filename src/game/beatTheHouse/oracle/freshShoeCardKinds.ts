import type { FreshShoeCardKind } from './FreshShoeCardKind';

export const freshShoeCardKinds = [
  { rank: '2', suit: 'clubs', value: 2, copiesPerDeck: 4, isBlackAce: false },
  { rank: '3', suit: 'clubs', value: 3, copiesPerDeck: 4, isBlackAce: false },
  { rank: '4', suit: 'clubs', value: 4, copiesPerDeck: 4, isBlackAce: false },
  { rank: '5', suit: 'clubs', value: 5, copiesPerDeck: 4, isBlackAce: false },
  { rank: '6', suit: 'clubs', value: 6, copiesPerDeck: 4, isBlackAce: false },
  { rank: '7', suit: 'clubs', value: 7, copiesPerDeck: 4, isBlackAce: false },
  { rank: '8', suit: 'clubs', value: 8, copiesPerDeck: 4, isBlackAce: false },
  { rank: '9', suit: 'clubs', value: 9, copiesPerDeck: 4, isBlackAce: false },
  { rank: '10', suit: 'clubs', value: 10, copiesPerDeck: 4, isBlackAce: false },
  { rank: 'J', suit: 'clubs', value: 11, copiesPerDeck: 4, isBlackAce: false },
  { rank: 'Q', suit: 'clubs', value: 12, copiesPerDeck: 4, isBlackAce: false },
  { rank: 'K', suit: 'clubs', value: 13, copiesPerDeck: 4, isBlackAce: false },
  { rank: 'A', suit: 'spades', value: 14, copiesPerDeck: 2, isBlackAce: true },
  { rank: 'A', suit: 'hearts', value: 14, copiesPerDeck: 2, isBlackAce: false },
] as const satisfies readonly FreshShoeCardKind[];
