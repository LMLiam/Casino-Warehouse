import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ProfileTokenHash } from '../../schemas/casinoSchemas/ProfileTokenHash';
import type { HalfUnits } from '../../game/beatTheHouse/HalfUnits';
import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import type { BeatTheHouseSettlementContext } from './BeatTheHouseSettlementContext';
import type { BeatTheHouseSettlementResult } from './BeatTheHouseSettlementResult';
import type { GameplaySettlementContext } from './GameplaySettlementContext';
import type { GameplaySettlementResult } from './GameplaySettlementResult';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';

export interface ServerDataStore {
  readonly database: ServerDatabaseChoice;
  snapshot(): ServerDataSnapshot;
  createProfile(name: string, bankroll?: number): ServerDataSnapshot;
  renameProfile(profileId: ProfileId, name: string): ServerDataSnapshot;
  deleteProfile(profileId: ProfileId): ServerDataSnapshot;
  saveSession(session: CasinoSessionState): ServerDataSnapshot;
  clear(): ServerDataSnapshot;
  ensureProfile(profileId: ProfileId, profileName: string, bankroll: number): CasinoProfile;
  profileTokenHash(profileId: ProfileId): ProfileTokenHash | undefined;
  setProfileTokenHash(profileId: ProfileId, tokenHash: ProfileTokenHash): void;
  deleteProfileTokenHash(profileId: ProfileId): void;
  clearProfileTokenHashes(): void;
  setProfileBankroll(profileId: ProfileId, bankroll: number): CasinoProfile | undefined;
  acceptHouseAdvance(profileId: ProfileId): CasinoProfile | undefined;
  applyGameplaySettlement(profileId: ProfileId, returned: number, profit: number, context: GameplaySettlementContext): GameplaySettlementResult | undefined;
  applyBeatTheHouseSettlement(
    profileId: ProfileId,
    returnedHalfUnits: HalfUnits,
    profitHalfUnits: HalfUnits,
    context: BeatTheHouseSettlementContext,
  ): BeatTheHouseSettlementResult | undefined;
  recordTransaction(
    profileId: ProfileId,
    transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  ): CasinoProfile | undefined;
}
