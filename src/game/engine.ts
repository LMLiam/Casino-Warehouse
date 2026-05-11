import { cardLabel, createDeck, isBlackAce, rankValue, type Card } from './cards';
import type { Rng } from './rng';
import {
  betTypes,
  handIds,
  type BetType,
  type Bets,
  type GameEvent,
  type GameSnapshot,
  type HandId,
  type PlayerHand,
  type RoundSummary,
  type SideBetState,
  type SideStates,
} from './types';

const sideBetTypes = betTypes.filter((betType) => betType !== 'main') as Exclude<BetType, 'main'>[];

export interface GameOptions {
  readonly initialBankroll?: number;
  readonly rng?: Rng;
  readonly deck?: Card[];
}

export interface BeatTheHouseSaveState extends Omit<GameSnapshot, 'lastEvents'> {
  readonly deck: readonly Card[];
  readonly lastBets?: Bets;
}

const handName: Record<HandId, string> = {
  left: 'Left',
  centre: 'Centre',
  right: 'Right',
};

const emptyBets = (): Bets => Object.fromEntries(handIds.map((handId) => [handId, Object.fromEntries(betTypes.map((betType) => [betType, 0]))])) as Bets;

const emptySideStates = (state: SideBetState = 'idle'): SideStates =>
  Object.fromEntries(handIds.map((handId) => [handId, Object.fromEntries(sideBetTypes.map((betType) => [betType, state]))])) as SideStates;

const createHand = (id: HandId): PlayerHand => ({
  id,
  cards: [],
  done: false,
  automaticWin: false,
});

const emptyHands = (): Record<HandId, PlayerHand> => ({
  left: createHand('left'),
  centre: createHand('centre'),
  right: createHand('right'),
});

const totalBet = (bets: Bets): number => handIds.reduce((total, handId) => total + betTypes.reduce((handTotal, betType) => handTotal + bets[handId][betType], 0), 0);

const handStake = (bets: Bets, handId: HandId): number => betTypes.reduce((total, betType) => total + bets[handId][betType], 0);

const playableHands = (bets: Bets): HandId[] => handIds.filter((handId) => bets[handId].main > 0);

const nextPlayableHand = (bets: Bets, hands: Record<HandId, PlayerHand>, after?: HandId): HandId | undefined => {
  const startIndex = after ? handIds.indexOf(after) + 1 : 0;
  return handIds.slice(startIndex).find((handId) => bets[handId].main > 0 && !hands[handId].done);
};

const cloneBets = (bets: Bets): Bets => Object.fromEntries(handIds.map((handId) => [handId, { ...bets[handId] }])) as Bets;

const cloneHands = (hands: Record<HandId, PlayerHand>): Record<HandId, PlayerHand> =>
  Object.fromEntries(handIds.map((handId) => [handId, { ...hands[handId], cards: [...hands[handId].cards] }])) as Record<HandId, PlayerHand>;

export class BeatTheHouseGame {
  private phase: GameSnapshot['phase'] = 'betting';
  private bankroll: number;
  private bets = emptyBets();
  private lastBets?: Bets;
  private deck: Card[];
  private hands = emptyHands();
  private dealer: GameSnapshot['dealer'] = { cards: [], holeRevealed: false, bust: false, blackAce: false };
  private activeHand?: HandId;
  private sideStates = emptySideStates();
  private summaries: RoundSummary[] = [];
  private status = 'Place chips on any hand, then deal.';
  private readonly rng?: Rng;

  public constructor(options: GameOptions = {}) {
    this.bankroll = options.initialBankroll ?? 100;
    this.rng = options.rng;
    this.deck = options.deck ? [...options.deck] : createDeck(this.rng);
  }

  public snapshot(lastEvents: GameEvent[] = []): GameSnapshot {
    return {
      phase: this.phase,
      bankroll: this.bankroll,
      bets: cloneBets(this.bets),
      activeHand: this.activeHand,
      hands: cloneHands(this.hands),
      dealer: {
        ...this.dealer,
        cards: [...this.dealer.cards],
      },
      sideStates: Object.fromEntries(handIds.map((handId) => [handId, { ...this.sideStates[handId] }])) as SideStates,
      summaries: [...this.summaries],
      lastEvents,
      status: this.status,
      canRebet: this.canRebet(),
    };
  }

