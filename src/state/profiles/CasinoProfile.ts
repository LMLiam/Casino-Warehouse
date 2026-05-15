import type { BankrollTransaction } from './BankrollTransaction';
import type { HouseAdvanceState } from './HouseAdvanceState';
import type { ProfileStats } from './ProfileStats';

export interface CasinoProfile {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly bankroll: number;
  readonly houseAdvance: HouseAdvanceState;
  readonly stats: ProfileStats;
  readonly transactions: readonly BankrollTransaction[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
