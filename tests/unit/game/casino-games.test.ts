import { describe, expect, it } from 'vitest';
import { bestTotal } from '../../../src/game/blackjack/bestTotal';
import { BlackjackGame } from '../../../src/game/blackjack/BlackjackGame';
import { BlackjackTable } from '../../../src/game/blackjackTable/BlackjackTable';
import { isBlackjackTableSnapshot } from '../../../src/game/blackjackTable/isBlackjackTableSnapshot';
import { isCard } from '../../../src/game/blackjackTable/isCard';
import { slotThemes } from '../../../src/game/catalog/slotThemes';
import type { Card } from '../../../src/game/cards/Card';
import { cardLabel } from '../../../src/game/cards/cardLabel';
import { rigDeck } from '../../../src/game/cards/rigDeck';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../../src/game/slots/SlotsGame';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('BlackjackGame', () => {
  it('pays player blackjack at 3:2', () => {
    const game = new BlackjackGame();
    const snapshot = game.deal(20, rigDeck([card('A', 'spades'), card('K', 'hearts'), card('9', 'clubs'), card('8', 'diamonds')]));

    expect(snapshot.phase).toBe('settled');
    expect(snapshot.result).toBe('blackjack');
    expect(snapshot.returned).toBe(50);
    expect(snapshot.status).toContain('3:2');
  });

  it('lets the dealer draw out and compares totals on stand', () => {
    const game = new BlackjackGame();
    game.deal(10, rigDeck([card('10', 'spades'), card('9', 'hearts'), card('6', 'clubs'), card('8', 'diamonds'), card('10', 'clubs')]));

    const snapshot = game.stand();

    expect(snapshot.result).toBe('win');
    expect(snapshot.returned).toBe(20);
    expect(snapshot.dealerCards.map(cardLabel)).toEqual(['6♣', '8♦', '10♣']);
  });

  it('stands on dealer soft 17', () => {
    const game = new BlackjackGame();
    game.deal(10, rigDeck([card('10', 'spades'), card('7', 'hearts'), card('A', 'clubs'), card('6', 'diamonds'), card('5', 'clubs')]));

    const snapshot = game.stand();

    expect(snapshot.result).toBe('push');
    expect(snapshot.dealerCards.map(cardLabel)).toEqual(['A♣', '6♦']);
    expect(snapshot.status).toBe('17 pushes dealer 17.');
  });

  it('handles hit busts, push returns, dealer blackjack, and reset', () => {
    let game = new BlackjackGame();
    const dealtBustHand = game.deal(20, rigDeck([card('10', 'clubs'), card('9', 'clubs'), card('7', 'hearts'), card('8', 'spades'), card('K', 'diamonds')]));
    expect(dealtBustHand.phase).toBe('player');
    const bust = game.hit();
    expect(bust.result).toBe('lose');
    expect(bust.returned).toBe(0);

    game = new BlackjackGame();
    expect(game.deal(20, rigDeck([card('10', 'clubs'), card('9', 'hearts'), card('10', 'diamonds'), card('9', 'spades')])).phase).toBe('player');
    expect(game.stand().result).toBe('push');

    game = new BlackjackGame();
    expect(game.deal(20, rigDeck([card('9', 'clubs'), card('7', 'diamonds'), card('A', 'hearts'), card('K', 'spades')])).result).toBe('lose');
    expect(game.reset().phase).toBe('idle');
  });

  it('supports double, split, and insurance actions', () => {
    let game = new BlackjackGame();
    game.deal(10, rigDeck([card('5', 'clubs'), card('6', 'clubs'), card('9', 'hearts'), card('7', 'spades'), card('10', 'diamonds'), card('K', 'hearts')]));
    const doubled = game.double();
    expect(doubled.phase).toBe('settled');
    expect(doubled.wager).toBe(20);

    game = new BlackjackGame();
    game.deal(
      10,
      rigDeck([
        card('8', 'clubs'),
        card('8', 'diamonds'),
        card('9', 'hearts'),
        card('7', 'spades'),
        card('10', 'clubs'),
        card('9', 'diamonds'),
        card('K', 'spades'),
      ]),
    );
    const split = game.split();
    expect(split.splitHands).toHaveLength(2);
    expect(split.phase).toBe('settled');

    game = new BlackjackGame();
    game.deal(10, rigDeck([card('9', 'clubs'), card('7', 'diamonds'), card('A', 'hearts'), card('6', 'spades')]));
    const insured = game.insurance(5);
    expect(insured.insuranceWager).toBe(5);
    expect(insured.status).toContain('Insurance placed');
  });

  it('restores an in-progress hand snapshot', () => {
    const game = new BlackjackGame();
    const original = game.deal(10, rigDeck([card('10', 'spades'), card('9', 'hearts'), card('6', 'clubs'), card('8', 'diamonds')]));
    const restored = new BlackjackGame();

    expect(restored.restore(original)).toEqual(original);
  });

  it('scores soft aces without busting the hand', () => {
    expect(bestTotal([card('A', 'spades'), card('6', 'hearts')])).toBe(17);
    expect(bestTotal([card('A', 'spades'), card('6', 'hearts'), card('9', 'clubs')])).toBe(16);
  });
});

