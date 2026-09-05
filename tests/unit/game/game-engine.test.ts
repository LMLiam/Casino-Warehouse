import { describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { sideBetTypes } from '../../../src/game/types/sideBetTypes';
import { createDeterministicBeatTheHouseShoe } from './createDeterministicBeatTheHouseShoe';

const requireSummary = <T>(snapshot: { readonly summaries: readonly T[] }): T => {
  const summary = snapshot.summaries[0];
  if (!summary) {
    throw new Error('Missing summary.');
  }
  return summary;
};

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const createGame = (initialBankroll: number, dealOrder: readonly Card[]): BeatTheHouseGame =>
  new BeatTheHouseGame({ initialBankroll, shoe: createDeterministicBeatTheHouseShoe({ dealOrder }) });

describe('BeatTheHouseGame', () => {
  const createShortShoe = (dealOrder: readonly Card[], cutThresholdCardsDealt: number, cardsDealt: number) =>
    createDeterministicBeatTheHouseShoe({ dealOrder, cutThresholdCardsDealt, cardsDealt });

  it('pays a player first-card black Ace automatically', () => {
    const game = createGame(100, [card('A', 'spades'), card('K', 'hearts')]);
    game.placeBet('left', 'main', 10);

    const snapshot = game.deal();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('win');
    expect(snapshot.bankroll).toBe(115);
    expect(requireSummary(snapshot)).toMatchObject({ profitHalfUnits: 30, returnedHalfUnits: 50, profit: 15, returned: 25 });
  });

  it('keeps a £1 first-card black-Ace result exact in summaries and events', () => {
    const game = createGame(100, [card('A', 'spades'), card('K', 'hearts')]);
    game.placeBet('left', 'main', 1);

    const settled = game.deal();
    const summary = requireSummary(settled);
    const event = settled.lastEvents.at(-1);

    expect(summary).toMatchObject({
      stake: 1,
      returnedHalfUnits: 5,
      profitHalfUnits: 3,
      returned: 2.5,
      profit: 1.5,
    });
    expect(event).toMatchObject({ type: 'round-settled', totalProfitHalfUnits: 3, totalProfit: 1.5 });
    expect(settled.bankroll).toBe(101.5);
  });

  it('keeps a player black-Ace automatic win when the dealer opens with a black Ace', () => {
    const game = createGame(100, [card('A', 'clubs'), card('A', 'spades')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'aceFlash', 1);

    const snapshot = game.deal();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('win');
    expect(requireSummary(snapshot).sideWins).toEqual([
      { betType: 'aceFlash', label: 'Ace Flash', profitHalfUnits: 120, returnedHalfUnits: 122, profit: 60, returned: 61 },
    ]);
    expect(snapshot.bankroll).toBe(175);
  });

  it('pushes the main bet and pays Match Push on equal final ranks', () => {
    const game = createGame(100, [card('K', 'diamonds'), card('K', 'clubs')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'matchPush', 2);
    game.deal();

    const snapshot = game.stick();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('push');
    expect(requireSummary(snapshot).profit).toBe(18);
    expect(snapshot.bankroll).toBe(118);
  });

  it('pays Match Push when another side bet on the same pushed hand loses', () => {
    const game = createGame(100, [card('K', 'diamonds'), card('K', 'clubs')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'aceFlash', 1);
    game.placeBet('left', 'matchPush', 1);
    game.deal();

    const snapshot = game.stick();

    expect(snapshot.hands.left.result).toBe('push');
    expect(requireSummary(snapshot).sideWins).toEqual([
      { betType: 'matchPush', label: 'Match Push', profitHalfUnits: 18, returnedHalfUnits: 20, profit: 9, returned: 10 },
    ]);
    expect(requireSummary(snapshot).profit).toBe(8);
    expect(snapshot.bankroll).toBe(108);
  });

  it('activates the left-most playable hand first after initial deal', () => {
    const game = createGame(100, [card('J', 'hearts'), card('Q', 'clubs'), card('K', 'diamonds'), card('9', 'spades')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('centre', 'main', 5);
    game.placeBet('right', 'main', 5);

    const snapshot = game.deal();

    expect(snapshot.activeHand).toBe('left');
  });

  it('hits a dealer 9 and stands on a dealer 10', () => {
    const nine = createGame(100, [card('K', 'hearts'), card('9', 'spades'), card('Q', 'diamonds')]);
    nine.placeBet('left', 'main', 10);
    nine.deal();

    expect(nine.stick().dealer.cards.map((dealerCard) => dealerCard.rank)).toEqual(['9', 'Q']);

    const ten = createGame(100, [card('K', 'hearts'), card('10', 'spades')]);
    ten.placeBet('left', 'main', 10);
    ten.deal();

    expect(ten.stick().dealer.cards.map((dealerCard) => dealerCard.rank)).toEqual(['10']);
  });

  it.each(['J', 'Q', 'K', 'A'] as const)('stands on a dealer %s', (rank) => {
    const game = createGame(100, [card('9', 'hearts'), card(rank, 'hearts')]);
    game.placeBet('left', 'main', 10);
    game.deal();

    expect(game.stick().dealer.cards.map((dealerCard) => dealerCard.rank)).toEqual([rank]);
  });

  it('restores an in-progress Beat the House round including shoe state', () => {
    const game = createGame(100, [card('K', 'hearts'), card('9', 'spades'), card('Q', 'clubs')]);
    game.placeBet('left', 'main', 10);
    const snapshot = game.deal();
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

  it('keeps one shoe across rounds and starts the next round with its next card', () => {
    const game = new BeatTheHouseGame({
      initialBankroll: 100,
      shoe: createShortShoe([card('2', 'clubs'), card('K', 'spades'), card('3', 'hearts'), card('Q', 'diamonds')], 219, 216),
    });
    game.placeBet('left', 'main', 10);

    const firstRound = game.deal();
    const shoeAfterFirstRound = game.saveState().shoe;
    expect(firstRound.phase).toBe('roundOver');
    expect(firstRound.hands.left.cards).toEqual([card('2', 'clubs')]);
    expect(firstRound.shoe).toEqual({ cardsRemaining: 94, cardsDealt: 218, totalCards: 312, cutCardReached: false });

    const nextRound = game.nextRound();
    expect(nextRound.shoe).toEqual(firstRound.shoe);
    expect(game.saveState().shoe).toEqual(shoeAfterFirstRound);

    game.placeBet('left', 'main', 10);
    const secondRound = game.deal();

    expect(secondRound.hands.left.cards).toEqual([card('3', 'hearts')]);
    expect(secondRound.shoe).toEqual({ cardsRemaining: 92, cardsDealt: 220, totalCards: 312, cutCardReached: true });
    expect(secondRound.lastEvents.filter((event) => event.type === 'shoe-cut-reached')).toHaveLength(1);
  });

  it('crosses the cut during a player draw and lets the dealer finish without shuffling', () => {
    const game = new BeatTheHouseGame({
      initialBankroll: 100,
      shoe: createShortShoe([card('3', 'clubs'), card('7', 'hearts'), card('4', 'diamonds'), card('K', 'spades')], 219, 216),
    });
    game.placeBet('left', 'main', 10);

    const dealing = game.deal();
    const afterHit = game.hit();
    const settled = game.stick();

    expect(dealing.phase).toBe('playing');
    expect(dealing.shoe.cutCardReached).toBe(false);
    expect(afterHit.phase).toBe('playing');
    expect(afterHit.hands.left.cards).toEqual([card('3', 'clubs'), card('4', 'diamonds')]);
    expect(afterHit.shoe).toEqual({ cardsRemaining: 93, cardsDealt: 219, totalCards: 312, cutCardReached: true });
    expect(afterHit.lastEvents).toEqual(expect.arrayContaining([{ type: 'shoe-cut-reached', message: 'The shoe cut card has been reached.' }]));
    expect(Object.keys(dealing.dealer)).not.toContain('holeCard');
    expect(JSON.stringify(dealing)).not.toContain('cutThresholdCardsDealt');
    expect(JSON.stringify(dealing)).not.toContain('remainingCards');
    expect(settled.phase).toBe('roundOver');
    expect(settled.dealer.cards).toEqual([card('7', 'hearts'), card('K', 'spades')]);
    expect(settled.lastEvents.map((event) => event.type)).not.toContain('shoe-shuffled');
  });

  it('replaces a pending shoe only on the next deal and not on nextRound', () => {
    const rng = vi.fn(() => 0);
    const game = new BeatTheHouseGame({
      initialBankroll: 100,
      rng,
      shoe: createShortShoe([card('2', 'clubs'), card('K', 'spades')], 219, 217),
    });
    game.placeBet('left', 'main', 10);

    const settled = game.deal();
    const pendingShoe = game.saveState().shoe;
    expect(settled.shoe.cutCardReached).toBe(true);
    expect(rng).not.toHaveBeenCalled();

    const nextRound = game.nextRound();
    expect(nextRound.shoe).toEqual(settled.shoe);
    expect(game.saveState().shoe).toEqual(pendingShoe);
    expect(rng).not.toHaveBeenCalled();

    game.placeBet('left', 'main', 10);
    const freshShoeRound = game.deal();

    expect(rng).toHaveBeenCalledTimes(312);
    expect(freshShoeRound.lastEvents.filter((event) => event.type === 'shoe-shuffled')).toHaveLength(1);
    expect(freshShoeRound.shoe).toMatchObject({ cardsRemaining: 310, cardsDealt: 2, totalCards: 312, cutCardReached: false });
  });

  it('restores the exact next card and pending cut without consuming either random source', () => {
    const game = new BeatTheHouseGame({
      initialBankroll: 100,
      shoe: createShortShoe([card('3', 'clubs'), card('7', 'hearts'), card('4', 'diamonds'), card('K', 'spades')], 219, 216),
    });
    game.placeBet('left', 'main', 10);
    game.deal();
    const pending = game.hit();
    const saved = game.saveState();
    const restoreRng = vi.fn(() => 0);
    const restoreRandomInt = vi.fn(() => 0);
    const restored = new BeatTheHouseGame({
      initialBankroll: 1,
      rng: restoreRng,
      randomInt: restoreRandomInt,
    });

    expect(saved.shoe.remainingCards.at(-1)).toEqual(card('K', 'spades'));
    expect(saved.shoe.remainingCards).toHaveLength(93);
    expect(saved.shoe).toMatchObject({ cutThresholdCardsDealt: 219, shufflePending: true });
    expect(restored.restoreState(saved)).toMatchObject({ phase: 'playing', shoe: pending.shoe });
    expect(restoreRng).not.toHaveBeenCalled();
    expect(restoreRandomInt).not.toHaveBeenCalled();
    expect(restored.saveState()).toEqual(saved);
    expect(restored.stick()).toEqual(game.stick());
  });

  it('immediately marks a later first-card 2 as lost before that hand becomes active', () => {
    const game = createGame(100, [card('J', 'hearts'), card('2', 'clubs'), card('K', 'diamonds'), card('9', 'spades')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('centre', 'main', 5);
    game.placeBet('right', 'main', 5);

    const snapshot = game.deal();

    expect(snapshot.activeHand).toBe('left');
    expect(snapshot.hands.centre.result).toBe('lose');
    expect(snapshot.hands.centre.done).toBe(true);
  });

  it('pays Dealer Bust and Dealer Sevens when a dealer seven appears before a bust', () => {
    const game = createGame(100, [card('J', 'hearts'), card('7', 'hearts'), card('2', 'clubs')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerBust', 2);
    game.placeBet('left', 'dealerSevens', 2);
    game.deal();

    const snapshot = game.stick();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('win');
    expect(snapshot.dealer.bust).toBe(true);
    expect(requireSummary(snapshot).sideWins).toEqual([
      { betType: 'dealerBust', label: 'Dealer Bust', profitHalfUnits: 24, returnedHalfUnits: 28, profit: 12, returned: 14 },
      { betType: 'dealerSevens', label: 'Dealer Sevens (1)', profitHalfUnits: 16, returnedHalfUnits: 20, profit: 8, returned: 10 },
    ]);
    expect(snapshot.bankroll).toBe(130);
  });

  it('makes a player lose immediately when revealing a 2', () => {
    const game = createGame(100, [card('2', 'diamonds'), card('K', 'spades')]);
    game.placeBet('left', 'main', 10);

    const snapshot = game.deal();

    expect(snapshot.phase).toBe('roundOver');
    expect(snapshot.hands.left.result).toBe('lose');
    expect(requireSummary(snapshot).profit).toBe(-10);
    expect(snapshot.bankroll).toBe(90);
  });

  it('sums multi-hand wins and losses with the correct sign', () => {
    const game = createGame(100, [card('K', 'hearts'), card('4', 'clubs'), card('5', 'diamonds'), card('Q', 'spades')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('centre', 'main', 5);
    game.placeBet('right', 'main', 5);
    game.deal();
    game.stick();
    game.stick();

    const snapshot = game.stick();

    expect(snapshot.summaries.map((summary) => summary.profit)).toEqual([5, -5, -5]);
    expect(snapshot.lastEvents.at(-1)?.totalProfit).toBe(-5);
    expect(snapshot.status).toContain('-£5');
    expect(snapshot.bankroll).toBe(95);
  });

  it('handles bet management and rejected betting states', () => {
    const game = createGame(20, [card('K', 'hearts'), card('Q', 'spades')]);
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
    game.placeBet('right', 'main', 5);
    const handCleared = game.clearHandBets('left');
    expect(handCleared.bets.left.main).toBe(0);
    expect(handCleared.bets.right.main).toBe(5);
    game.clearBets();
    game.placeBet('left', 'main', 10);
    expect(game.clearBets().bets.left.main).toBe(0);
    game.placeBet('left', 'main', 10);
    game.deal();
    game.stick();
    const next = game.nextRound();
    expect(next.phase).toBe('betting');
    expect(next.canRebet).toBe(true);
    expect(game.rebet().bets.left.main).toBe(10);
    expect(game.snapshot().canRebet).toBe(false);
  });

  it('caps each side bet independently at the main bet and raises every allowance with the main bet', () => {
    const game = createGame(1000, [card('K', 'hearts'), card('Q', 'spades')]);
    game.placeBet('left', 'main', 5);

    for (const betType of sideBetTypes) {
      expect(game.placeBet('left', betType, 5).bets.left[betType]).toBe(5);
    }

    const beforeRejectedBet = game.snapshot();
    const rejected = game.placeBet('left', 'aceFlash', 1);

    expect(rejected.status).toBe('Side bets cannot exceed the main bet on the same hand.');
    expect(rejected.bets).toEqual(beforeRejectedBet.bets);
    expect(rejected.bankroll).toBe(beforeRejectedBet.bankroll);

    game.placeBet('left', 'main', 1);
    for (const betType of sideBetTypes) {
      expect(game.placeBet('left', betType, 1).bets.left[betType]).toBe(6);
    }
  });

  it('manages dealer tips as pending table credits before the round starts', () => {
    const game = createGame(50, [card('2', 'diamonds'), card('K', 'spades')]);

    const firstTip = game.placeDealerTip('left', 10);
    expect(firstTip.bankroll).toBe(40);
    expect(firstTip.dealerTips.left).toBe(10);
    expect(firstTip.lastEvents).toEqual([{ type: 'dealer-tip-placed', handId: 'left', amount: 10 }]);

    expect(game.placeDealerTip('left', 5).dealerTips.left).toBe(15);
    expect(game.placeDealerTip('right', 100).status).toBe('Need £100 available.');

    const handCleared = game.clearHandBets('left');
    expect(handCleared.bankroll).toBe(50);
    expect(handCleared.dealerTips.left).toBe(0);

    game.placeBet('right', 'main', 10);
    game.placeDealerTip('right', 5);
    const tableCleared = game.clearBets();

    expect(tableCleared.bankroll).toBe(50);
    expect(tableCleared.bets.right.main).toBe(0);
    expect(tableCleared.dealerTips.right).toBe(0);
  });

  it('settles Dealer Thanks independently of a losing game result', () => {
    const randomInt = vi.fn(() => 0);
    const game = new BeatTheHouseGame({
      initialBankroll: 100,
      randomInt,
      shoe: createDeterministicBeatTheHouseShoe({ dealOrder: [card('2', 'clubs'), card('K', 'spades')] }),
    });
    game.placeBet('left', 'main', 10);
    game.placeDealerTip('left', 5);

    const snapshot = game.deal();

    expect(snapshot.phase).toBe('roundOver');
    expect(requireSummary(snapshot)).toMatchObject({ handId: 'left', mainResult: 'lose', profit: -10 });
    expect(snapshot.bankroll).toBe(95);
    expect(snapshot.dealerTips.left).toBe(5);
    expect(snapshot.dealerTipRewards.left).toBe(10);
    expect(snapshot.lastEvents).toEqual(
      expect.arrayContaining([
        { type: 'dealer-tip-taken', handId: 'left', amount: 5 },
        expect.objectContaining({ type: 'round-settled', totalProfit: -10, dealerThanksTotal: 10 }),
      ]),
    );
    expect(randomInt).toHaveBeenCalledOnce();
    expect(randomInt).toHaveBeenCalledWith(10);

    const next = game.nextRound();
    expect(next.dealerTips.left).toBe(0);
    expect(next.dealerTipRewards.left).toBe(0);
  });

  it('clears and rebets individual hands without changing other hands', () => {
    const game = createGame(100, [card('A', 'spades'), card('2', 'hearts'), card('K', 'clubs')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('right', 'main', 15);
    game.deal();
    const next = game.nextRound();
    expect(next.rebetAmounts).toMatchObject({ left: 10, right: 15 });

    const rebet = game.rebetHand('left');

    expect(rebet.bets.left.main).toBe(10);
    expect(rebet.bets.right.main).toBe(0);
    expect(rebet.rebetAmounts.right).toBe(15);
    expect(game.rebetHand('centre').status).toBe('No previous bet saved for this seat.');
  });

  it('covers invalid bankroll withdrawals, invalid rebet affordability, and exhausted shoes', () => {
    const game = createGame(10, [card('3', 'hearts'), card('K', 'spades')]);
    game.placeBet('left', 'main', 10);
    game.deal();

    expect(game.withdrawBankroll(1)).toBe(false);
    expect(game.withdrawBankroll(0)).toBe(false);
    expect(game.clearBets().phase).toBe('playing');

    game.stick();
    expect(game.nextRound().canRebet).toBe(false);
    expect(game.rebet().status).toBe('Need £10 to rebet.');

    const exhaustedShoe = createDeterministicBeatTheHouseShoe({ dealOrder: [card('3', 'hearts')], cardsDealt: 311 });
    exhaustedShoe.draw();
    expect(() => exhaustedShoe.draw()).toThrow('shoe exhausted');
  });

  it('settles Ace Flash, Match Push, and multi-seven side-bet branches', () => {
    let game = createGame(100, [card('A', 'spades'), card('Q', 'hearts')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'aceFlash', 2);
    game.deal();

    expect(requireSummary(game.snapshot()).sideWins).toEqual([
      { betType: 'aceFlash', label: 'Ace Flash', profitHalfUnits: 48, returnedHalfUnits: 52, profit: 24, returned: 26 },
    ]);

    game = createGame(100, [card('K', 'hearts'), card('7', 'spades'), card('7', 'clubs'), card('7', 'diamonds'), card('Q', 'hearts')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 1);
    game.deal();

    const threeSevens = game.stick();
    expect(threeSevens.dealer.cards.map((dealerCard) => dealerCard.rank)).toEqual(['7', '7', '7', 'Q']);
    expect(requireSummary(threeSevens).sideWins).toEqual([
      { betType: 'dealerSevens', label: 'Dealer Sevens (3)', profitHalfUnits: 300, returnedHalfUnits: 302, profit: 150, returned: 151 },
    ]);
  });

  it('covers defensive phase guards and default bankroll paths', () => {
    const game = createGame(100, [card('K', 'hearts'), card('Q', 'spades')]);
    const idle = game.snapshot();

    expect(idle.bankroll).toBe(100);
    expect(game.placeBet('left', 'main', 0)).toEqual(idle);
    expect(game.hit()).toEqual(idle);
    expect(game.stick()).toEqual(idle);
    expect(game.nextRound()).toEqual(idle);
    expect(game.addBankroll(0).bankroll).toBe(100);
    expect(game.resetBankroll().bankroll).toBe(100);

    game.placeBet('left', 'main', 10);
    const playing = game.deal();
    expect(game.deal()).toMatchObject({
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

  it('does not advertise or place invalid saved side bets', () => {
    const source = createGame(100, [card('2', 'clubs'), card('K', 'spades')]);
    source.placeBet('left', 'main', 5);
    source.placeBet('left', 'aceFlash', 5);
    source.deal();
    source.nextRound();
    const saved = source.saveState();
    const lastBets = saved.lastBets;
    if (!lastBets) {
      throw new Error('Missing saved bets.');
    }

    const invalidLastBets = {
      ...lastBets,
      left: { ...lastBets.left, aceFlash: 6 },
    };
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    game.restoreState({
      ...saved,
      bets: {
        ...saved.bets,
        left: { ...saved.bets.left, main: 2 },
      },
      lastBets: invalidLastBets,
    });
    const before = game.snapshot();

    expect(before.canRebet).toBe(false);
    expect(before.rebetAmounts).toEqual({ left: 0, centre: 0, right: 0 });
    expect(game.rebet()).toMatchObject({ bets: before.bets, bankroll: before.bankroll });
    expect(game.rebetHand('left')).toMatchObject({ bets: before.bets, bankroll: before.bankroll });
    expect(game.snapshot().rebetAmounts).toEqual({ left: 0, centre: 0, right: 0 });
    expect(game.saveState().lastBets).toEqual(invalidLastBets);
  });

  it('rejects restored side bets above the main bet before deal mutates round state', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 100 });
    const saved = game.saveState();
    game.restoreState({
      ...saved,
      bets: {
        ...saved.bets,
        left: { ...saved.bets.left, main: 5, aceFlash: 6 },
      },
    });
    const before = game.snapshot();

    const rejected = game.deal();

    expect(rejected.status).toBe('Side bets cannot exceed the main bet on the same hand.');
    expect(rejected.phase).toBe(before.phase);
    expect(rejected.bankroll).toBe(before.bankroll);
    expect(rejected.bets).toEqual(before.bets);
    expect(rejected.shoe).toEqual(before.shoe);
  });

  it('covers player hit bust, four-card auto-stand, and dealer black-Ace settlement', () => {
    let game = createGame(100, [card('K', 'hearts'), card('Q', 'spades'), card('2', 'clubs')]);
    game.placeBet('left', 'main', 10);
    game.deal();

    const bust = game.hit();
    expect(bust.hands.left.result).toBe('lose');
    expect(bust.phase).toBe('roundOver');

    game = createGame(100, [card('3', 'hearts'), card('K', 'spades'), card('4', 'clubs'), card('5', 'diamonds'), card('6', 'hearts')]);
    game.placeBet('left', 'main', 10);
    game.deal();
    game.hit();
    game.hit();
    const stoodOnFour = game.hit();
    expect(stoodOnFour.hands.left.done).toBe(true);
    expect(stoodOnFour.phase).toBe('roundOver');

    game = createGame(100, [card('K', 'hearts'), card('A', 'spades')]);
    game.placeBet('left', 'main', 10);
    game.deal();
    const dealerBlackAce = game.stick();
    expect(dealerBlackAce.dealer.blackAce).toBe(true);
    expect(dealerBlackAce.hands.left.result).toBe('lose');
  });
});
