import type { Card } from '../cards/Card';
import type { Rng } from '../rng/Rng';
import { secureRandomInt } from '../rng/secureRandomInt';
import { BeatTheHouseShoe } from '../beatTheHouse/shoe/BeatTheHouseShoe';
import { createBeatTheHouseShoe } from '../beatTheHouse/shoe/createBeatTheHouseShoe';
import type { Bets } from '../types/Bets';
import type { BetType } from '../types/BetType';
import { betTypes } from '../types/betTypes';
import type { DealerHand } from '../types/DealerHand';
import type { DealerTips } from '../types/DealerTips';
import type { GameEvent } from '../types/GameEvent';
import type { GameSnapshot } from '../types/GameSnapshot';
import type { HandId } from '../types/HandId';
import { handIds } from '../types/handIds';
import type { PlayerHand } from '../types/PlayerHand';
import type { PublicDealerHand } from '../types/PublicDealerHand';
import type { RoundSummary } from '../types/RoundSummary';
import type { SideBetState } from '../types/SideBetState';
import type { SideBetType } from '../types/SideBetType';
import type { SideStates } from '../types/SideStates';
import type { BeatTheHouseSaveState } from './BeatTheHouseSaveState';
import type { GameOptions } from './GameOptions';

export abstract class BeatTheHouseState {
  protected static readonly defaultInitialBankroll = 100;
  protected static readonly maxPlayerCards = 4;
  protected static readonly dealerDrawMaxRank = 10;
  protected static readonly maxDealerCards = 4;
  protected static readonly dealerThanksChanceDenominator = 10;
  protected static readonly dealerThanksWinningRoll = 0;
  protected static readonly dealerThanksMultiplier = 2;
  protected static readonly sideBetMultipliers = {
    aceFlashBoth: 50,
    aceFlashSingle: 10,
    dealerBust: 4,
    matchPush: 9,
  } as const;

  protected static readonly handName: Record<HandId, string> = {
    left: 'Left',
    centre: 'Centre',
    right: 'Right',
  };

  protected phase: GameSnapshot['phase'] = 'betting';
  protected bankroll: number;
  protected bets = BeatTheHouseState.emptyBets();
  protected dealerTips = BeatTheHouseState.emptyDealerTips();
  protected dealerTipRewards = BeatTheHouseState.emptyDealerTips();
  protected lastBets?: Bets | undefined;
  protected shoe: BeatTheHouseShoe;
  protected hands = BeatTheHouseState.emptyHands();
  protected dealer: DealerHand = { cards: [], holeRevealed: false, bust: false, blackAce: false };
  protected activeHand?: HandId | undefined;
  protected sideStates = BeatTheHouseState.emptySideStates();
  protected summaries: RoundSummary[] = [];
  protected status = 'Place chips on any hand, then deal.';
  protected readonly rng?: Rng | undefined;
  protected readonly randomInt: (maxExclusive: number) => number;

  public constructor(options: GameOptions = {}) {
    this.bankroll = options.initialBankroll ?? BeatTheHouseState.defaultInitialBankroll;
    this.rng = options.rng;
    this.randomInt = options.randomInt ?? secureRandomInt;
    this.shoe = options.shoe ?? createBeatTheHouseShoe(this.rng);
  }

  public snapshot(lastEvents: GameEvent[] = []): GameSnapshot {
    return {
      phase: this.phase,
      bankroll: this.bankroll,
      bets: BeatTheHouseState.cloneBets(this.bets),
      dealerTips: BeatTheHouseState.cloneDealerTips(this.dealerTips),
      dealerTipRewards: BeatTheHouseState.cloneDealerTips(this.dealerTipRewards),
      activeHand: this.activeHand,
      hands: BeatTheHouseState.cloneHands(this.hands),
      dealer: BeatTheHouseState.publicDealer(this.dealer),
      shoe: this.shoe.snapshot(),
      sideStates: BeatTheHouseState.handRecord((handId) => ({ ...(this.sideStates[handId] ?? BeatTheHouseState.emptySideState()) })),
      summaries: [...this.summaries],
      lastEvents,
      status: this.status,
      canRebet: this.canRebet(),
      rebetAmounts: this.rebetAmounts(),
    };
  }

  public saveState(): BeatTheHouseSaveState {
    const { lastEvents: _lastEvents, dealer: _dealer, shoe: _shoe, ...snapshot } = this.snapshot();
    return {
      ...snapshot,
      dealer: { ...this.dealer, cards: [...this.dealer.cards] },
      shoe: this.shoe.saveState(),
      ...(this.lastBets ? { lastBets: BeatTheHouseState.cloneBets(this.lastBets) } : {}),
    };
  }

  public restoreState(state: BeatTheHouseSaveState): GameSnapshot {
    this.phase = state.phase;
    this.setBankroll(Math.max(0, Math.floor(state.bankroll)));
    this.bets = BeatTheHouseState.cloneBets(state.bets);
    this.dealerTips = BeatTheHouseState.cloneDealerTips(state.dealerTips);
    this.dealerTipRewards = BeatTheHouseState.cloneDealerTips(state.dealerTipRewards);
    this.lastBets = state.lastBets ? BeatTheHouseState.cloneBets(state.lastBets) : undefined;
    this.shoe = BeatTheHouseShoe.fromSaveState(state.shoe);
    this.hands = BeatTheHouseState.cloneHands(state.hands);
    this.dealer = { ...state.dealer, cards: [...state.dealer.cards] };
    this.activeHand = state.activeHand;
    this.sideStates = BeatTheHouseState.handRecord((handId) => ({ ...(state.sideStates[handId] ?? BeatTheHouseState.emptySideState()) }));
    this.summaries = [...state.summaries];
    this.status = state.status;
    return this.snapshot();
  }

