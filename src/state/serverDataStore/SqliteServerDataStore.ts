import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { HalfUnits } from '../../game/beatTheHouse/HalfUnits';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ProfileTokenHash } from '../../schemas/casinoSchemas/ProfileTokenHash';
import { beatTheHouseSettlementReceiptSchema } from '../../schemas/casinoSchemas/beatTheHouseSettlementReceiptSchema';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import { profileIdSchema } from '../../schemas/casinoSchemas/profileIdSchema';
import { profileTokenHashSchema } from '../../schemas/casinoSchemas/profileTokenHashSchema';
import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import { emptySaveState } from '../profiles/emptySaveState';
import { parseProfileStoreJson } from '../profiles/parseProfileStoreJson';
import { replaceProfile } from '../profiles/replaceProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import { parseSessionState } from '../session/parseSessionState';
import type { ParseError } from '../ParseError';
import type { BeatTheHouseSettlementContext } from './BeatTheHouseSettlementContext';
import type { BeatTheHouseSettlementReceipt } from './BeatTheHouseSettlementReceipt';
import type { BeatTheHouseSettlementResult } from './BeatTheHouseSettlementResult';
import type { GameplaySettlementContext } from './GameplaySettlementContext';
import type { GameplaySettlementResult } from './GameplaySettlementResult';
import { MemoryServerDataStore } from './MemoryServerDataStore';
import { prepareBeatTheHouseSettlement } from './prepareBeatTheHouseSettlement';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';
import { defaultSqlitePath } from './defaultSqlitePath';
import { validateBeatTheHouseSettlement } from './validateBeatTheHouseSettlement';

export class SqliteServerDataStore extends MemoryServerDataStore {
  private static readonly beatTheHouseSettlementStateKey = 'beat_the_house_settlements';
  public override readonly database: ServerDatabaseChoice = 'sqlite';
  private readonly db: DatabaseSync;
  private beatTheHouseSettlementLedgerInvalid = false;

