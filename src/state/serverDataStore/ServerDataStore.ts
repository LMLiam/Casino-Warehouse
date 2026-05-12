import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';

export interface ServerDataStore {
  readonly database: ServerDatabaseChoice;
  snapshot(): ServerDataSnapshot;
  createProfile(name: string, bankroll?: number): ServerDataSnapshot;
  renameProfile(profileId: string, name: string): ServerDataSnapshot;
  deleteProfile(profileId: string): ServerDataSnapshot;
  saveSession(session: CasinoSessionState): ServerDataSnapshot;
  clear(): ServerDataSnapshot;
  ensureProfile(profileId: string, profileName: string, bankroll: number): CasinoProfile;
  setProfileBankroll(profileId: string, bankroll: number): CasinoProfile | undefined;
  recordTransaction(
    profileId: string,
    transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  ): CasinoProfile | undefined;
}
