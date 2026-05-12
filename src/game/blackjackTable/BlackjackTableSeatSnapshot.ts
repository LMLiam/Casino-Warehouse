import type { Card } from '../cards/Card';
import type { BlackjackResult } from '../blackjack/BlackjackResult';
import type { BlackjackSeatPhase } from './BlackjackSeatPhase';

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
