import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import { z } from 'zod';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ProfileTokenHash } from '../../schemas/casinoSchemas/ProfileTokenHash';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import { hexColourSchema } from '../../schemas/casinoSchemas/hexColourSchema';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import { profileIdSchema } from '../../schemas/casinoSchemas/profileIdSchema';
import { profileTokenHashSchema } from '../../schemas/casinoSchemas/profileTokenHashSchema';
import { acceptHouseAdvance } from '../profiles/acceptHouseAdvance';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { CasinoSaveState } from '../profiles/CasinoSaveState';
import { createProfile as createProfileRecord } from '../profiles/createProfile';
import { defaultHouseAdvanceState } from '../profiles/defaultHouseAdvanceState';
import { deleteProfile } from '../profiles/deleteProfile';
import { emptySaveState } from '../profiles/emptySaveState';
import { emptyStats } from '../profiles/emptyStats';
import { houseAdvanceRepaymentForProfit } from '../profiles/houseAdvanceRepaymentForProfit';
import { parseProfileStoreJson } from '../profiles/parseProfileStoreJson';
import { recordTransaction } from '../profiles/recordTransaction';
import { reduceHouseAdvanceBalance } from '../profiles/reduceHouseAdvanceBalance';
import { renameProfile } from '../profiles/renameProfile';
import { replaceProfile } from '../profiles/replaceProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import { parseSessionState } from '../session/parseSessionState';
import type { GameplaySettlementContext } from './GameplaySettlementContext';
import type { GameplaySettlementResult } from './GameplaySettlementResult';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';
import type { ServerDataStore } from './ServerDataStore';

export class MemoryServerDataStore implements ServerDataStore {
  public readonly database: ServerDatabaseChoice = 'memory';
  private profileState: CasinoSaveState = emptySaveState();
  private session: CasinoSessionState | undefined;
  private profileTokenHashes = new Map<ProfileId, ProfileTokenHash>();

  public snapshot(): ServerDataSnapshot {
    return { database: this.database, profileState: this.profileState, session: this.session };
  }

  public createProfile(name: string, bankroll = 1000): ServerDataSnapshot {
    this.profileState = createProfileRecord(this.profileState, name, bankroll);
    return this.snapshot();
  }

  public renameProfile(profileId: ProfileId, name: string): ServerDataSnapshot {
    this.profileState = renameProfile(this.profileState, profileId, name);
    return this.snapshot();
  }

  public deleteProfile(profileId: ProfileId): ServerDataSnapshot {
    this.profileState = deleteProfile(this.profileState, profileId);
    this.deleteProfileTokenHash(profileId);
    if (this.session?.profileId === profileId) {
      this.session = undefined;
    }
    return this.snapshot();
  }

  protected loadProfilesFromJson(profileStoreJson: string): ServerDataSnapshot {
    this.profileState = parseProfileStoreJson(profileStoreJson);
    this.session = undefined;
    return this.snapshot();
  }

  public saveSession(session: CasinoSessionState): ServerDataSnapshot {
    this.session = parseSessionState(session);
    return this.snapshot();
  }

  public clear(): ServerDataSnapshot {
    this.profileState = emptySaveState();
    this.session = undefined;
    this.clearProfileTokenHashes();
    return this.snapshot();
  }

  public ensureProfile(profileId: ProfileId, profileName: string, bankroll: number): CasinoProfile {
    const existing = this.findProfile(profileId);
    if (existing) {
      return existing;
    }
    const at = createIsoTimestamp(new Date());
    const profile: CasinoProfile = {
      id: profileId,
      name: profileName.trim().replace(/\s+/g, ' ').slice(0, 32) || 'Player',
      color: hexColourSchema.parse('#7dd3fc'),
      bankroll: MemoryServerDataStore.safeMoney(bankroll),
      houseAdvance: defaultHouseAdvanceState,
      stats: emptyStats(),
      transactions: [],
      createdAt: at,
      updatedAt: at,
    };
    this.profileState = { ...this.profileState, profiles: [...this.profileState.profiles, profile] };
    return profile;
  }