describe('BlackjackTable', () => {
  const seats = [
    { seatId: 'seat-1', profileId: 'alice', profileName: 'Alice', bankroll: 500 },
    { seatId: 'seat-2', profileId: 'bob', profileName: 'Bob', bankroll: 500 },
  ];

  it('rejects invalid deals and starts turns only after occupied seats wager', () => {
    const table = new BlackjackTable({
      deck: rigDeck([card('9', 'clubs'), card('7', 'diamonds'), card('10', 'spades'), card('6', 'hearts'), card('8', 'clubs'), card('5', 'spades')]),
    });

    expect(table.deal('seat-3', 10, seats).error).toBe('Claim a Blackjack seat before dealing.');
    expect(table.deal('seat-1', 0, seats).error).toBe('Blackjack wager is invalid.');
    expect(table.deal('seat-1', 10, seats).snapshot.phase).toBe('betting');
    const ready = table.deal('seat-2', 20, seats);

    expect(ready.snapshot.phase).toBe('playing');
    expect(ready.snapshot.dealerCards.map(cardLabel)).toEqual(['9♣', '7♦']);
    expect(ready.snapshot.seats.map((seat) => seat.wager)).toEqual([10, 20]);
    expect(table.deal('seat-1', 10, seats).error).toBe('This Blackjack seat already has a wager.');
  });

  it('stands on shared-table dealer soft 17', () => {
    const table = new BlackjackTable({
      deck: rigDeck([card('A', 'clubs'), card('6', 'diamonds'), card('10', 'spades'), card('7', 'hearts'), card('5', 'clubs')]),
    });
    const oneSeat = [seats[0]];
    table.deal('seat-1', 10, oneSeat);

    const stood = table.act('stand', 'seat-1', oneSeat);

    expect(stood.settlements[0]).toMatchObject({ seatId: 'seat-1', returned: 10, profit: 0 });
    expect(stood.snapshot.dealerCards.map(cardLabel)).toEqual(['A♣', '6♦']);
    expect(stood.snapshot.seats[0].status).toBe('17 pushes dealer 17.');
  });

  it('covers hit bust, wrong turn, double, reset, and settled-state deal rejection', () => {
    const table = new BlackjackTable({
      deck: rigDeck([
        card('9', 'clubs'),
        card('7', 'diamonds'),
        card('10', 'spades'),
        card('6', 'hearts'),
        card('8', 'clubs'),
        card('5', 'spades'),
        card('K', 'hearts'),
        card('10', 'clubs'),
        card('9', 'diamonds'),
        card('8', 'diamonds'),
      ]),
    });
    table.deal('seat-1', 10, seats);
    table.deal('seat-2', 20, seats);

    expect(table.act('hit', 'seat-2', seats).error).toBe('It is not your Blackjack turn.');
    const busted = table.act('hit', 'seat-1', seats);
    expect(busted.settlements[0]).toMatchObject({ seatId: 'seat-1', wagered: 10, returned: 0, profit: -10 });
    const doubled = table.act('double', 'seat-2', seats);
    expect(doubled.debit).toBe(20);
    expect(doubled.snapshot.phase).toBe('settled');
    expect(doubled.settlements[0].seatId).toBe('seat-2');
    expect(table.deal('seat-1', 10, seats).error).toBe('Start a new Blackjack table before dealing again.');
    expect(table.act('new-hand', 'seat-1', seats).snapshot.phase).toBe('betting');
  });

  it('covers split, insurance, dealer blackjack, and spectator snapshots', () => {
    const splitTable = new BlackjackTable({
      deck: rigDeck([
        card('9', 'clubs'),
        card('7', 'diamonds'),
        card('8', 'spades'),
        card('8', 'hearts'),
        card('10', 'clubs'),
        card('10', 'diamonds'),
        card('3', 'clubs'),
        card('4', 'clubs'),
        card('K', 'hearts'),
      ]),
    });
    const oneSeat = [seats[0]];
    splitTable.deal('seat-1', 10, oneSeat);
    const split = splitTable.act('split', 'seat-1', oneSeat);
    expect(split.debit).toBe(10);
    expect(split.snapshot.phase).toBe('settled');
    expect(split.snapshot.seats[0].splitHands).toHaveLength(2);

    const insuranceTable = new BlackjackTable({
      deck: rigDeck([card('A', 'clubs'), card('K', 'diamonds'), card('9', 'spades'), card('8', 'hearts')]),
    });
    const dealerBlackjack = insuranceTable.deal('seat-1', 10, oneSeat);
    expect(dealerBlackjack.settlements[0]).toMatchObject({ seatId: 'seat-1', returned: 0, profit: -10 });
    expect(insuranceTable.snapshot([{ seatId: 'seat-2' }]).seats[0].status).toBe('Open seat.');
  });

  it('covers natural Blackjack, dealer Blackjack push, and insurance placement', () => {
    const naturalTable = new BlackjackTable({
      deck: rigDeck([card('9', 'clubs'), card('7', 'diamonds'), card('A', 'spades'), card('K', 'hearts')]),
    });
    const oneSeat = [seats[0]];
    const natural = naturalTable.deal('seat-1', 20, oneSeat);
    expect(natural.settlements[0]).toMatchObject({ seatId: 'seat-1', returned: 50, profit: 30 });
    expect(natural.snapshot.phase).toBe('settled');

    const pushTable = new BlackjackTable({
      deck: rigDeck([card('A', 'clubs'), card('K', 'diamonds'), card('A', 'spades'), card('Q', 'hearts')]),
    });
    const push = pushTable.deal('seat-1', 20, oneSeat);
    expect(push.settlements[0]).toMatchObject({ seatId: 'seat-1', returned: 20, profit: 0 });

    const insuranceTable = new BlackjackTable({
      deck: rigDeck([card('A', 'clubs'), card('9', 'diamonds'), card('10', 'spades'), card('6', 'hearts'), card('8', 'clubs')]),
    });
    insuranceTable.deal('seat-1', 20, oneSeat);
    const insured = insuranceTable.act('insurance', 'seat-1', oneSeat);
    expect(insured.debit).toBe(10);
    expect(insured.snapshot.seats[0].insuranceWager).toBe(10);
    expect(insuranceTable.act('insurance', 'seat-1', oneSeat).error).toBe('Insurance is not available.');
  });

  it('validates Blackjack table snapshot and card guards', () => {
    const table = new BlackjackTable();
    const snapshot = table.snapshot([{ seatId: 'seat-1' }]);

    expect(isBlackjackTableSnapshot(snapshot)).toBe(true);
    expect(isBlackjackTableSnapshot({ kind: 'blackjack' })).toBe(false);
    expect(isBlackjackTableSnapshot(null)).toBe(false);
    expect(isCard(card('A', 'spades'))).toBe(true);
    expect(isCard({ rank: '1', suit: 'stars' })).toBe(false);
  });
});