  public saveState(): BeatTheHouseSaveState {
    const { lastEvents: _lastEvents, ...snapshot } = this.snapshot();
    return {
      ...snapshot,
      deck: [...this.deck],
      lastBets: this.lastBets ? cloneBets(this.lastBets) : undefined,
    };
  }

  public restoreState(state: BeatTheHouseSaveState): GameSnapshot {
    this.phase = state.phase;
    this.bankroll = Math.max(0, Math.floor(state.bankroll));
    this.bets = cloneBets(state.bets);
    this.lastBets = state.lastBets ? cloneBets(state.lastBets) : undefined;
    this.deck = [...state.deck];
    this.hands = cloneHands(state.hands);
    this.dealer = { ...state.dealer, cards: [...state.dealer.cards] };
    this.activeHand = state.activeHand;
    this.sideStates = Object.fromEntries(handIds.map((handId) => [handId, { ...state.sideStates[handId] }])) as SideStates;
    this.summaries = [...state.summaries];
    this.status = state.status;
    return this.snapshot();
  }

  public placeBet(handId: HandId, betType: BetType, amount: number): GameSnapshot {
    if (this.phase !== 'betting' || amount <= 0) {
      return this.snapshot();
    }

    if (betType !== 'main' && this.bets[handId].main <= 0) {
      return this.emit([{ type: 'message', message: 'Side bets need a main bet on the same hand.' }], 'Side bets need a main bet on the same hand.');
    }

    if (this.bankroll < amount) {
      return this.emit([{ type: 'message', message: `Need £${amount} available.` }], `Need £${amount} available.`);
    }

    this.bankroll -= amount;
    this.bets[handId][betType] += amount;
    this.summaries = [];
    return this.emit([{ type: 'bet-placed', handId, betType, amount }], `${handName[handId]} ${betTypeLabel(betType)} bet: £${this.bets[handId][betType]}.`);
  }

