import type { Card } from '../cards/Card';
import type { BetType } from './BetType';
import type { HandId } from './HandId';
import type { HandResult } from './HandResult';
import type { RoundSummary } from './RoundSummary';

export interface GameEvent {
  readonly type:
    | 'bet-placed'
    | 'dealer-tip-placed'
    | 'dealer-tip-taken'
    | 'bets-cleared'
    | 'round-started'
    | 'player-card'
    | 'dealer-hole'
    | 'dealer-card'
    | 'hand-completed'
    | 'round-settled'
    | 'message';
  readonly message?: string | undefined;
  readonly handId?: HandId | undefined;
  readonly betType?: BetType | undefined;
  readonly amount?: number | undefined;
  readonly card?: Card | undefined;
  readonly cardIndex?: number | undefined;
  readonly result?: HandResult | undefined;
  readonly summaries?: RoundSummary[] | undefined;
  readonly totalProfit?: number | undefined;
  readonly dealerThanksTotal?: number | undefined;
}
