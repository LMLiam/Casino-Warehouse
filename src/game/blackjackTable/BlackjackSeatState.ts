import type { Card } from '../cards/Card';
import type { BlackjackResult } from '../blackjack/BlackjackResult';
import type { BlackjackSeatPhase } from './BlackjackSeatPhase';

export interface BlackjackSeatState {
  phase: BlackjackSeatPhase;
  wager: number;
  playerCards: Card[];
  insuranceWager: number;
  splitHands: Card[][];
  result?: BlackjackResult | undefined;
  returned: number;
  status: string;
  settled: boolean;
}