  public clearBets(): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    this.bankroll += totalBet(this.bets);
    this.bets = emptyBets();
    this.summaries = [];
    this.sideStates = emptySideStates();
    return this.emit([{ type: 'bets-cleared' }], 'Bets cleared.');
  }

  public rebet(): GameSnapshot {
    if (!this.lastBets) {
      return this.emit([{ type: 'message', message: 'No previous bet saved.' }], 'No previous bet saved.');
    }

    const requiredBankroll = totalBet(this.lastBets);
    if (this.bankroll < requiredBankroll) {
      return this.emit([{ type: 'message', message: `Need £${requiredBankroll} to rebet.` }], `Need £${requiredBankroll} to rebet.`);
    }

    this.clearBets();
    this.bets = cloneBets(this.lastBets);
    this.bankroll -= requiredBankroll;
    return this.emit([{ type: 'message', message: `Rebet £${requiredBankroll} placed.` }], `Rebet £${requiredBankroll} placed. Press deal.`);
  }

  public deal(deckOverride?: Card[]): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    const active = playableHands(this.bets);
    if (active.length === 0) {
      return this.emit([{ type: 'message', message: 'Place a main bet on at least one hand.' }], 'Place a main bet on at least one hand.');
    }

    const orphanedSideBet = handIds.some((handId) => this.bets[handId].main === 0 && sideBetTypes.some((betType) => this.bets[handId][betType] > 0));
    if (orphanedSideBet) {
      return this.emit([{ type: 'message', message: 'Side bets need a main bet on the same hand.' }], 'Side bets need a main bet on the same hand.');
    }

    this.phase = 'dealing';
    this.lastBets = cloneBets(this.bets);
    this.deck = deckOverride ? [...deckOverride] : createDeck(this.rng);
    this.hands = emptyHands();
    this.dealer = { cards: [], holeRevealed: false, bust: false, blackAce: false };
    this.sideStates = emptySideStates();
    this.summaries = [];

    const events: GameEvent[] = [{ type: 'round-started', message: 'Round started.' }];
    for (const handId of active) {
      const card = this.draw();
      const current = this.hands[handId];
      const nextHand = { ...current, cards: [card], finalCard: card };

      if (card.rank === '2') {
        this.hands[handId] = { ...nextHand, done: true, result: 'lose', finalCard: undefined };
        events.push(
          { type: 'player-card', handId, card, cardIndex: 0 },
          { type: 'hand-completed', handId, result: 'lose', message: `${handName[handId]} first card ${cardLabel(card)} is an instant loss.` },
        );
      } else if (isBlackAce(card)) {
        this.hands[handId] = { ...nextHand, done: true, result: 'win', automaticWin: true };
        events.push(
          { type: 'player-card', handId, card, cardIndex: 0 },
          { type: 'hand-completed', handId, result: 'win', message: `${handName[handId]} first-card black Ace wins automatically.` },
        );
      } else {
        this.hands[handId] = nextHand;
        events.push({ type: 'player-card', handId, card, cardIndex: 0 });
      }
    }

    this.dealer = { ...this.dealer, holeCard: this.draw(), holeRevealed: false };
    events.push({ type: 'dealer-hole', message: 'Dealer receives one face-down card.' });
    this.activeHand = nextPlayableHand(this.bets, this.hands);

    if (this.activeHand) {
      this.phase = 'playing';
      this.status = `${handName[this.activeHand]} hand: ${cardLabel(this.hands[this.activeHand].cards.at(-1)!)}. Hit or stick.`;
    } else {
      return this.playDealer(events);
    }

    return this.snapshot(events);
  }

  public hit(): GameSnapshot {
    if (this.phase !== 'playing' || !this.activeHand) {
      return this.snapshot();
    }

    const handId = this.activeHand;
    const hand = this.hands[handId];
    const card = this.draw();
    const cards = [...hand.cards, card];
    const events: GameEvent[] = [{ type: 'player-card', handId, card, cardIndex: cards.length - 1 }];

    if (card.rank === '2') {
      this.hands[handId] = { ...hand, cards, done: true, result: 'lose', finalCard: undefined };
      events.push({ type: 'hand-completed', handId, result: 'lose', message: `${handName[handId]} busted on a 2.` });
      return this.advanceFromPlayer(events);
    }

    if (cards.length >= 4) {
      this.hands[handId] = { ...hand, cards, done: true, finalCard: card };
      events.push({ type: 'hand-completed', handId, message: `${handName[handId]} reaches four cards and stands on ${cardLabel(card)}.` });
      return this.advanceFromPlayer(events);
    }

    this.hands[handId] = { ...hand, cards, finalCard: card };
    return this.emit(events, `${handName[handId]} hand: ${cardLabel(card)}. Hit or stick.`);
  }

  public stick(): GameSnapshot {
    if (this.phase !== 'playing' || !this.activeHand) {
      return this.snapshot();
    }

    const handId = this.activeHand;
    const hand = this.hands[handId];
    const finalCard = hand.cards.at(-1);
    this.hands[handId] = { ...hand, done: true, finalCard };

    return this.advanceFromPlayer([{ type: 'hand-completed', handId, message: `${handName[handId]} sticks on ${cardLabel(finalCard!)}.` }]);
  }

  public nextRound(): GameSnapshot {
    if (this.phase !== 'roundOver') {
      return this.snapshot();
    }

    this.bets = emptyBets();
    this.hands = emptyHands();
    this.dealer = { cards: [], holeRevealed: false, bust: false, blackAce: false };
    this.activeHand = undefined;
    this.sideStates = emptySideStates();
    this.summaries = [];
    this.phase = 'betting';
    return this.emit([{ type: 'message', message: 'New round ready.' }], 'Place chips on any hand, then deal.');
  }

  public addBankroll(amount: number): GameSnapshot {
    if (amount > 0) {
      this.bankroll += amount;
    }

    return this.emit([{ type: 'message', message: `Bankroll is now £${this.bankroll}.` }], `Bankroll is now £${this.bankroll}.`);
  }

  public withdrawBankroll(amount: number): boolean {
    if (amount <= 0 || this.bankroll < amount) {
      return false;
    }

    this.bankroll -= amount;
    return true;
  }

  public depositBankroll(amount: number): GameSnapshot {
    if (amount > 0) {
      this.bankroll += amount;
    }

    return this.snapshot([{ type: 'message', message: `Bankroll is now £${this.bankroll}.` }]);
  }

  public resetBankroll(amount = 100): GameSnapshot {
    this.bankroll = amount;
    return this.emit([{ type: 'message', message: `Bankroll reset to £${amount}.` }], `Bankroll reset to £${amount}.`);
  }

  public syncBankroll(amount: number): void {
    this.bankroll = Math.max(0, Math.floor(amount));
  }

  private advanceFromPlayer(events: GameEvent[]): GameSnapshot {
    const next = nextPlayableHand(this.bets, this.hands, this.activeHand);
    this.activeHand = next;

    if (!next) {
      return this.playDealer(events);
    }

    return this.emit(events, `${handName[next]} hand: ${cardLabel(this.hands[next].cards.at(-1)!)}. Hit or stick.`);
  }

  private playDealer(previousEvents: GameEvent[]): GameSnapshot {
    this.phase = 'dealer';
    this.activeHand = undefined;
    const events = [...previousEvents];
    const firstCard = this.dealer.holeCard ?? this.draw();
    this.dealer = { ...this.dealer, cards: [firstCard], holeCard: undefined, holeRevealed: true, finalCard: firstCard };
    events.push({ type: 'dealer-card', card: firstCard, cardIndex: 0, message: `Dealer reveals ${cardLabel(firstCard)}.` });

    if (isBlackAce(firstCard)) {
      this.dealer = { ...this.dealer, blackAce: true };
      events.push({ type: 'message', message: 'Dealer first-card black Ace.' });
      return this.settle(events);
    }

    if (firstCard.rank === '2') {
      this.dealer = { ...this.dealer, bust: true, finalCard: undefined };
      events.push({ type: 'message', message: 'Dealer busts on a 2.' });
      return this.settle(events);
    }

    while (this.dealer.finalCard && rankValue(this.dealer.finalCard.rank) <= 10 && this.dealer.cards.length < 4) {
      const card = this.draw();
      const cards = [...this.dealer.cards, card];
      this.dealer = { ...this.dealer, cards, finalCard: card };
      events.push({ type: 'dealer-card', card, cardIndex: cards.length - 1, message: `Dealer hits ${cardLabel(card)}.` });

      if (card.rank === '2') {
        this.dealer = { ...this.dealer, bust: true, finalCard: undefined };
        events.push({ type: 'message', message: 'Dealer busts on a 2.' });
        break;
      }
    }

    return this.settle(events);
  }

  private settle(previousEvents: GameEvent[]): GameSnapshot {
    let returned = 0;
    const summaries: RoundSummary[] = [];
    const sideStates = emptySideStates();

    for (const handId of playableHands(this.bets)) {
      const hand = this.hands[handId];
      const bets = this.bets[handId];
      let handReturned = 0;
      let mainResult: RoundSummary['mainResult'] = 'lose';

      if (hand.result === 'lose') {
        mainResult = 'lose';
      } else if (hand.automaticWin) {
        mainResult = 'win';
        handReturned += wholeChipPayout(bets.main, 1).returned;
      } else if (this.dealer.blackAce) {
        mainResult = 'lose';
      } else if (this.dealer.bust) {
        mainResult = 'win';
        handReturned += wholeChipPayout(bets.main, 1).returned;
      } else {
        const playerValue = rankValue(hand.finalCard!.rank);
        const dealerValue = rankValue(this.dealer.finalCard!.rank);
        if (playerValue > dealerValue) {
          mainResult = 'win';
          handReturned += wholeChipPayout(bets.main, 1).returned;
        } else if (playerValue === dealerValue) {
          mainResult = 'push';
          handReturned += Math.floor(bets.main);
        }
      }

      this.hands[handId] = { ...hand, result: mainResult };
      const sideResult = this.resolveSideBets(handId, mainResult);
      handReturned += sideResult.returned;
      returned += handReturned;
      sideStates[handId] = sideResult.states;

      const stake = handStake(this.bets, handId);
      summaries.push({
        handId,
        mainResult,
        stake,
        returned: handReturned,
        profit: handReturned - stake,
        sideWins: sideResult.wins,
      });
    }

    this.bankroll += returned;
    this.summaries = summaries;
    this.sideStates = sideStates;
    this.phase = 'roundOver';
    const totalProfit = summaries.reduce((total, summary) => total + summary.profit, 0);
    const events: GameEvent[] = [...previousEvents, { type: 'round-settled', summaries, totalProfit }];
    return this.emit(events, `Round complete. Total ${formatMoneyDelta(totalProfit)}.`);
  }

  private resolveSideBets(handId: HandId, mainResult: RoundSummary['mainResult']) {
    const bets = this.bets[handId];
    const hand = this.hands[handId];
    const playerFirst = hand.cards[0];
    const dealerFirst = this.dealer.cards[0];
    const wins: RoundSummary['sideWins'] = [];
    const states = Object.fromEntries(sideBetTypes.map((betType) => [betType, bets[betType] > 0 ? 'lose' : 'idle'])) as SideStates[HandId];
    let returned = 0;

    const win = (betType: Exclude<BetType, 'main'>, label: string, multiplier: number) => {
      const stake = bets[betType];
      if (stake <= 0) {
        return;
      }

      const { profit, returned: amountReturned } = wholeChipPayout(stake, multiplier);
      states[betType] = 'win';
      returned += amountReturned;
      wins.push({ betType, label, profit, returned: amountReturned });
    };

    if (bets.aceFlash > 0) {
      const playerAce = isBlackAce(playerFirst);
      const dealerAce = isBlackAce(dealerFirst);
      if (playerAce && dealerAce) {
        win('aceFlash', 'Ace Flash', 50);
      } else if (playerAce || dealerAce) {
        win('aceFlash', 'Ace Flash', 10);
      }
    }

    if (bets.dealerBust > 0 && this.dealer.bust) {
      win('dealerBust', 'Dealer Bust', 4);
    }

    if (
      bets.matchPush > 0 &&
      mainResult !== 'lose' &&
      !this.dealer.bust &&
      !this.dealer.blackAce &&
      hand.finalCard &&
      this.dealer.finalCard &&
      rankValue(hand.finalCard.rank) === rankValue(this.dealer.finalCard.rank)
    ) {
      win('matchPush', 'Match Push', 9);
    }

    if (bets.dealerSevens > 0) {
      const sevenCount = this.dealer.cards.filter((card) => card.rank === '7').length;
      const multiplier = { 1: 3, 2: 18, 3: 150, 4: 1000 }[sevenCount] ?? 0;
      if (multiplier > 0) {
        win('dealerSevens', `Dealer Sevens (${sevenCount})`, multiplier);
      }
    }

    return { returned, states, wins };
  }

  private emit(events: GameEvent[], status: string): GameSnapshot {
    this.status = status;
    return this.snapshot(events);
  }

  private draw(): Card {
    const card = this.deck.pop();
    if (!card) {
      throw new Error('Deck exhausted.');
    }

    return card;
  }

  private canRebet(): boolean {
    return this.phase === 'betting' && Boolean(this.lastBets) && totalBet(this.bets) === 0 && totalBet(this.lastBets ?? emptyBets()) <= this.bankroll;
  }
}

export const betTypeLabel = (betType: BetType): string =>
  ({
    main: 'Main',
    aceFlash: 'Ace Flash',
    dealerBust: 'Dealer Bust',
    matchPush: 'Match Push',
    dealerSevens: 'Dealer Sevens',
  })[betType];

const wholeChipPayout = (stake: number, multiplier: number) => {
  const wholeStake = Math.floor(stake);
  const profit = Math.floor(wholeStake * multiplier);
  return {
    profit,
    returned: wholeStake + profit,
  };
};

const formatMoneyDelta = (amount: number): string => {
  if (amount === 0) {
    return '£0';
  }

  return `${amount > 0 ? '+' : '-'}£${Math.abs(amount)}`;
};
