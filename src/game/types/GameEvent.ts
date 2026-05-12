import type { Card } from '../cards/Card';
import type { BetType } from './BetType';
import type { HandId } from './HandId';
import type { HandResult } from './HandResult';
import type { RoundSummary } from './RoundSummary';

export interface GameEvent {
  readonly type:
    | 'bet-placed'
    | 'bets-cleared'
    | 'round-started'
    | 'player-card'
    | 'dealer-hole'
    | 'dealer-card'
    | 'hand-completed'
    | 'round-settled'
    | 'message';
  readonly message?: string;
  readonly handId?: HandId;
  readonly betType?: BetType;
  readonly amount?: number;
  readonly card?: Card;
  readonly cardIndex?: number;
  readonly result?: HandResult;
  readonly summaries?: RoundSummary[];
  readonly totalProfit?: number;
}
