import type { Card } from '../cards/Card';
import type { BlackjackSeatId } from '../../schemas/casinoSchemas/BlackjackSeatId';
import type { BlackjackTablePhase } from './BlackjackTablePhase';
import type { BlackjackTableSeatSnapshot } from './BlackjackTableSeatSnapshot';

export interface BlackjackTableSnapshot {
  readonly kind: 'blackjack-table';
  readonly phase: BlackjackTablePhase;
  readonly dealerCards: readonly Card[];
  readonly dealerHoleHidden: boolean;
  readonly activeSeatId?: BlackjackSeatId | undefined;
  readonly seats: readonly BlackjackTableSeatSnapshot[];
  readonly status: string;
}
