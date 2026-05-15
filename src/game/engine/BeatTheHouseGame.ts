import type { Card } from '../cards/Card';
import { cardLabel } from '../cards/cardLabel';
import { createDeck } from '../cards/createDeck';
import { isBlackAce } from '../cards/isBlackAce';
import { rankValue } from '../cards/rankValue';
import type { Rng } from '../rng/Rng';
import { secureRandomInt } from '../rng/secureRandomInt';
import type { Bets } from '../types/Bets';
import type { BetType } from '../types/BetType';
import { betTypes } from '../types/betTypes';
import type { DealerTips } from '../types/DealerTips';
import type { GameEvent } from '../types/GameEvent';
import type { GameSnapshot } from '../types/GameSnapshot';
import type { HandId } from '../types/HandId';
import { handIds } from '../types/handIds';
import type { PlayerHand } from '../types/PlayerHand';
import type { RoundSummary } from '../types/RoundSummary';
import type { SideBetState } from '../types/SideBetState';
import type { SideStates } from '../types/SideStates';
import type { BeatTheHouseSaveState } from './BeatTheHouseSaveState';
import { betTypeLabel } from './betTypeLabel';
import type { GameOptions } from './GameOptions';

export class BeatTheHouseGame {
  private static readonly defaultInitialBankroll = 100;
  private static readonly maxPlayerCards = 4;
  private static readonly dealerDrawMaxRank = 10;
  private static readonly maxDealerCards = 4;
  private static readonly dealerThanksChanceDenominator = 10;
  private static readonly dealerThanksWinningRoll = 0;
  private static readonly dealerThanksMultiplier = 2;
  private static readonly sideBetMultipliers = {
    aceFlashBoth: 50,
    aceFlashSingle: 10,
    dealerBust: 4,
    matchPush: 9,
  } as const;

  private static readonly sideBetTypes = betTypes.filter((betType) => betType !== 'main') as Exclude<BetType, 'main'>[];

  private static readonly handName: Record<HandId, string> = {
    left: 'Left',
    centre: 'Centre',
    right: 'Right',
  };

  private phase: GameSnapshot['phase'] = 'betting';
  private bankroll: number;
  private bets = BeatTheHouseGame.emptyBets();
  private dealerTips = BeatTheHouseGame.emptyDealerTips();
  private dealerTipRewards = BeatTheHouseGame.emptyDealerTips();
  private lastBets?: Bets;
  private deck: Card[];
  private hands = BeatTheHouseGame.emptyHands();
  private dealer: GameSnapshot['dealer'] = { cards: [], holeRevealed: false, bust: false, blackAce: false };
  private activeHand?: HandId;
  private sideStates = BeatTheHouseGame.emptySideStates();
  private summaries: RoundSummary[] = [];
  private status = 'Place chips on any hand, then deal.';
  private readonly rng?: Rng;
  private readonly randomInt: (maxExclusive: number) => number;

  public constructor(options: GameOptions = {}) {
    this.bankroll = options.initialBankroll ?? BeatTheHouseGame.defaultInitialBankroll;
    this.rng = options.rng;
    this.randomInt = options.randomInt ?? secureRandomInt;
    this.deck = options.deck ? [...options.deck] : createDeck(this.rng);
  }

  public snapshot(lastEvents: GameEvent[] = []): GameSnapshot {
    return {
      phase: this.phase,
      bankroll: this.bankroll,
      bets: BeatTheHouseGame.cloneBets(this.bets),
      dealerTips: BeatTheHouseGame.cloneDealerTips(this.dealerTips),
      dealerTipRewards: BeatTheHouseGame.cloneDealerTips(this.dealerTipRewards),
      activeHand: this.activeHand,
      hands: BeatTheHouseGame.cloneHands(this.hands),
      dealer: {
        ...this.dealer,
        cards: [...this.dealer.cards],
      },
      sideStates: Object.fromEntries(handIds.map((handId) => [handId, { ...this.sideStates[handId] }])) as SideStates,
      summaries: [...this.summaries],
      lastEvents,
      status: this.status,
      canRebet: this.canRebet(),
      rebetAmounts: this.rebetAmounts(),
    };
  }