  public profileTokenHash(profileId: ProfileId): ProfileTokenHash | undefined {
    return this.profileTokenHashes.get(profileId);
  }

  public setProfileTokenHash(profileId: ProfileId, tokenHash: ProfileTokenHash): void {
    this.profileTokenHashes.set(profileId, tokenHash);
  }

  public deleteProfileTokenHash(profileId: ProfileId): void {
    this.profileTokenHashes.delete(profileId);
  }

  public clearProfileTokenHashes(): void {
    this.profileTokenHashes.clear();
  }

  protected loadProfileTokenHashesFromJson(profileAuthJson: string): void {
    const parsed = z.record(profileIdSchema, profileTokenHashSchema).parse(parseJsonText(profileAuthJson));
    this.profileTokenHashes = new Map(
      Object.entries(parsed).map(([profileId, profileTokenHash]) => [profileIdSchema.parse(profileId), profileTokenHash] as const),
    );
  }

  protected profileTokenHashEntries(): readonly (readonly [ProfileId, ProfileTokenHash])[] {
    return [...this.profileTokenHashes.entries()];
  }

  public setProfileBankroll(profileId: ProfileId, bankroll: number): CasinoProfile | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const updated = { ...profile, bankroll: MemoryServerDataStore.safeMoney(bankroll), updatedAt: createIsoTimestamp(new Date()) };
    this.profileState = replaceProfile(this.profileState, updated);
    return updated;
  }

  public acceptHouseAdvance(profileId: ProfileId): CasinoProfile | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const updated = acceptHouseAdvance(profile);
    if (!updated) {
      return undefined;
    }
    this.profileState = replaceProfile(this.profileState, updated);
    return updated;
  }

  public applyGameplaySettlement(
    profileId: ProfileId,
    returned: number,
    profit: number,
    context: GameplaySettlementContext,
  ): GameplaySettlementResult | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const grossReturned = MemoryServerDataStore.safeMoney(returned);
    const repayment = Math.min(grossReturned, houseAdvanceRepaymentForProfit(profile.houseAdvance, profit));
    if (repayment <= 0) {
      const updated = { ...profile, bankroll: MemoryServerDataStore.safeMoney(profile.bankroll + grossReturned), updatedAt: createIsoTimestamp(new Date()) };
      this.profileState = replaceProfile(this.profileState, updated);
      return { profile: updated, houseAdvanceRepayment: 0 };
    }

    const outstandingBefore = profile.houseAdvance.outstandingBalance;
    const houseAdvance = reduceHouseAdvanceBalance(profile.houseAdvance, repayment);
    const updated = recordTransaction(
      {
        ...profile,
        bankroll: MemoryServerDataStore.safeMoney(profile.bankroll + grossReturned),
        houseAdvance,
      },
      {
        gameId: context.gameId,
        roomId: context.roomId,
        sessionId: context.sessionId,
        type: 'house_advance_repayment',
        amount: -repayment,
        description: `House Advance repayment withheld from ${context.gameId} net winnings.`,
        metadata: {
          grossReturned,
          netWinnings: Math.max(0, Math.floor(profit)),
          houseAdvanceRepayment: repayment,
          outstandingBefore,
          outstandingAfter: houseAdvance.outstandingBalance,
        },
      },
    );
    this.profileState = replaceProfile(this.profileState, updated);
    return { profile: updated, houseAdvanceRepayment: repayment };
  }

  public recordTransaction(
    profileId: ProfileId,
    transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  ): CasinoProfile | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const updated = recordTransaction(profile, transaction);
    this.profileState = replaceProfile(this.profileState, updated);
    return updated;
  }

  private findProfile(profileId: ProfileId): CasinoProfile | undefined {
    return this.profileState.profiles.find((profile) => profile.id === profileId);
  }

  private static safeMoney(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
}
