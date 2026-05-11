import { cardLabel, createDeck, ranks, suits, type Card } from './cards';
import type { Rng } from './rng';
import { bestTotal, isSoft, type BlackjackResult } from './blackjack';

export type BlackjackTablePhase = 'betting' | 'playing' | 'settled';
export type BlackjackSeatPhase = 'empty' | 'betting' | 'player' | 'stood' | 'settled';

export interface BlackjackTableSeatSnapshot {
  readonly seatId: string;
  readonly profileId?: string;
  readonly profileName?: string;
  readonly bankroll?: number;
  readonly phase: BlackjackSeatPhase;
  readonly wager: number;
  readonly playerCards: readonly Card[];
  readonly insuranceWager: number;
  readonly splitHands: readonly (readonly Card[])[];
  readonly result?: BlackjackResult;
  readonly returned: number;
  readonly status: string;
  readonly isTurn: boolean;
}

export interface BlackjackTableSnapshot {
  readonly kind: 'blackjack-table';
  readonly phase: BlackjackTablePhase;
  readonly dealerCards: readonly Card[];
  readonly dealerHoleHidden: boolean;
  readonly activeSeatId?: string;
  readonly seats: readonly BlackjackTableSeatSnapshot[];
  readonly status: string;
}

export interface BlackjackTableOccupant {
  readonly seatId: string;
  readonly profileId?: string;
  readonly profileName?: string;
  readonly bankroll?: number;
}

export interface BlackjackTableSettlement {
  readonly seatId: string;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
}

export interface BlackjackTableActionResult {
  readonly snapshot: BlackjackTableSnapshot;
  readonly debit: number;
  readonly settlements: readonly BlackjackTableSettlement[];
  readonly error?: string;
}

export interface BlackjackTableOptions {
  readonly rng?: Rng;
  readonly deck?: readonly Card[];
}

interface BlackjackSeatState {
  phase: BlackjackSeatPhase;
  wager: number;
  playerCards: Card[];
  insuranceWager: number;
  splitHands: Card[][];
  result?: BlackjackResult;
  returned: number;
  status: string;
  settled: boolean;
}

export class BlackjackTable {
  private deck: Card[] = [];
  private dealerCards: Card[] = [];
  private dealerHoleHidden = false;
  private activeSeatId?: string;
  private phase: BlackjackTablePhase = 'betting';
  private readonly seats = new Map<string, BlackjackSeatState>();

  private readonly rng?: Rng;
  private readonly deckOverride?: readonly Card[];

  public constructor(options: BlackjackTableOptions = {}) {
    this.rng = options.rng;
    this.deckOverride = options.deck;
  }

  public snapshot(occupants: readonly BlackjackTableOccupant[]): BlackjackTableSnapshot {
    return {
      kind: 'blackjack-table',
      phase: this.phase,
      dealerCards: [...this.dealerCards],
      dealerHoleHidden: this.dealerHoleHidden,
      activeSeatId: this.activeSeatId,
      seats: occupants.map((occupant) => {
        const seat = this.seats.get(occupant.seatId) ?? emptySeat();
        return {
          seatId: occupant.seatId,
          profileId: occupant.profileId,
          profileName: occupant.profileName,
          bankroll: occupant.bankroll,
          phase: occupant.profileId ? seat.phase : 'empty',
          wager: seat.wager,
          playerCards: [...seat.playerCards],
          insuranceWager: seat.insuranceWager,
          splitHands: seat.splitHands.map((hand) => [...hand]),
          result: seat.result,
          returned: seat.returned,
          status: occupant.profileId ? seat.status : 'Open seat.',
          isTurn: this.activeSeatId === occupant.seatId,
        };
      }),
      status: this.status(occupants),
    };
  }

  public reset(occupants: readonly BlackjackTableOccupant[]): BlackjackTableActionResult {
    this.deck = [];
    this.dealerCards = [];
    this.dealerHoleHidden = false;
    this.activeSeatId = undefined;
    this.phase = 'betting';
    this.seats.clear();
    for (const occupant of occupants) {
      if (occupant.profileId) {
        this.seats.set(occupant.seatId, emptySeat());
      }
    }
    return { snapshot: this.snapshot(occupants), debit: 0, settlements: [] };
  }