  public constructor(path = defaultSqlitePath()) {
    super();
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('CREATE TABLE IF NOT EXISTS server_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const stored = this.readStoredState();
    if (stored.profileState) {
      this.loadProfilesFromJson(JSON.stringify(stored.profileState));
    }
    if (stored.profileAuth) {
      this.loadProfileTokenHashesFromJson(JSON.stringify(stored.profileAuth));
    }
    if (stored.beatTheHouseSettlementReceipts) {
      this.loadBeatTheHouseSettlementReceipts(stored.beatTheHouseSettlementReceipts);
    }
    if (stored.session) {
      this.saveSession(stored.session);
    }
  }

  public override createProfile(name: string, bankroll?: number): ServerDataSnapshot {
    return this.persist(super.createProfile(name, bankroll));
  }

  public override renameProfile(profileId: ProfileId, name: string): ServerDataSnapshot {
    return this.persist(super.renameProfile(profileId, name));
  }

  public override deleteProfile(profileId: ProfileId): ServerDataSnapshot {
    const snapshot = super.deleteProfile(profileId);
    this.persistProfileAuth();
    return this.persist(snapshot);
  }

  public override saveSession(session: CasinoSessionState): ServerDataSnapshot {
    return this.persist(super.saveSession(session));
  }

  public override clear(): ServerDataSnapshot {
    this.withTransaction(() => {
      this.writeValue('profiles', emptySaveState());
      this.db.prepare('DELETE FROM server_state WHERE key = ?').run('session');
      this.db.prepare('DELETE FROM server_state WHERE key = ?').run(SqliteServerDataStore.beatTheHouseSettlementStateKey);
      this.writeValue('profile_auth', {});
    });
    const snapshot = super.clear();
    this.beatTheHouseSettlementLedgerInvalid = false;
    return snapshot;
  }

  public override setProfileTokenHash(profileId: ProfileId, tokenHash: ProfileTokenHash): void {
    super.setProfileTokenHash(profileId, tokenHash);
    this.persistProfileAuth();
  }

  public override deleteProfileTokenHash(profileId: ProfileId): void {
    super.deleteProfileTokenHash(profileId);
    this.persistProfileAuth();
  }

  public override clearProfileTokenHashes(): void {
    super.clearProfileTokenHashes();
    this.persistProfileAuth();
  }

  public override ensureProfile(profileId: ProfileId, profileName: string, bankroll: number): CasinoProfile {
    const profile = super.ensureProfile(profileId, profileName, bankroll);
    this.persist(this.snapshot());
    return profile;
  }

  public override setProfileBankroll(profileId: ProfileId, bankroll: number): CasinoProfile | undefined {
    const profile = super.setProfileBankroll(profileId, bankroll);
    this.persist(this.snapshot());
    return profile;
  }

  public override acceptHouseAdvance(profileId: ProfileId): CasinoProfile | undefined {
    const profile = super.acceptHouseAdvance(profileId);
    this.persist(this.snapshot());
    return profile;
  }

  public override applyGameplaySettlement(
    profileId: ProfileId,
    returned: number,
    profit: number,
    context: GameplaySettlementContext,
  ): GameplaySettlementResult | undefined {
    const result = super.applyGameplaySettlement(profileId, returned, profit, context);
    this.persist(this.snapshot());
    return result;
  }

  public override applyBeatTheHouseSettlement(
    profileId: ProfileId,
    returnedHalfUnits: HalfUnits,
    profitHalfUnits: HalfUnits,
    context: BeatTheHouseSettlementContext,
  ): BeatTheHouseSettlementResult | undefined {
    if (this.beatTheHouseSettlementLedgerInvalid) {
      throw new Error('Beat the House settlement receipts are invalid; exact settlement is disabled.');
    }
    validateBeatTheHouseSettlement(returnedHalfUnits, profitHalfUnits, context);
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }

    const existingReceipt = this.beatTheHouseSettlementReceipt(context.settlementKey);
    if (existingReceipt) {
      this.assertMatchingBeatTheHouseSettlementReceipt(profile, returnedHalfUnits, profitHalfUnits, context, existingReceipt);
      return this.beatTheHouseSettlementResult(profile, existingReceipt, true);
    }

    const transition = prepareBeatTheHouseSettlement(profile, returnedHalfUnits, profitHalfUnits, context);
    const nextProfileState = replaceProfile(this.snapshot().profileState, transition.profile);
    const nextReceipts = {
      ...Object.fromEntries(this.beatTheHouseSettlementReceiptEntries()),
      [transition.receipt.settlementKey]: transition.receipt,
    };
    this.persistExactBeatTheHouseSettlement(nextProfileState, nextReceipts);
    this.commitBeatTheHouseSettlement(transition);
    return this.beatTheHouseSettlementResult(transition.profile, transition.receipt, false);
  }

  public override recordTransaction(
    profileId: ProfileId,
    transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  ): CasinoProfile | undefined {
    const profile = super.recordTransaction(profileId, transaction);
    this.persist(this.snapshot());
    return profile;
  }

  private persist(snapshot: ServerDataSnapshot): ServerDataSnapshot {
    this.withTransaction(() => {
      this.writeValue('profiles', snapshot.profileState);
      if (snapshot.session) {
        this.writeValue('session', snapshot.session);
      } else {
        this.db.prepare('DELETE FROM server_state WHERE key = ?').run('session');
      }
      if (!this.beatTheHouseSettlementLedgerInvalid) {
        this.writeValue(SqliteServerDataStore.beatTheHouseSettlementStateKey, Object.fromEntries(this.beatTheHouseSettlementReceiptEntries()));
      }
    });
    return snapshot;
  }

  private persistExactBeatTheHouseSettlement(
    profileState: ServerDataSnapshot['profileState'],
    receipts: Readonly<Record<string, BeatTheHouseSettlementReceipt>>,
  ): void {
    this.withTransaction(() => {
      this.writeValue('profiles', profileState);
      this.writeValue(SqliteServerDataStore.beatTheHouseSettlementStateKey, receipts);
    });
  }

  private persistProfileAuth(): void {
    this.writeValue('profile_auth', Object.fromEntries(this.profileTokenHashEntries()));
  }

