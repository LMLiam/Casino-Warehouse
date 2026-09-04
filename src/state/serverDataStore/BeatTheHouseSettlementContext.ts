import type { GameplaySettlementContext } from './GameplaySettlementContext';

export interface BeatTheHouseSettlementContext extends GameplaySettlementContext {
  readonly settlementKey: string;
}