  public deal(seatId: string, wager: number, occupants: readonly BlackjackTableOccupant[]): BlackjackTableActionResult {
    if (this.phase === 'settled') {
      return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Start a new Blackjack table before dealing again.' };
    }
    if (!occupants.some((occupant) => occupant.seatId === seatId && occupant.profileId)) {
      return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Claim a Blackjack seat before dealing.' };
    }
    if (wager <= 0) {
      return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Blackjack wager is invalid.' };
    }
    const seat = this.seats.get(seatId) ?? emptySeat();
    if (seat.phase !== 'empty' && seat.phase !== 'betting') {
      return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'This Blackjack seat already has a wager.' };
    }
    if (this.dealerCards.length === 0) {
      this.deck = this.deckOverride ? [...this.deckOverride] : createDeck(this.rng);
      this.dealerCards = [this.draw(), this.draw()];
      this.dealerHoleHidden = true;
      this.phase = 'betting';
    }
    seat.phase = 'betting';
    seat.wager = Math.floor(wager);
    seat.playerCards = [this.draw(), this.draw()];
    seat.insuranceWager = 0;
    seat.splitHands = [];
    seat.result = undefined;
    seat.returned = 0;
    seat.settled = false;
    seat.status = `Wagered £${seat.wager}. Waiting for table wagers.`;
    this.seats.set(seatId, seat);

