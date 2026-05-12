import type { Card } from '../cards/Card';
import type { BlackjackPhase } from './BlackjackPhase';
import type { BlackjackResult } from './BlackjackResult';

export interface BlackjackSnapshot {
  readonly phase: BlackjackPhase;
  readonly wager: number;
  readonly playerCards: readonly Card[];
  readonly dealerCards: readonly Card[];
  readonly dealerHoleHidden: boolean;
  readonly insuranceWager: number;
  readonly splitHands: readonly (readonly Card[])[];
  readonly result?: BlackjackResult;
  readonly returned: number;
  readonly status: string;
}
