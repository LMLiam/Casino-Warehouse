import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { rigDeck } from '../../../src/game/cards/rigDeck';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('BeatTheHouseGame', () => {
  it('pays a player first-card black Ace automatically', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);

    const snapshot = game.deal(rigDeck([card('A', 'spades'), card('K', 'hearts')]));

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('win');
    expect(snapshot.bankroll).toBe(110);
    expect(snapshot.summaries[0].profit).toBe(10);
  });

  it('keeps a player black-Ace automatic win when the dealer opens with a black Ace', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'aceFlash', 1);

    const snapshot = game.deal(rigDeck([card('A', 'clubs'), card('A', 'spades')]));

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('win');
    expect(snapshot.summaries[0].sideWins).toEqual([{ betType: 'aceFlash', label: 'Ace Flash', profit: 50, returned: 51 }]);
    expect(snapshot.bankroll).toBe(160);
  });

  it('pushes the main bet and pays Match Push on equal final ranks', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'matchPush', 2);
    game.deal(rigDeck([card('K', 'diamonds'), card('K', 'clubs')]));

    const snapshot = game.stick();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('push');
    expect(snapshot.summaries[0].profit).toBe(18);
    expect(snapshot.bankroll).toBe(118);
  });

  it('pays Match Push when another side bet on the same pushed hand loses', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'aceFlash', 1);
    game.placeBet('left', 'matchPush', 1);
    game.deal(rigDeck([card('K', 'diamonds'), card('K', 'clubs')]));

    const snapshot = game.stick();

    expect(snapshot.hands.left.result).toBe('push');
    expect(snapshot.summaries[0].sideWins).toEqual([{ betType: 'matchPush', label: 'Match Push', profit: 9, returned: 10 }]);
    expect(snapshot.summaries[0].profit).toBe(8);
    expect(snapshot.bankroll).toBe(108);
  });

  it('activates the left-most playable hand first after initial deal', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 5);
    game.placeBet('centre', 'main', 5);
    game.placeBet('right', 'main', 5);

    const snapshot = game.deal(rigDeck([card('J', 'hearts'), card('Q', 'clubs'), card('K', 'diamonds'), card('9', 'spades')]));

    expect(snapshot.activeHand).toBe('left');
  });

  it('restores an in-progress Beat the House round including deck state', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    const snapshot = game.deal(rigDeck([card('K', 'hearts'), card('9', 'spades'), card('Q', 'clubs')]));
    const restored = new BeatTheHouseGame({ initialBankroll: 1 });

    expect(restored.restoreState(game.saveState())).toMatchObject({
      phase: snapshot.phase,
      bankroll: snapshot.bankroll,
      activeHand: snapshot.activeHand,
      bets: snapshot.bets,
      hands: snapshot.hands,
      dealer: snapshot.dealer,
    });
    expect(restored.stick().phase).toBe('roundOver');
  });

  it('immediately marks a later first-card 2 as lost before that hand becomes active', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 5);
    game.placeBet('centre', 'main', 5);
    game.placeBet('right', 'main', 5);

    const snapshot = game.deal(rigDeck([card('J', 'hearts'), card('2', 'clubs'), card('K', 'diamonds'), card('9', 'spades')]));

    expect(snapshot.activeHand).toBe('left');
    expect(snapshot.hands.centre.result).toBe('lose');
    expect(snapshot.hands.centre.done).toBe(true);
  });

  it('pays Dealer Bust and Dealer Sevens when a dealer seven appears before a bust', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerBust', 2);
    game.placeBet('left', 'dealerSevens', 2);
    game.deal(rigDeck([card('J', 'hearts'), card('7', 'hearts'), card('2', 'clubs')]));

    const snapshot = game.stick();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('win');
    expect(snapshot.dealer.bust).toBe(true);
    expect(snapshot.summaries[0].sideWins).toEqual([
      { betType: 'dealerBust', label: 'Dealer Bust', profit: 8, returned: 10 },
      { betType: 'dealerSevens', label: 'Dealer Sevens (1)', profit: 6, returned: 8 },
    ]);
    expect(snapshot.bankroll).toBe(124);
  });

  it('makes a player lose immediately when revealing a 2', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);

    const snapshot = game.deal(rigDeck([card('2', 'diamonds'), card('K', 'spades')]));

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('lose');
    expect(snapshot.summaries[0].profit).toBe(-10);
    expect(snapshot.bankroll).toBe(90);
  });

  it('sums multi-hand wins and losses with the correct sign', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 5);
    game.placeBet('centre', 'main', 5);
    game.placeBet('right', 'main', 5);
    game.deal(rigDeck([card('K', 'hearts'), card('4', 'clubs'), card('5', 'diamonds'), card('Q', 'spades')]));
    game.stick();
    game.stick();

    const snapshot = game.stick();

    expect(snapshot.summaries.map((summary) => summary.profit)).toEqual([5, -5, -5]);
    expect(snapshot.lastEvents.at(-1)?.totalProfit).toBe(-5);
    expect(snapshot.status).toContain('-£5');
    expect(snapshot.bankroll).toBe(95);
  });

  it('handles bet management and rejected betting states', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 20 });
    expect(game.rebet().status).toBe('No previous bet saved.');
    expect(game.snapshot().canRebet).toBe(false);
    expect(game.placeBet('left', 'main', 25).status).toContain('Need £25');
    const sideBeforeMain = game.placeBet('left', 'aceFlash', 5);
    expect(sideBeforeMain.status).toBe('Side bets need a main bet on the same hand.');
    expect(sideBeforeMain.bets.left.aceFlash).toBe(0);
    expect(game.deal().status).toBe('Place a main bet on at least one hand.');
    expect(game.clearBets().bankroll).toBe(20);
    game.placeBet('left', 'main', 10);
    expect(game.placeBet('left', 'aceFlash', 5).bets.left.aceFlash).toBe(5);
    expect(game.placeBet('right', 'aceFlash', 5).status).toBe('Side bets need a main bet on the same hand.');
    game.clearBets();
    game.placeBet('left', 'main', 10);
    expect(game.clearBets().bets.left.main).toBe(0);
    game.placeBet('left', 'main', 10);
    game.deal(rigDeck([card('K', 'hearts'), card('Q', 'spades')]));
    game.stick();
    const next = game.nextRound();
    expect(next.phase).toBe('betting');
    expect(next.canRebet).toBe(true);
    expect(game.rebet().bets.left.main).toBe(10);
    expect(game.snapshot().canRebet).toBe(false);
  });

  it('covers invalid bankroll withdrawals, invalid rebet affordability, and exhausted decks', () => {
    let game = new BeatTheHouseGame({ initialBankroll: 10 });
    game.placeBet('left', 'main', 10);
    game.deal(rigDeck([card('3', 'hearts'), card('K', 'spades')]));

    expect(game.withdrawBankroll(1)).toBe(false);
    expect(game.withdrawBankroll(0)).toBe(false);
    expect(game.clearBets().phase).toBe('playing');

    game.stick();
    expect(game.nextRound().canRebet).toBe(false);
    expect(game.rebet().status).toBe('Need £10 to rebet.');

    game = new BeatTheHouseGame({ initialBankroll: 10 });
    game.placeBet('left', 'main', 5);
    expect(() => game.deal([])).toThrow('Deck exhausted.');
  });

  it('settles Ace Flash, Match Push, and multi-seven side-bet branches', () => {
    let game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'aceFlash', 2);
    game.deal(rigDeck([card('A', 'spades'), card('Q', 'hearts')]));

    expect(game.snapshot().summaries[0].sideWins).toEqual([{ betType: 'aceFlash', label: 'Ace Flash', profit: 20, returned: 22 }]);

    game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 1);
    game.deal(rigDeck([card('K', 'hearts'), card('7', 'spades'), card('7', 'clubs'), card('7', 'diamonds'), card('Q', 'hearts')]));

    const threeSevens = game.stick();
    expect(threeSevens.dealer.cards.map((dealerCard) => dealerCard.rank)).toEqual(['7', '7', '7', 'Q']);
    expect(threeSevens.summaries[0].sideWins).toEqual([{ betType: 'dealerSevens', label: 'Dealer Sevens (3)', profit: 150, returned: 151 }]);
  });

  it('covers defensive phase guards and default bankroll paths', () => {
    const game = new BeatTheHouseGame();
    const idle = game.snapshot();

    expect(idle.bankroll).toBe(100);
    expect(game.placeBet('left', 'main', 0)).toEqual(idle);
    expect(game.hit()).toEqual(idle);
    expect(game.stick()).toEqual(idle);
    expect(game.nextRound()).toEqual(idle);
    expect(game.addBankroll(0).bankroll).toBe(100);
    expect(game.resetBankroll().bankroll).toBe(100);

    game.placeBet('left', 'main', 10);
    const playing = game.deal(rigDeck([card('K', 'hearts'), card('Q', 'spades')]));
    expect(game.deal(rigDeck([card('A', 'clubs')]))).toMatchObject({
      phase: playing.phase,
      bets: playing.bets,
      hands: playing.hands,
      dealer: playing.dealer,
    });
  });

  it('rejects orphaned side bets restored from legacy state', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    const state = game.saveState();
    game.restoreState({
      ...state,
      bets: {
        ...state.bets,
        left: { ...state.bets.left, aceFlash: 5 },
      },
    });

    expect(game.deal().status).toBe('Place a main bet on at least one hand.');

    game.restoreState({
      ...state,
      bets: {
        ...state.bets,
        left: { ...state.bets.left, main: 10, aceFlash: 5 },
        centre: { ...state.bets.centre, dealerBust: 5 },
      },
    });

    expect(game.deal().status).toBe('Side bets need a main bet on the same hand.');
  });

  it('covers player hit bust, four-card auto-stand, and dealer black-Ace settlement', () => {
    let game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.deal(rigDeck([card('K', 'hearts'), card('Q', 'spades'), card('2', 'clubs')]));

    const bust = game.hit();
    expect(bust.hands.left.result).toBe('lose');
    expect(bust.phase).toBe('roundOver');

    game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.deal(rigDeck([card('3', 'hearts'), card('K', 'spades'), card('4', 'clubs'), card('5', 'diamonds'), card('6', 'hearts')]));
    game.hit();
    game.hit();
    const stoodOnFour = game.hit();
    expect(stoodOnFour.hands.left.done).toBe(true);
    expect(stoodOnFour.phase).toBe('roundOver');

    game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.placeBet('left', 'main', 10);
    game.deal(rigDeck([card('K', 'hearts'), card('A', 'spades')]));
    const dealerBlackAce = game.stick();
    expect(dealerBlackAce.dealer.blackAce).toBe(true);
    expect(dealerBlackAce.hands.left.result).toBe('lose');
  });
});