    const settlements = this.beginTurnsWhenReady(occupants);
    return { snapshot: this.snapshot(occupants), debit: seat.wager, settlements };
  }

  public act(action: 'hit' | 'stand' | 'double' | 'split' | 'insurance' | 'new-hand', seatId: string, occupants: readonly BlackjackTableOccupant[]): BlackjackTableActionResult {
    if (action === 'new-hand') {
      if (this.phase !== 'settled') {
        return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Finish the Blackjack table before starting a new hand.' };
      }
      return this.reset(occupants);
    }
    if (this.phase !== 'playing' || this.activeSeatId !== seatId) {
      return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'It is not your Blackjack turn.' };
    }
    const seat = this.seats.get(seatId);
    if (!seat || seat.phase !== 'player') {
      return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'This Blackjack seat cannot act.' };
    }

    let debit = 0;
    const settlements: BlackjackTableSettlement[] = [];
    if (action === 'hit') {
      seat.playerCards = [...seat.playerCards, this.draw()];
      if (bestTotal(seat.playerCards) > 21) {
        settlements.push(this.settleSeat(seatId, seat, 'lose', 0, `Busts with ${bestTotal(seat.playerCards)}.`));
      } else if (seat.playerCards.length >= 5) {
        seat.phase = 'stood';
        seat.status = `Stands on ${handText(seat.playerCards)}.`;
      } else {
        seat.status = `Player ${handText(seat.playerCards)}. Hit or stand.`;
      }
    } else if (action === 'stand') {
      seat.phase = 'stood';
      seat.status = `Stands on ${handText(seat.playerCards)}.`;
    } else if (action === 'double') {
      if (seat.playerCards.length !== 2) {
        return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Double is only available on the first two cards.' };
      }
      debit = seat.wager;
      seat.wager *= 2;
      seat.playerCards = [...seat.playerCards, this.draw()];
      if (bestTotal(seat.playerCards) > 21) {
        settlements.push(this.settleSeat(seatId, seat, 'lose', 0, `Double busts with ${bestTotal(seat.playerCards)}.`));
      } else {
        seat.phase = 'stood';
        seat.status = `Doubled to ${handText(seat.playerCards)}.`;
      }
    } else if (action === 'split') {
      if (seat.playerCards.length !== 2 || seat.playerCards[0]?.rank !== seat.playerCards[1]?.rank) {
        return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Split requires a matching two-card hand.' };
      }
      debit = seat.wager;
      const [first, second] = seat.playerCards;
      seat.wager *= 2;
      seat.splitHands = [
        [first, this.draw()],
        [second, this.draw()],
      ];
      seat.phase = 'stood';
      seat.status = `Split hands stand on ${seat.splitHands.map(handText).join(' and ')}.`;
    } else if (action === 'insurance') {
      if (this.dealerCards[0]?.rank !== 'A' || seat.insuranceWager > 0) {
        return { snapshot: this.snapshot(occupants), debit: 0, settlements: [], error: 'Insurance is not available.' };
      }
      debit = Math.floor(seat.wager / 2);
      seat.insuranceWager = debit;
      seat.status = `Insurance placed for £${debit}.`;
    }

    settlements.push(...this.advanceTurn(occupants));
    return { snapshot: this.snapshot(occupants), debit, settlements };
  }

  private beginTurnsWhenReady(occupants: readonly BlackjackTableOccupant[]): readonly BlackjackTableSettlement[] {
    const occupiedSeatIds = occupants.filter((occupant) => occupant.profileId).map((occupant) => occupant.seatId);
    const everyOccupiedSeatHasCards = occupiedSeatIds.length > 0 && occupiedSeatIds.every((seatId) => (this.seats.get(seatId)?.playerCards.length ?? 0) > 0);
    if (!everyOccupiedSeatHasCards) {
      return [];
    }
    this.phase = 'playing';
    const settlements: BlackjackTableSettlement[] = [];
    const dealerBlackjack = isBlackjack(this.dealerCards);
    if (dealerBlackjack) {
      this.dealerHoleHidden = false;
      for (const seatId of occupiedSeatIds) {
        const seat = this.seats.get(seatId);
        if (!seat || seat.settled) {
          continue;
        }
        const returned = isBlackjack(seat.playerCards) ? seat.wager : seat.insuranceWager * 3;
        settlements.push(
          this.settleSeat(
            seatId,
            seat,
            returned === seat.wager ? 'push' : 'lose',
            returned,
            returned > 0 ? 'Dealer Blackjack. Insurance or push returned.' : 'Dealer has Blackjack.',
          ),
        );
      }
      this.phase = 'settled';
      this.activeSeatId = undefined;
      return settlements;
    }
    for (const seatId of occupiedSeatIds) {
      const seat = this.seats.get(seatId);
      if (seat && isBlackjack(seat.playerCards)) {
        settlements.push(this.settleSeat(seatId, seat, 'blackjack', seat.wager + Math.floor(seat.wager * 1.5), 'Blackjack pays 3:2.'));
      }
    }
    settlements.push(...this.advanceTurn(occupants));
    return settlements;
  }

  private advanceTurn(occupants: readonly BlackjackTableOccupant[]): readonly BlackjackTableSettlement[] {
    const occupiedSeatIds = occupants.filter((occupant) => occupant.profileId).map((occupant) => occupant.seatId);
    const nextSeatId = occupiedSeatIds.find((seatId) => this.seats.get(seatId)?.phase === 'betting' || this.seats.get(seatId)?.phase === 'player');
    if (nextSeatId) {
      const seat = this.seats.get(nextSeatId);
      if (seat && seat.phase === 'betting') {
        seat.phase = 'player';
        seat.status = `Player ${handText(seat.playerCards)}. Hit or stand.`;
      }
      this.activeSeatId = nextSeatId;
      this.phase = 'playing';
      return [];
    }
    if (occupiedSeatIds.every((seatId) => this.seats.get(seatId)?.phase === 'settled')) {
      this.activeSeatId = undefined;
      this.phase = 'settled';
      return [];
    }
    if (this.phase !== 'playing') {
      return [];
    }
    return this.playDealerAndSettle(occupiedSeatIds);
  }

  private playDealerAndSettle(occupiedSeatIds: readonly string[]): readonly BlackjackTableSettlement[] {
    this.dealerHoleHidden = false;
    while (dealerMustHit(this.dealerCards)) {
      this.dealerCards = [...this.dealerCards, this.draw()];
    }
    const settlements: BlackjackTableSettlement[] = [];
    for (const seatId of occupiedSeatIds) {
      const seat = this.seats.get(seatId);
      if (!seat || seat.settled) {
        continue;
      }
      settlements.push(this.resolveSeatAgainstDealer(seatId, seat));
    }
    this.activeSeatId = undefined;
    this.phase = 'settled';
    return settlements;
  }

  private resolveSeatAgainstDealer(seatId: string, seat: BlackjackSeatState): BlackjackTableSettlement {
    const dealerTotal = bestTotal(this.dealerCards);
    if (seat.splitHands.length > 0) {
      const returned = seat.splitHands.reduce((sum, hand) => sum + settleHandReturn(hand, dealerTotal, seat.wager / 2), 0);
      const result: BlackjackResult = returned > seat.wager ? 'win' : returned === seat.wager ? 'push' : 'lose';
      return this.settleSeat(seatId, seat, result, Math.floor(returned), `Split hands settle against dealer ${dealerTotal}.`);
    }
    const playerTotal = bestTotal(seat.playerCards);
    if (dealerTotal > 21) {
      return this.settleSeat(seatId, seat, 'win', seat.wager * 2, `Dealer busts with ${dealerTotal}.`);
    }
    if (playerTotal > dealerTotal) {
      return this.settleSeat(seatId, seat, 'win', seat.wager * 2, `${playerTotal} beats dealer ${dealerTotal}.`);
    }
    if (playerTotal === dealerTotal) {
      return this.settleSeat(seatId, seat, 'push', seat.wager, `${playerTotal} pushes dealer ${dealerTotal}.`);
    }
    return this.settleSeat(seatId, seat, 'lose', 0, `Dealer ${dealerTotal} beats ${playerTotal}.`);
  }

  private settleSeat(seatId: string, seat: BlackjackSeatState, result: BlackjackResult, returned: number, status: string): BlackjackTableSettlement {
    seat.phase = 'settled';
    seat.result = result;
    seat.returned = Math.floor(returned);
    seat.status = status;
    seat.settled = true;
    return {
      seatId,
      wagered: seat.wager + seat.insuranceWager,
      returned: seat.returned,
      profit: seat.returned - seat.wager - seat.insuranceWager,
    };
  }

  private status(occupants: readonly BlackjackTableOccupant[]): string {
    if (this.phase === 'settled') {
      return `Dealer ${handText(this.dealerCards)}. Table settled.`;
    }
    if (this.activeSeatId) {
      const occupant = occupants.find((candidate) => candidate.seatId === this.activeSeatId);
      return `${occupant?.profileName ?? this.activeSeatId} to act.`;
    }
    const occupied = occupants.filter((occupant) => occupant.profileId).length;
    const wagered = occupants.filter((occupant) => occupant.profileId && (this.seats.get(occupant.seatId)?.playerCards.length ?? 0) > 0).length;
    return wagered > 0 ? `Waiting for Blackjack wagers: ${wagered}/${occupied}.` : 'Each occupied Blackjack seat chooses a wager and deals.';
  }

  private draw(): Card {
    const card = this.deck.pop();
    if (!card) {
      throw new Error('Blackjack table deck exhausted.');
    }
    return card;
  }
}

