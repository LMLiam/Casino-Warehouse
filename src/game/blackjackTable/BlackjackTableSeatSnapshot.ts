import type { Card } from '../cards/Card';
import type { BlackjackResult } from '../blackjack/BlackjackResult';
import type { BlackjackSeatId } from '../../schemas/casinoSchemas/BlackjackSeatId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { BlackjackSeatPhase } from './BlackjackSeatPhase';

export interface BlackjackTableSeatSnapshot {
  readonly seatId: BlackjackSeatId;
  readonly profileId?: ProfileId | undefined;
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
