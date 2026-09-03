import type { Bets } from './Bets';
import type { DealerTips } from './DealerTips';
import type { GameEvent } from './GameEvent';
import type { HandId } from './HandId';
import type { Phase } from './Phase';
import type { PlayerHand } from './PlayerHand';
import type { PublicDealerHand } from './PublicDealerHand';
import type { RoundSummary } from './RoundSummary';
import type { SideStates } from './SideStates';
import type { BeatTheHouseShoeSnapshot } from '../beatTheHouse/shoe/BeatTheHouseShoeSnapshot';

export interface GameSnapshot {
  readonly phase: Phase;
  readonly bankroll: number;
  readonly bets: Bets;
  readonly dealerTips: DealerTips;
  readonly dealerTipRewards: DealerTips;
  readonly activeHand?: HandId | undefined;
  readonly hands: Record<HandId, PlayerHand>;
  readonly dealer: PublicDealerHand;
  readonly shoe: BeatTheHouseShoeSnapshot;
  readonly sideStates: SideStates;
  readonly summaries: RoundSummary[];
  readonly lastEvents: GameEvent[];
  readonly status: string;
  readonly canRebet: boolean;
  readonly rebetAmounts: Record<HandId, number>;
}
