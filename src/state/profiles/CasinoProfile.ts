import type { IsoTimestamp } from '../../schemas/casinoSchemas/IsoTimestamp';
import type { BankrollTransaction } from './BankrollTransaction';
import type { GameCredits } from './GameCredits';
import type { HouseAdvanceState } from './HouseAdvanceState';
import type { ProfileStats } from './ProfileStats';
import type { HexColour } from '../../schemas/casinoSchemas/HexColour';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';

export interface CasinoProfile {
  readonly id: ProfileId;
  readonly name: string;
  readonly color: HexColour;
  readonly bankroll: number;
  readonly gameCredits: GameCredits;
  readonly houseAdvance: HouseAdvanceState;
  readonly stats: ProfileStats;
  readonly transactions: readonly BankrollTransaction[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