  public saveState(): BeatTheHouseSaveState {
    const { lastEvents: _lastEvents, ...snapshot } = this.snapshot();
    return {
      ...snapshot,
      deck: [...this.deck],
      lastBets: this.lastBets ? BeatTheHouseGame.cloneBets(this.lastBets) : undefined,
    };
  }

  public restoreState(state: BeatTheHouseSaveState): GameSnapshot {
    this.phase = state.phase;
    this.bankroll = Math.max(0, Math.floor(state.bankroll));
    this.bets = BeatTheHouseGame.cloneBets(state.bets);
    this.dealerTips = BeatTheHouseGame.cloneDealerTips(BeatTheHouseGame.restoredDealerTips(state, 'dealerTips'));
    this.dealerTipRewards = BeatTheHouseGame.cloneDealerTips(BeatTheHouseGame.restoredDealerTips(state, 'dealerTipRewards'));
    this.lastBets = state.lastBets ? BeatTheHouseGame.cloneBets(state.lastBets) : undefined;
    this.deck = [...state.deck];
    this.hands = BeatTheHouseGame.cloneHands(state.hands);
    this.dealer = { ...state.dealer, cards: [...state.dealer.cards] };
    this.activeHand = state.activeHand;
    this.sideStates = Object.fromEntries(handIds.map((handId) => [handId, { ...state.sideStates[handId] }])) as SideStates;
    this.summaries = [...state.summaries];
    this.status = state.status;
    return this.snapshot();
  }

  public placeDealerTip(handId: HandId, amount: number): GameSnapshot {
    const wholeAmount = Math.floor(amount);
    if (this.phase !== 'betting' || wholeAmount <= 0) {
      return this.snapshot();
    }

    if (this.bankroll < wholeAmount) {
      return this.emit([{ type: 'message', message: `Need £${wholeAmount} available.` }], `Need £${wholeAmount} available.`);
    }

    this.bankroll -= wholeAmount;
    this.dealerTips[handId] += wholeAmount;
    this.dealerTipRewards = BeatTheHouseGame.emptyDealerTips();
    this.summaries = [];
    return this.emit(
      [{ type: 'dealer-tip-placed', handId, amount: wholeAmount }],
      `${BeatTheHouseGame.handName[handId]} dealer tip: £${this.dealerTips[handId]}.`,
    );
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
    return this.emit(
      [{ type: 'bet-placed', handId, betType, amount }],
      `${BeatTheHouseGame.handName[handId]} ${betTypeLabel(betType)} bet: £${this.bets[handId][betType]}.`,
    );
  }

