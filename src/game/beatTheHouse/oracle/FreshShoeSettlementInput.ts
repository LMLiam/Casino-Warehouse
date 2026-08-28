import type { FreshShoeDealerOutcome } from './FreshShoeDealerOutcome';
import type { FreshShoeMainMode } from './FreshShoeMainMode';
import type { FreshShoeOracleContext } from './FreshShoeOracleContext';

export type FreshShoeSettlementInput = {
  readonly context: FreshShoeOracleContext;
  readonly playerFirstKind: number;
  readonly playerFinalKind?: number;
  readonly mainMode: FreshShoeMainMode;
  readonly dealer: FreshShoeDealerOutcome;
};
