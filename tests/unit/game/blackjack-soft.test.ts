import { describe, expect, it } from 'vitest';
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