  public clearBets(): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    this.bankroll += BeatTheHouseGame.totalBet(this.bets);
    this.bankroll += BeatTheHouseGame.totalDealerTips(this.dealerTips);
    this.bets = BeatTheHouseGame.emptyBets();
    this.dealerTips = BeatTheHouseGame.emptyDealerTips();
    this.dealerTipRewards = BeatTheHouseGame.emptyDealerTips();
    this.summaries = [];
    this.sideStates = BeatTheHouseGame.emptySideStates();
    return this.emit([{ type: 'bets-cleared' }], 'Bets cleared.');
  }

  public clearHandBets(handId: HandId): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    const refund = BeatTheHouseGame.handStake(this.bets, handId) + this.dealerTips[handId];
    if (refund <= 0) {
      return this.snapshot();
    }

    this.bankroll += refund;
    this.bets[handId] = BeatTheHouseGame.emptyHandBets();
    this.dealerTips[handId] = 0;
    this.dealerTipRewards[handId] = 0;
    this.summaries = [];
    this.sideStates[handId] = BeatTheHouseGame.emptySideState();
    return this.emit([{ type: 'bets-cleared', handId }], `${BeatTheHouseGame.handName[handId]} bets cleared.`);
  }

  public rebet(): GameSnapshot {
    if (!this.lastBets) {
      return this.emit([{ type: 'message', message: 'No previous bet saved.' }], 'No previous bet saved.');
    }

    const requiredBankroll = BeatTheHouseGame.totalBet(this.lastBets);
    if (this.bankroll < requiredBankroll) {
      return this.emit([{ type: 'message', message: `Need £${requiredBankroll} to rebet.` }], `Need £${requiredBankroll} to rebet.`);
    }

    this.clearBets();
    this.bets = BeatTheHouseGame.cloneBets(this.lastBets);
    this.bankroll -= requiredBankroll;
    return this.emit([{ type: 'message', message: `Rebet £${requiredBankroll} placed.` }], `Rebet £${requiredBankroll} placed. Press deal.`);
  }

  public rebetHand(handId: HandId): GameSnapshot {
    if (!this.lastBets) {
      return this.emit([{ type: 'message', message: 'No previous bet saved.' }], 'No previous bet saved.');
    }

    const requiredBankroll = BeatTheHouseGame.handStake(this.lastBets, handId);
    if (requiredBankroll <= 0) {
      return this.emit([{ type: 'message', message: 'No previous bet saved for this seat.' }], 'No previous bet saved for this seat.');
    }

    if (this.bankroll < requiredBankroll) {
      return this.emit([{ type: 'message', message: `Need £${requiredBankroll} to rebet.` }], `Need £${requiredBankroll} to rebet.`);
    }

    this.clearHandBets(handId);
    this.bets[handId] = { ...this.lastBets[handId] };
    this.bankroll -= requiredBankroll;
    return this.emit([{ type: 'message', message: `Rebet £${requiredBankroll} placed.` }], `Rebet £${requiredBankroll} placed. Press deal.`);
  }

  public deal(deckOverride?: Card[]): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    const active = BeatTheHouseGame.playableHands(this.bets);
    if (active.length === 0) {
      return this.emit([{ type: 'message', message: 'Place a main bet on at least one hand.' }], 'Place a main bet on at least one hand.');
    }

    const orphanedSideBet = handIds.some(
      (handId) => this.bets[handId].main === 0 && BeatTheHouseGame.sideBetTypes.some((betType) => this.bets[handId][betType] > 0),
    );
    if (orphanedSideBet) {
      return this.emit([{ type: 'message', message: 'Side bets need a main bet on the same hand.' }], 'Side bets need a main bet on the same hand.');
    }

    this.phase = 'dealing';
    this.lastBets = BeatTheHouseGame.cloneBets(this.bets);
    this.dealerTipRewards = BeatTheHouseGame.emptyDealerTips();
    this.deck = deckOverride ? [...deckOverride] : createDeck(this.rng);
    this.hands = BeatTheHouseGame.emptyHands();
    this.dealer = { cards: [], holeRevealed: false, bust: false, blackAce: false };
    this.sideStates = BeatTheHouseGame.emptySideStates();
    this.summaries = [];

    const events: GameEvent[] = [
      ...handIds.flatMap((handId): GameEvent[] => (this.dealerTips[handId] > 0 ? [{ type: 'dealer-tip-taken', handId, amount: this.dealerTips[handId] }] : [])),
      { type: 'round-started', message: 'Round started.' },
    ];
    for (const handId of active) {
      const card = this.draw();
      const current = this.hands[handId];
      const nextHand = { ...current, cards: [card], finalCard: card };

      if (card.rank === '2') {
        this.hands[handId] = { ...nextHand, done: true, result: 'lose', finalCard: undefined };
        events.push(
          { type: 'player-card', handId, card, cardIndex: 0 },
          { type: 'hand-completed', handId, result: 'lose', message: `${BeatTheHouseGame.handName[handId]} first card ${cardLabel(card)} is an instant loss.` },
        );
      } else if (isBlackAce(card)) {
        this.hands[handId] = { ...nextHand, done: true, result: 'win', automaticWin: true };
        events.push(
          { type: 'player-card', handId, card, cardIndex: 0 },
          { type: 'hand-completed', handId, result: 'win', message: `${BeatTheHouseGame.handName[handId]} first-card black Ace wins automatically.` },
        );
      } else {
        this.hands[handId] = nextHand;
        events.push({ type: 'player-card', handId, card, cardIndex: 0 });
      }
    }

    this.dealer = { ...this.dealer, holeCard: this.draw(), holeRevealed: false };
    events.push({ type: 'dealer-hole', message: 'Dealer receives one face-down card.' });
    this.activeHand = BeatTheHouseGame.nextPlayableHand(this.bets, this.hands);

    if (this.activeHand) {
      this.phase = 'playing';
      this.status = `${BeatTheHouseGame.handName[this.activeHand]} hand: ${cardLabel(this.hands[this.activeHand].cards.at(-1)!)}. Hit or stick.`;
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
      events.push({ type: 'hand-completed', handId, result: 'lose', message: `${BeatTheHouseGame.handName[handId]} busted on a 2.` });
      return this.advanceFromPlayer(events);
    }

    if (cards.length >= BeatTheHouseGame.maxPlayerCards) {
      this.hands[handId] = { ...hand, cards, done: true, finalCard: card };
      events.push({ type: 'hand-completed', handId, message: `${BeatTheHouseGame.handName[handId]} reaches four cards and stands on ${cardLabel(card)}.` });
      return this.advanceFromPlayer(events);
    }

    this.hands[handId] = { ...hand, cards, finalCard: card };
    return this.emit(events, `${BeatTheHouseGame.handName[handId]} hand: ${cardLabel(card)}. Hit or stick.`);
  }

  public stick(): GameSnapshot {
    if (this.phase !== 'playing' || !this.activeHand) {
      return this.snapshot();
    }

    const handId = this.activeHand;
    const hand = this.hands[handId];
    const finalCard = hand.cards.at(-1);
    this.hands[handId] = { ...hand, done: true, finalCard };

    return this.advanceFromPlayer([{ type: 'hand-completed', handId, message: `${BeatTheHouseGame.handName[handId]} sticks on ${cardLabel(finalCard!)}.` }]);
  }

  public nextRound(): GameSnapshot {
    if (this.phase !== 'roundOver') {
      return this.snapshot();
    }

    this.bets = BeatTheHouseGame.emptyBets();
    this.dealerTips = BeatTheHouseGame.emptyDealerTips();
    this.dealerTipRewards = BeatTheHouseGame.emptyDealerTips();
    this.hands = BeatTheHouseGame.emptyHands();
    this.dealer = { cards: [], holeRevealed: false, bust: false, blackAce: false };
    this.activeHand = undefined;
    this.sideStates = BeatTheHouseGame.emptySideStates();
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

  private static emptyBets(): Bets {
    return Object.fromEntries(handIds.map((handId) => [handId, BeatTheHouseGame.emptyHandBets()])) as Bets;
  }

  private static emptyDealerTips(): DealerTips {
    return Object.fromEntries(handIds.map((handId) => [handId, 0])) as DealerTips;
  }

  private static emptyHandBets(): Bets[HandId] {
    return Object.fromEntries(betTypes.map((betType) => [betType, 0])) as Bets[HandId];
  }

  private static emptySideState(state: SideBetState = 'idle'): SideStates[HandId] {
    return Object.fromEntries(BeatTheHouseGame.sideBetTypes.map((betType) => [betType, state])) as SideStates[HandId];
  }

  private static emptySideStates(state: SideBetState = 'idle'): SideStates {
    return Object.fromEntries(handIds.map((handId) => [handId, BeatTheHouseGame.emptySideState(state)])) as SideStates;
  }

  private static createHand(id: HandId): PlayerHand {
    return {
      id,
      cards: [],
      done: false,
      automaticWin: false,
    };
  }

  private static emptyHands(): Record<HandId, PlayerHand> {
    return {
      left: BeatTheHouseGame.createHand('left'),
      centre: BeatTheHouseGame.createHand('centre'),
      right: BeatTheHouseGame.createHand('right'),
    };
  }

  private static totalBet(bets: Bets): number {
    return handIds.reduce((total, handId) => total + betTypes.reduce((handTotal, betType) => handTotal + bets[handId][betType], 0), 0);
  }

  private static totalDealerTips(dealerTips: DealerTips): number {
    return handIds.reduce((total, handId) => total + dealerTips[handId], 0);
  }

  private static handStake(bets: Bets, handId: HandId): number {
    return betTypes.reduce((total, betType) => total + bets[handId][betType], 0);
  }

  private static playableHands(bets: Bets): HandId[] {
    return handIds.filter((handId) => bets[handId].main > 0);
  }

  private static nextPlayableHand(bets: Bets, hands: Record<HandId, PlayerHand>, after?: HandId): HandId | undefined {
    const startIndex = after ? handIds.indexOf(after) + 1 : 0;
    return handIds.slice(startIndex).find((handId) => bets[handId].main > 0 && !hands[handId].done);
  }

  private static cloneBets(bets: Bets): Bets {
    return Object.fromEntries(handIds.map((handId) => [handId, { ...bets[handId] }])) as Bets;
  }

  private static cloneDealerTips(dealerTips: DealerTips): DealerTips {
    return Object.fromEntries(handIds.map((handId) => [handId, Math.max(0, Math.floor(dealerTips[handId] ?? 0))])) as DealerTips;
  }

  private static restoredDealerTips(state: BeatTheHouseSaveState, key: 'dealerTips' | 'dealerTipRewards'): DealerTips {
    return ((state as BeatTheHouseSaveState & Partial<Record<typeof key, DealerTips>>)[key] ?? BeatTheHouseGame.emptyDealerTips()) as DealerTips;
  }

  private static cloneHands(hands: Record<HandId, PlayerHand>): Record<HandId, PlayerHand> {
    return Object.fromEntries(handIds.map((handId) => [handId, { ...hands[handId], cards: [...hands[handId].cards] }])) as Record<HandId, PlayerHand>;
  }

  private advanceFromPlayer(events: GameEvent[]): GameSnapshot {
    const next = BeatTheHouseGame.nextPlayableHand(this.bets, this.hands, this.activeHand);
    this.activeHand = next;

    if (!next) {
      return this.playDealer(events);
    }

    return this.emit(events, `${BeatTheHouseGame.handName[next]} hand: ${cardLabel(this.hands[next].cards.at(-1)!)}. Hit or stick.`);
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

    while (
      this.dealer.finalCard &&
      rankValue(this.dealer.finalCard.rank) <= BeatTheHouseGame.dealerDrawMaxRank &&
      this.dealer.cards.length < BeatTheHouseGame.maxDealerCards
    ) {
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
    const sideStates = BeatTheHouseGame.emptySideStates();
    const dealerTipRewards = this.resolveDealerThanks();

    for (const handId of BeatTheHouseGame.playableHands(this.bets)) {
      const hand = this.hands[handId];
      const bets = this.bets[handId];
      let handReturned = 0;
      let mainResult: RoundSummary['mainResult'] = 'lose';

      if (hand.result === 'lose') {
        mainResult = 'lose';
      } else if (hand.automaticWin) {
        mainResult = 'win';
        handReturned += BeatTheHouseGame.wholeChipPayout(bets.main, 1).returned;
      } else if (this.dealer.blackAce) {
        mainResult = 'lose';
      } else if (this.dealer.bust) {
        mainResult = 'win';
        handReturned += BeatTheHouseGame.wholeChipPayout(bets.main, 1).returned;
      } else {
        const playerValue = rankValue(hand.finalCard!.rank);
        const dealerValue = rankValue(this.dealer.finalCard!.rank);
        if (playerValue > dealerValue) {
          mainResult = 'win';
          handReturned += BeatTheHouseGame.wholeChipPayout(bets.main, 1).returned;
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

      const stake = BeatTheHouseGame.handStake(this.bets, handId);
      summaries.push({
        handId,
        mainResult,
        stake,
        returned: handReturned,
        profit: handReturned - stake,
        sideWins: sideResult.wins,
      });
    }

    const dealerThanksTotal = BeatTheHouseGame.totalDealerTips(dealerTipRewards);
    this.bankroll += returned + dealerThanksTotal;
    this.summaries = summaries;
    this.sideStates = sideStates;
    this.dealerTipRewards = dealerTipRewards;
    this.phase = 'roundOver';
    const totalProfit = summaries.reduce((total, summary) => total + summary.profit, 0);
    const events: GameEvent[] = [...previousEvents, { type: 'round-settled', summaries, totalProfit, dealerThanksTotal }];
    const thanksStatus = dealerThanksTotal > 0 ? ` Dealer's Thanks ${BeatTheHouseGame.formatMoneyDelta(dealerThanksTotal)}.` : '';
    return this.emit(events, `Round complete. Total ${BeatTheHouseGame.formatMoneyDelta(totalProfit)}.${thanksStatus}`);
  }

  private resolveDealerThanks(): DealerTips {
    return Object.fromEntries(
      handIds.map((handId) => {
        const tip = this.dealerTips[handId];
        const reward =
          tip > 0 && this.randomInt(BeatTheHouseGame.dealerThanksChanceDenominator) === BeatTheHouseGame.dealerThanksWinningRoll
            ? tip * BeatTheHouseGame.dealerThanksMultiplier
            : 0;
        return [handId, reward];
      }),
    ) as DealerTips;
  }

  private resolveSideBets(handId: HandId, mainResult: RoundSummary['mainResult']) {
    const bets = this.bets[handId];
    const hand = this.hands[handId];
    const playerFirst = hand.cards[0];
    const dealerFirst = this.dealer.cards[0];
    const wins: RoundSummary['sideWins'] = [];
    const states = Object.fromEntries(BeatTheHouseGame.sideBetTypes.map((betType) => [betType, bets[betType] > 0 ? 'lose' : 'idle'])) as SideStates[HandId];
    let returned = 0;

    const win = (betType: Exclude<BetType, 'main'>, label: string, multiplier: number) => {
      const stake = bets[betType];
      if (stake <= 0) {
        return;
      }

      const { profit, returned: amountReturned } = BeatTheHouseGame.wholeChipPayout(stake, multiplier);
      states[betType] = 'win';
      returned += amountReturned;
      wins.push({ betType, label, profit, returned: amountReturned });
    };

    if (bets.aceFlash > 0) {
      const playerAce = isBlackAce(playerFirst);
      const dealerAce = isBlackAce(dealerFirst);
      if (playerAce && dealerAce) {
        win('aceFlash', 'Ace Flash', BeatTheHouseGame.sideBetMultipliers.aceFlashBoth);
      } else if (playerAce || dealerAce) {
        win('aceFlash', 'Ace Flash', BeatTheHouseGame.sideBetMultipliers.aceFlashSingle);
      }
    }

    if (bets.dealerBust > 0 && this.dealer.bust) {
      win('dealerBust', 'Dealer Bust', BeatTheHouseGame.sideBetMultipliers.dealerBust);
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
      win('matchPush', 'Match Push', BeatTheHouseGame.sideBetMultipliers.matchPush);
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
    return (
      this.phase === 'betting' &&
      Boolean(this.lastBets) &&
      BeatTheHouseGame.totalBet(this.bets) === 0 &&
      BeatTheHouseGame.totalDealerTips(this.dealerTips) === 0 &&
      BeatTheHouseGame.totalBet(this.lastBets ?? BeatTheHouseGame.emptyBets()) <= this.bankroll
    );
  }

  private rebetAmounts(): Record<HandId, number> {
    return Object.fromEntries(handIds.map((handId) => [handId, this.lastBets ? BeatTheHouseGame.handStake(this.lastBets, handId) : 0])) as Record<
      HandId,
      number
    >;
  }

  private static wholeChipPayout(stake: number, multiplier: number): { readonly profit: number; readonly returned: number } {
    const wholeStake = Math.floor(stake);
    const profit = Math.floor(wholeStake * multiplier);
    return {
      profit,
      returned: wholeStake + profit,
    };
  }

  private static formatMoneyDelta(amount: number): string {
    if (amount === 0) {
      return '£0';
    }

    return `${amount > 0 ? '+' : '-'}£${Math.abs(amount)}`;
  }
}
