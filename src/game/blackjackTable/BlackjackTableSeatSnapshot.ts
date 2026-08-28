import type { Card } from '../cards/Card';
import type { BlackjackResult } from '../blackjack/BlackjackResult';
import type { BlackjackSeatPhase } from './BlackjackSeatPhase';

export interface BlackjackTableSeatSnapshot {
  readonly seatId: string;
  readonly profileId?: string | undefined;
  readonly profileName?: string | undefined;
  readonly bankroll?: number | undefined;
  readonly phase: BlackjackSeatPhase;
  readonly wager: number;
  readonly playerCards: readonly Card[];
  readonly insuranceWager: number;
  readonly splitHands: readonly (readonly Card[])[];
  readonly result?: BlackjackResult | undefined;
  readonly returned: number;
  readonly status: string;
  readonly isTurn: boolean;
}