const emptySeat = (): BlackjackSeatState => ({
  phase: 'empty',
  wager: 0,
  playerCards: [],
  insuranceWager: 0,
  splitHands: [],
  returned: 0,
  status: 'Open seat.',
  settled: false,
});

const isBlackjack = (cards: readonly Card[]): boolean => cards.length === 2 && bestTotal(cards) === 21;

const dealerMustHit = (cards: readonly Card[]): boolean => {
  const total = bestTotal(cards);
  return total < 17 || (total === 17 && isSoft(cards));
};

const settleHandReturn = (cards: readonly Card[], dealerTotal: number, wager: number): number => {
  const total = bestTotal(cards);
  if (total > 21) {
    return 0;
  }
  if (dealerTotal > 21 || total > dealerTotal) {
    return wager * 2;
  }
  return total === dealerTotal ? wager : 0;
};

const handText = (cards: readonly Card[]): string => `${cards.map(cardLabel).join(' ')} (${bestTotal(cards)})`;

export const isBlackjackTableSnapshot = (snapshot: unknown): snapshot is BlackjackTableSnapshot =>
  typeof snapshot === 'object' && snapshot !== null && 'kind' in snapshot && (snapshot as { kind?: unknown }).kind === 'blackjack-table';

export const isCard = (card: Card): card is Card => suits.includes(card.suit) && ranks.includes(card.rank);