  private readStoredState(): Partial<
    Pick<ServerDataSnapshot, 'profileState' | 'session'> & {
      readonly profileAuth: Record<string, string>;
      readonly beatTheHouseSettlementReceipts: Readonly<Record<string, BeatTheHouseSettlementReceipt>>;
    }
  > {
    const rows = z.array(z.object({ key: z.string(), value: z.string() }).strict()).parse(this.db.prepare('SELECT key, value FROM server_state').all());
    const stored: {
      profileState?: ServerDataSnapshot['profileState'];
      profileAuth?: Record<string, string>;
      beatTheHouseSettlementReceipts?: Readonly<Record<string, BeatTheHouseSettlementReceipt>>;
      session?: ServerDataSnapshot['session'];
    } = {};
    for (const row of rows) {
      const parseError = this.assignStoredStateValue(stored, row.key, row.value);
      if (parseError) {
        const isSettlementReceipt = SqliteServerDataStore.storedStateKey(row.key) === SqliteServerDataStore.beatTheHouseSettlementStateKey;
        if (isSettlementReceipt) {
          this.beatTheHouseSettlementLedgerInvalid = true;
        } else {
          this.db.prepare('DELETE FROM server_state WHERE key = ?').run(row.key);
        }
        console.warn(`SQLite server_state row "${row.key}" could not be parsed and ${isSettlementReceipt ? 'was retained.' : 'was deleted.'}`, parseError);
      }
    }
    return stored;
  }

  private assignStoredStateValue(
    stored: {
      profileState?: ServerDataSnapshot['profileState'];
      profileAuth?: Record<string, string>;
      beatTheHouseSettlementReceipts?: Readonly<Record<string, BeatTheHouseSettlementReceipt>>;
      session?: ServerDataSnapshot['session'];
    },
    key: string,
    value: string,
  ): ParseError | undefined {
    const storedKey = SqliteServerDataStore.storedStateKey(key);
    if (storedKey === 'profileState') {
      const parsed = parseProfileStoreJson(value);
      if (!parsed.ok) {
        return parsed.error;
      }
      stored.profileState = parsed.value;
      return undefined;
    }
    if (storedKey === 'profileAuth') {
      try {
        const parsed = z.record(profileIdSchema, profileTokenHashSchema).safeParse(parseJsonText(value));
        if (!parsed.success) {
          return new Error(parsed.error.message);
        }
        stored.profileAuth = parsed.data;
        return undefined;
      } catch (error) {
        return error instanceof Error ? error : new Error('Profile authentication data is invalid.');
      }
    }
    if (storedKey === SqliteServerDataStore.beatTheHouseSettlementStateKey) {
      try {
        const parsed = z.record(z.string(), beatTheHouseSettlementReceiptSchema).safeParse(parseJsonText(value));
        if (!parsed.success) {
          return new Error(parsed.error.message);
        }
        for (const [receiptKey, receipt] of Object.entries(parsed.data)) {
          if (receiptKey !== receipt.settlementKey) {
            return new Error('Beat the House settlement receipt key does not match its stored key.');
          }
        }
        stored.beatTheHouseSettlementReceipts = parsed.data;
        return undefined;
      } catch (error) {
        return error instanceof Error ? error : new Error('Beat the House settlement receipts are invalid.');
      }
    }
    if (storedKey === 'session') {
      try {
        const parsed = parseSessionState(parseJsonText(value));
        if (!parsed.ok) {
          return parsed.error;
        }
        stored.session = parsed.value;
        return undefined;
      } catch (error) {
        return error instanceof Error ? error : new Error('Session data is invalid.');
      }
    }
    return undefined;
  }

  private writeValue<Value>(key: string, value: Value): void {
    this.db
      .prepare('INSERT INTO server_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  }

  private withTransaction(operation: () => void): void {
    this.db.exec('BEGIN');
    try {
      operation();
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Preserve the original persistence error.
      }
      throw error;
    }
  }

  private static storedStateKey(key: string): string {
    return key === 'profiles' ? 'profileState' : key === 'profile_auth' ? 'profileAuth' : key;
  }
}
