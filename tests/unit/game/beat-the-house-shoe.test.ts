import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import { BeatTheHouseShoe } from '../../../src/game/beatTheHouse/shoe/BeatTheHouseShoe';
import type { BeatTheHouseShoeSaveState } from '../../../src/game/beatTheHouse/shoe/BeatTheHouseShoeSaveState';
import { createBeatTheHouseShoe } from '../../../src/game/beatTheHouse/shoe/createBeatTheHouseShoe';
import { createDeterministicBeatTheHouseShoe } from './createDeterministicBeatTheHouseShoe';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const firstCard = card('A', 'spades');
const secondCard = card('K', 'hearts');
const thirdCard = card('7', 'clubs');

describe('Beat the House six-deck shoe', () => {
  it('creates six copies of every physical card in one 312-card shoe', () => {
    const saveState = createBeatTheHouseShoe(() => 0).saveState();
    const physicalCounts = new Map<string, number>();
    const rankCounts = new Map<string, number>();

    for (const dealtCard of saveState.remainingCards) {
      const physicalKey = `${dealtCard.rank}|${dealtCard.suit}`;
      physicalCounts.set(physicalKey, (physicalCounts.get(physicalKey) ?? 0) + 1);
      rankCounts.set(dealtCard.rank, (rankCounts.get(dealtCard.rank) ?? 0) + 1);
    }

    expect(saveState.remainingCards).toHaveLength(beatTheHouseRules.cardsPerShoe);
    expect(physicalCounts.size).toBe(52);
    expect([...physicalCounts.values()].every((count) => count === beatTheHouseRules.deckCount)).toBe(true);
    expect([...rankCounts.values()].every((count) => count === 24)).toBe(true);
    expect(saveState.remainingCards.filter((dealtCard) => dealtCard.rank === 'A' && (dealtCard.suit === 'spades' || dealtCard.suit === 'clubs'))).toHaveLength(
      12,
    );
  });

  it('uses one deterministic shuffle stream and selects both cut endpoints', () => {
    const first = createBeatTheHouseShoe(() => 0).saveState();
    const repeated = createBeatTheHouseShoe(() => 0).saveState();
    const different = createBeatTheHouseShoe(() => 0.25).saveState();
    const minimum = createBeatTheHouseShoe(() => 0).saveState();
    const maximum = createBeatTheHouseShoe(() => 0.999_999).saveState();

    expect(repeated).toEqual(first);
    expect(different.remainingCards).not.toEqual(first.remainingCards);
    expect(minimum.cutThresholdCardsDealt).toBe(beatTheHouseRules.cutThreshold.minimum);
    expect(maximum.cutThresholdCardsDealt).toBe(beatTheHouseRules.cutThreshold.maximum);
  });

  it('draws in pop order, keeps drawing after the cut, and rejects exhaustion', () => {
    const shoe = createDeterministicBeatTheHouseShoe({ dealOrder: [thirdCard, secondCard, firstCard], cardsDealt: 217, cutThresholdCardsDealt: 219 });

    expect(shoe.draw()).toEqual(thirdCard);
    expect(shoe.snapshot()).toEqual({ cardsRemaining: 94, cardsDealt: 218, totalCards: 312, cutCardReached: false });
    expect(shoe.draw()).toEqual(secondCard);
    expect(shoe.snapshot().cutCardReached).toBe(true);
    expect(shoe.draw()).toEqual(firstCard);
    while (shoe.snapshot().cardsRemaining > 0) {
      shoe.draw();
    }
    expect(() => shoe.draw()).toThrow('shoe exhausted');
  });

  it('restores the exact next card without consuming randomness', () => {
    const shoe = createDeterministicBeatTheHouseShoe({ dealOrder: [thirdCard, secondCard, firstCard], cardsDealt: 217, cutThresholdCardsDealt: 219 });
    shoe.draw();
    const saved = shoe.saveState();
    const restored = BeatTheHouseShoe.fromSaveState(saved);

    expect(restored.saveState()).toEqual(saved);
    expect(restored.draw()).toEqual(shoe.draw());
    expect(restored.snapshot()).toEqual(shoe.snapshot());
  });

  it('keeps private threshold and card order out of the public snapshot', () => {
    const shoe = createDeterministicBeatTheHouseShoe({ dealOrder: [firstCard, secondCard], cardsDealt: 217, cutThresholdCardsDealt: 219 });

    expect(shoe.snapshot()).toEqual({ cardsRemaining: 95, cardsDealt: 217, totalCards: 312, cutCardReached: false });
    expect(Object.keys(shoe.snapshot())).not.toEqual(expect.arrayContaining(['remainingCards', 'cutThresholdCardsDealt', 'shufflePending']));
  });

  it('rejects malformed, inconsistent, and over-represented save state', () => {
    const valid: BeatTheHouseShoeSaveState = createDeterministicBeatTheHouseShoe({
      dealOrder: [firstCard],
      cardsDealt: 217,
      cutThresholdCardsDealt: 219,
    }).saveState();

    expect(() => BeatTheHouseShoe.fromSaveState({ ...valid, totalCards: 0 })).toThrow();
    expect(() => BeatTheHouseShoe.fromSaveState({ ...valid, remainingCards: Array.from({ length: 313 }, () => firstCard) })).toThrow();
    expect(() => BeatTheHouseShoe.fromSaveState({ ...valid, cutThresholdCardsDealt: 0 })).toThrow();
    expect(() => BeatTheHouseShoe.fromSaveState({ ...valid, shufflePending: true })).toThrow('cut state');
    expect(() => BeatTheHouseShoe.fromSaveState({ ...valid, remainingCards: [{ rank: 'bad', suit: 'bad' }] as never, shufflePending: true })).toThrow(
      'invalid card',
    );

    const duplicateProductionCards = Array.from({ length: 7 }, () => firstCard);
    expect(() =>
      BeatTheHouseShoe.fromSaveState({
        remainingCards: duplicateProductionCards,
        totalCards: beatTheHouseRules.cardsPerShoe,
        cutThresholdCardsDealt: beatTheHouseRules.cutThreshold.minimum,
        shufflePending: true,
      }),
    ).toThrow('too many copies');
  });
});
