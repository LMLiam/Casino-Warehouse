import type { Bets } from './Bets';
import type { DealerHand } from './DealerHand';
import type { DealerTips } from './DealerTips';
import type { GameEvent } from './GameEvent';
import type { HandId } from './HandId';
import type { Phase } from './Phase';
import type { PlayerHand } from './PlayerHand';
import type { RoundSummary } from './RoundSummary';
import type { SideStates } from './SideStates';

export interface GameSnapshot {
  readonly phase: Phase;
  readonly bankroll: number;
  readonly bets: Bets;
  readonly dealerTips: DealerTips;
  readonly dealerTipRewards: DealerTips;
  readonly activeHand?: HandId;
  readonly hands: Record<HandId, PlayerHand>;
  readonly dealer: DealerHand;
  readonly sideStates: SideStates;
  readonly summaries: RoundSummary[];
  readonly lastEvents: GameEvent[];
  readonly status: string;
  readonly canRebet: boolean;
  readonly rebetAmounts: Record<HandId, number>;
}
