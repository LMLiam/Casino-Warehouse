import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { cardLabel } from '../../../src/game/cards/cardLabel';
import { createDeck } from '../../../src/game/cards/createDeck';
import { isBlackAce } from '../../../src/game/cards/isBlackAce';
import { isRed } from '../../../src/game/cards/isRed';
import { rankValue } from '../../../src/game/cards/rankValue';
import { rigDeck } from '../../../src/game/cards/rigDeck';
import { suitSymbols } from '../../../src/game/cards/suitSymbols';

describe('shared card helpers', () => {
  it('labels cards and classifies colors and black Aces', () => {
    const redAce: Card = { rank: 'A', suit: 'hearts' };
    const blackAce: Card = { rank: 'A', suit: 'spades' };
    const blackKing: Card = { rank: 'K', suit: 'clubs' };

    expect(cardLabel(redAce)).toBe(`A${suitSymbols.hearts}`);
    expect(isRed(redAce)).toBe(true);
    expect(isRed({ rank: '9', suit: 'diamonds' })).toBe(true);
    expect(isRed(blackAce)).toBe(false);
    expect(isRed(blackKing)).toBe(false);

    expect(isBlackAce(undefined)).toBe(false);
    expect(isBlackAce(redAce)).toBe(false);
    expect(isBlackAce(blackKing)).toBe(false);
    expect(isBlackAce(blackAce)).toBe(true);
    expect(isBlackAce({ rank: 'A', suit: 'clubs' })).toBe(true);
  });

  it('maps ranks, creates shuffled decks with injected RNG, and rigs deal order', () => {
    const deck = createDeck(() => 0);

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardLabel)).size).toBe(52);
    expect(rankValue('2')).toBe(2);
    expect(rankValue('10')).toBe(10);
    expect(rankValue('A')).toBe(14);

    const dealOrder = [
      { rank: 'A', suit: 'spades' },
      { rank: '2', suit: 'hearts' },
      { rank: 'K', suit: 'clubs' },
    ] satisfies Card[];
    expect(rigDeck(dealOrder)).toEqual([...dealOrder].reverse());
  });
});
