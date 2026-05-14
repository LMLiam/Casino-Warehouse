import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { rigDeck } from '../../../src/game/cards/rigDeck';
import { BlackjackGame } from '../../../src/game/blackjack/BlackjackGame';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('BlackjackGame edge coverage', () => {
  it('keeps inactive actions as no-ops before and after a hand settles', () => {
    const game = new BlackjackGame();
    const idle = game.snapshot();

    expect(game.hit()).toEqual(idle);
    expect(game.stand()).toEqual(idle);
    expect(game.double()).toEqual(idle);
    expect(game.split()).toEqual(idle);
    expect(game.insurance(5)).toEqual(idle);

    const dealt = game.deal(10, rigDeck([card('10', 'clubs'), card('9', 'diamonds'), card('8', 'hearts'), card('7', 'spades'), card('6', 'clubs')]));
    expect(game.deal(25, rigDeck([card('A', 'clubs'), card('K', 'clubs')]))).toEqual(dealt);
    const settled = game.stand();

    expect(game.hit()).toEqual(settled);
    expect(game.double()).toEqual(settled);
  });

  it('sanitizes restored snapshots without trusting malformed card or credit data', () => {
    const game = new BlackjackGame();
    const restored = game.restore({
      phase: 'player',
      wager: 10.9,
      playerCards: [card('10', 'clubs'), { rank: '1', suit: 'stars' } as unknown as Card],
      dealerCards: [card('A', 'spades'), { rank: 'J', suit: 'hearts' }],
      dealerHoleHidden: true,
      insuranceWager: -5,
      splitHands: [[card('8', 'clubs'), { rank: 'bad', suit: 'bad' } as unknown as Card]],
      result: undefined,
      returned: -50,
      status: '',
    });

    expect(restored.wager).toBe(10);
    expect(restored.playerCards).toEqual([card('10', 'clubs')]);
    expect(restored.insuranceWager).toBe(0);
    expect(restored.returned).toBe(0);
    expect(restored.splitHands).toEqual([[card('8', 'clubs')]]);
    expect(restored.status).toBe('Choose a wager and deal Blackjack.');
  });

  it('covers double busts, dealer wins, and exhausted shoe failures', () => {
    let game = new BlackjackGame();
    game.deal(10, rigDeck([card('10', 'clubs'), card('6', 'diamonds'), card('9', 'hearts'), card('7', 'spades'), card('K', 'clubs')]));

    const doubled = game.double();
    expect(doubled.result).toBe('lose');
    expect(doubled.status).toBe('Double busts with 26.');

    game = new BlackjackGame();
    game.deal(10, rigDeck([card('10', 'clubs'), card('6', 'diamonds'), card('9', 'hearts'), card('8', 'spades')]));
    expect(game.stand()).toMatchObject({ result: 'lose', returned: 0, status: 'Dealer 17 beats 16.' });

    expect(() => new BlackjackGame().deal(10, [card('A', 'spades')])).toThrow('Blackjack deck exhausted.');
  });

  it('settles insurance and split loss branches deterministically', () => {
    let game = new BlackjackGame();
    game.restore({
      phase: 'player',
      wager: 10,
      playerCards: [card('9', 'clubs'), card('7', 'diamonds')],
      dealerCards: [card('A', 'hearts'), card('K', 'spades')],
      dealerHoleHidden: true,
      insuranceWager: 0,
      splitHands: [],
      result: undefined,
      returned: 0,
      status: 'Insurance available.',
    });

    const insured = game.insurance(5);
    expect(insured.result).toBe('lose');
    expect(insured.returned).toBe(15);
    expect(insured.status).toBe('Insurance pays 2:1 against dealer Blackjack.');

    game = new BlackjackGame();
    game.deal(10, rigDeck([card('8', 'clubs'), card('8', 'diamonds'), card('10', 'hearts'), card('9', 'spades'), card('2', 'clubs'), card('3', 'diamonds')]));

    const split = game.split();
    expect(split.result).toBe('lose');
    expect(split.returned).toBe(0);
    expect(split.status).toBe('Split hands settle against dealer 19.');
  });
});