  protected abstract canRebet(): boolean;

  protected abstract rebetAmounts(): Record<HandId, number>;

  protected emit(events: GameEvent[], status: string): GameSnapshot {
    this.status = status;
    return this.snapshot(events);
  }

  protected draw(events: GameEvent[]): Card {
    const cutCardReachedBeforeDraw = this.shoe.snapshot().cutCardReached;
    const card = this.shoe.draw();
    if (!cutCardReachedBeforeDraw && this.shoe.snapshot().cutCardReached) {
      events.push({ type: 'shoe-cut-reached', message: 'The shoe cut card has been reached.' });
    }
    return card;
  }

  protected prepareShoeForDeal(): GameEvent[] {
    if (!this.shoe.snapshot().cutCardReached) {
      return [];
    }
    this.shoe = createBeatTheHouseShoe(this.rng);
    return [{ type: 'shoe-shuffled', message: 'A fresh six-deck shoe is ready.' }];
  }

  protected setBankroll(amount: number): void {
    this.bankroll = amount;
  }

  protected creditBankroll(amount: number): void {
    this.bankroll += amount;
  }

  protected debitBankroll(amount: number): void {
    this.bankroll -= amount;
  }

  protected static handRecord<Value>(valueFor: (handId: HandId) => Value): Record<HandId, Value> {
    return {
      left: valueFor('left'),
      centre: valueFor('centre'),
      right: valueFor('right'),
    };
  }

  protected static betRecord<Value>(valueFor: (betType: BetType) => Value): Record<BetType, Value> {
    return {
      main: valueFor('main'),
      aceFlash: valueFor('aceFlash'),
      dealerBust: valueFor('dealerBust'),
      matchPush: valueFor('matchPush'),
      dealerSevens: valueFor('dealerSevens'),
    };
  }

  protected static sideBetRecord<Value>(valueFor: (betType: SideBetType) => Value): Record<SideBetType, Value> {
    return {
      aceFlash: valueFor('aceFlash'),
      dealerBust: valueFor('dealerBust'),
      matchPush: valueFor('matchPush'),
      dealerSevens: valueFor('dealerSevens'),
    };
  }

  protected static emptyBets(): Bets {
    return BeatTheHouseState.handRecord(() => BeatTheHouseState.emptyHandBets());
  }

  protected static emptyDealerTips(): DealerTips {
    return BeatTheHouseState.handRecord(() => 0);
  }

  protected static emptyHandBets(): Bets[HandId] {
    return BeatTheHouseState.betRecord(() => 0);
  }

  protected static emptySideState(state: SideBetState = 'idle'): SideStates[HandId] {
    return BeatTheHouseState.sideBetRecord(() => state);
  }

  protected static emptySideStates(state: SideBetState = 'idle'): SideStates {
    return BeatTheHouseState.handRecord(() => BeatTheHouseState.emptySideState(state));
  }

  protected static createHand(id: HandId): PlayerHand {
    return {
      id,
      cards: [],
      done: false,
      automaticWin: false,
    };
  }

  protected static emptyHands(): Record<HandId, PlayerHand> {
    return {
      left: BeatTheHouseState.createHand('left'),
      centre: BeatTheHouseState.createHand('centre'),
      right: BeatTheHouseState.createHand('right'),
    };
  }

  protected static totalBet(bets: Bets): number {
    return handIds.reduce((total, handId) => total + betTypes.reduce((handTotal, betType) => handTotal + bets[handId][betType], 0), 0);
  }

  protected static totalDealerTips(dealerTips: DealerTips): number {
    return handIds.reduce((total, handId) => total + dealerTips[handId], 0);
  }

  protected static handStake(bets: Bets, handId: HandId): number {
    return betTypes.reduce((total, betType) => total + bets[handId][betType], 0);
  }

  protected static playableHands(bets: Bets): HandId[] {
    return handIds.filter((handId) => bets[handId].main > 0);
  }

  protected static nextPlayableHand(bets: Bets, hands: Record<HandId, PlayerHand>, after?: HandId): HandId | undefined {
    const startIndex = after ? handIds.indexOf(after) + 1 : 0;
    return handIds.slice(startIndex).find((handId) => bets[handId].main > 0 && !hands[handId].done);
  }

  protected static cloneBets(bets: Bets): Bets {
    return BeatTheHouseState.handRecord((handId) => ({ ...bets[handId] }));
  }

  protected static cloneDealerTips(dealerTips: DealerTips): DealerTips {
    return BeatTheHouseState.handRecord((handId) => Math.max(0, Math.floor(dealerTips[handId] ?? 0)));
  }

  protected static cloneHands(hands: Record<HandId, PlayerHand>): Record<HandId, PlayerHand> {
    return BeatTheHouseState.handRecord((handId) => ({ ...hands[handId], cards: [...hands[handId].cards] }));
  }

  private static publicDealer(dealer: DealerHand): PublicDealerHand {
    const { holeCard: _holeCard, ...publicDealer } = dealer;
    return { ...publicDealer, cards: [...dealer.cards] };
  }

  protected static wholeChipPayout(stake: number, multiplier: number): { readonly profit: number; readonly returned: number } {
    const wholeStake = Math.floor(stake);
    const profit = Math.floor(wholeStake * multiplier);
    return {
      profit,
      returned: wholeStake + profit,
    };
  }

  protected static formatMoneyDelta(amount: number): string {
    if (amount === 0) {
      return '£0';
    }

    return `${amount > 0 ? '+' : '-'}£${Math.abs(amount)}`;
  }
}