describe('SlotsGame', () => {
  it('pays Thai Princess row wins for matching premium symbols on a 3x5 grid', () => {
    const game = new SlotsGame();
    const snapshot = game.spin(5, [
      'princess',
      'princess',
      'princess',
      'lotus',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'fan',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'fan',
      'elephant',
    ]);

    expect(snapshot.phase).toBe('spun');
    expect(snapshot.columns).toBe(3);
    expect(snapshot.rows).toBe(5);
    expect(snapshot.reels).toHaveLength(15);
    expect(snapshot.lineWin).toBe(1000);
    expect(snapshot.jackpotWin?.tier).toBe('grand');
    expect(snapshot.returned).toBe(1000);
  });

  it('registers only the Thai Princess slot theme', () => {
    const game = new SlotsGame({ theme: slotThemes[0] });

    const snapshot = game.spin(2, [
      'temple',
      'temple',
      'temple',
      'lotus',
      'elephant',
      'fan',
      'orchid',
      'fan',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
    ]);

    expect(slotThemes.map((theme) => theme.id)).toEqual(['thai-princess']);
    expect(snapshot.themeTitle).toBe('Thai Princess');
    expect(snapshot.jackpotWin).toEqual({ tier: 'minor', label: 'Temple Jackpot', amount: 70 });
    expect(snapshot.returned).toBe(70);
  });

  it('supports Thai Princess wild rows and lotus scatter behaviour', () => {
    const thaiPrincess = slotThemes.find((theme) => theme.id === 'thai-princess');
    const game = new SlotsGame({ theme: thaiPrincess });

    const wildLine = game.spin(2, [
      'elephant',
      'princess',
      'elephant',
      'fan',
      'orchid',
      'temple',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'fan',
      'elephant',
    ]);
    expect(wildLine.themeTitle).toBe('Thai Princess');
    expect(wildLine.reels).toHaveLength(15);
    expect(wildLine.lineWin).toBe(80);

    const freeSpins = game.spin(2, [
      'lotus',
      'lotus',
      'fan',
      'temple',
      'orchid',
      'fan',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);
    expect(freeSpins.freeSpinsRemaining).toBe(8);
    expect(freeSpins.status).toContain('8 free spins awarded');

    const bonus = game.spin(2, [
      'lotus',
      'lotus',
      'lotus',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);
    expect(bonus.phase).toBe('bonus');
    expect(bonus.bonusPicksRemaining).toBe(4);
  });

  it('runs a four-pick Thai Princess bonus game after at least three lotus symbols', () => {
    const game = new SlotsGame();
    game.spin(10, [
      'lotus',
      'lotus',
      'lotus',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);
    game.pickBonus(5);
    game.pickBonus(8);
    game.pickBonus(10);
    const snapshot = game.pickBonus(12);

    expect(snapshot.phase).toBe('spun');
    expect(snapshot.bonusBank).toBe(350);
    expect(snapshot.returned).toBe(350);
  });

  it('awards and consumes free spins for two lotus scatter symbols', () => {
    const game = new SlotsGame();
    const awarded = game.spin(10, [
      'lotus',
      'lotus',
      'fan',
      'temple',
      'orchid',
      'fan',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);

    expect(awarded.freeSpinsRemaining).toBe(8);
    expect(awarded.status).toContain('free spins awarded');

    const used = game.spin(10, [
      'fan',
      'fan',
      'fan',
      'temple',
      'orchid',
      'fan',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);

    expect(used.freeSpinsRemaining).toBe(7);
    expect(used.returned).toBe(240);
    expect(used.status).toContain('Free spin used');
  });

  it('restores a slot bonus snapshot for the same theme', () => {
    const game = new SlotsGame();
    const original = game.spin(10, [
      'lotus',
      'lotus',
      'lotus',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);
    const restored = new SlotsGame();

    expect(restored.restore(original)).toEqual(original);
  });

  it('ignores spins during bonus', () => {
    const game = new SlotsGame();
    const bonus = game.spin(10, [
      'lotus',
      'lotus',
      'lotus',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
      'temple',
      'fan',
      'orchid',
      'elephant',
    ]);
    expect(
      game.spin(10, [
        'princess',
        'princess',
        'princess',
        'temple',
        'fan',
        'orchid',
        'elephant',
        'temple',
        'fan',
        'orchid',
        'elephant',
        'temple',
        'fan',
        'orchid',
        'elephant',
      ]),
    ).toEqual(bonus);
  });
});

describe('shared casino bankroll', () => {
  it('can debit one player wallet for Blackjack and credit the returned win', () => {
    const wallet = new BeatTheHouseGame({ initialBankroll: 100 });
    const blackjack = new BlackjackGame();

    expect(wallet.withdrawBankroll(20)).toBe(true);
    const blackjackResult = blackjack.deal(20, rigDeck([card('A', 'spades'), card('K', 'hearts'), card('9', 'clubs'), card('8', 'diamonds')]));
    wallet.depositBankroll(blackjackResult.returned);

    expect(wallet.snapshot().bankroll).toBe(130);
  });

  it('keeps separate player bankrolls while each player can use the same games', () => {
    const playerOne = new BeatTheHouseGame({ initialBankroll: 100 });
    const playerTwo = new BeatTheHouseGame({ initialBankroll: 100 });

    expect(playerOne.withdrawBankroll(25)).toBe(true);

    expect(playerOne.snapshot().bankroll).toBe(75);
    expect(playerTwo.snapshot().bankroll).toBe(100);
  });
});
