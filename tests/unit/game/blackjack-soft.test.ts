import { describe, expect, it } from 'vitest';
import { dealerMustHit } from '../../../src/game/blackjack/dealerMustHit';
import { isSoft } from '../../../src/game/blackjack/isSoft';
import type { Card } from '../../../src/game/cards/Card';
import type { Rank } from '../../../src/game/cards/Rank';

const card = (rank: Rank): Card => ({ rank, suit: 'spades' });

describe('isSoft', () => {
  it('detects usable aces without counting busted aces as soft', () => {
    expect(isSoft([card('A'), card('9')])).toBe(true);
    expect(isSoft([card('A'), card('K'), card('9')])).toBe(false);
    expect(isSoft([card('K'), card('2')])).toBe(false);
  });
});

describe('dealerMustHit', () => {
  it('stands on soft 17 and hard 17 or higher', () => {
    expect(dealerMustHit([card('A'), card('6')])).toBe(false);
    expect(dealerMustHit([card('10'), card('7')])).toBe(false);
    expect(dealerMustHit([card('10'), card('8')])).toBe(false);
  });

  it('hits totals below 17, including soft totals', () => {
    expect(dealerMustHit([card('A'), card('5')])).toBe(true);
    expect(dealerMustHit([card('10'), card('6')])).toBe(true);
  });
});
