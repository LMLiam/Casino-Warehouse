import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import { MemoryServerDataStore } from './MemoryServerDataStore';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';
import { defaultSqlitePath } from './defaultSqlitePath';

export class SqliteServerDataStore extends MemoryServerDataStore {
  public override readonly database: ServerDatabaseChoice = 'sqlite';
  private readonly db: DatabaseSync;

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
    if (stored.session) {
      this.saveSession(stored.session);
    }
  }

  public override createProfile(name: string, bankroll?: number): ServerDataSnapshot {
    return this.persist(super.createProfile(name, bankroll));
  }

  public override renameProfile(profileId: string, name: string): ServerDataSnapshot {
    return this.persist(super.renameProfile(profileId, name));
  }

  public override deleteProfile(profileId: string): ServerDataSnapshot {
    const snapshot = super.deleteProfile(profileId);
    this.persistProfileAuth();
    return this.persist(snapshot);
  }

  public override saveSession(session: CasinoSessionState): ServerDataSnapshot {
    return this.persist(super.saveSession(session));
  }

  public override clear(): ServerDataSnapshot {
    const snapshot = super.clear();
    this.persistProfileAuth();
    return this.persist(snapshot);
  }

  public override setProfileTokenHash(profileId: string, tokenHash: string): void {
    super.setProfileTokenHash(profileId, tokenHash);
    this.persistProfileAuth();
  }

  public override deleteProfileTokenHash(profileId: string): void {
    super.deleteProfileTokenHash(profileId);
    this.persistProfileAuth();
  }

  public override clearProfileTokenHashes(): void {
    super.clearProfileTokenHashes();
    this.persistProfileAuth();
  }

  public override ensureProfile(profileId: string, profileName: string, bankroll: number): CasinoProfile {
    const profile = super.ensureProfile(profileId, profileName, bankroll);
    this.persist(this.snapshot());
    return profile;
  }

  public override setProfileBankroll(profileId: string, bankroll: number): CasinoProfile | undefined {
    const profile = super.setProfileBankroll(profileId, bankroll);
    this.persist(this.snapshot());
    return profile;
  }

  public override acceptHouseAdvance(profileId: string): CasinoProfile | undefined {
    const profile = super.acceptHouseAdvance(profileId);
    this.persist(this.snapshot());
    return profile;
  }

  public override applyGameplaySettlement(
    profileId: string,
    returned: number,
    profit: number,
    context: {
      readonly gameId: string;
      readonly roomId?: string;
      readonly sessionId?: string;
    },
  ): { readonly profile: CasinoProfile; readonly houseAdvanceRepayment: number } | undefined {
    const result = super.applyGameplaySettlement(profileId, returned, profit, context);
    this.persist(this.snapshot());
    return result;
  }

  public override recordTransaction(
    profileId: string,
    transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  ): CasinoProfile | undefined {
    const profile = super.recordTransaction(profileId, transaction);
    this.persist(this.snapshot());
    return profile;
  }

  private persist(snapshot: ServerDataSnapshot): ServerDataSnapshot {
    this.writeValue('profiles', snapshot.profileState);
    if (snapshot.session) {
      this.writeValue('session', snapshot.session);
    } else {
      this.db.prepare('DELETE FROM server_state WHERE key = ?').run('session');
    }
    return snapshot;
  }

  private persistProfileAuth(): void {
    this.writeValue('profile_auth', Object.fromEntries(this.profileTokenHashEntries()));
  }

  private readStoredState(): Partial<Pick<ServerDataSnapshot, 'profileState' | 'session'> & { readonly profileAuth: Record<string, string> }> {
    const rows = this.db.prepare('SELECT key, value FROM server_state').all() as Array<{ key: string; value: string }>;
    const stored: { profileState?: ServerDataSnapshot['profileState']; profileAuth?: Record<string, string>; session?: ServerDataSnapshot['session'] } = {};
    for (const row of rows) {
      try {
        this.assignStoredStateValue(stored, row.key, JSON.parse(row.value));
      } catch (error) {
        this.db.prepare('DELETE FROM server_state WHERE key = ?').run(row.key);
        console.warn(`SQLite server_state row "${row.key}" could not be parsed and was deleted.`, error);
      }
    }
    return stored;
  }

  private assignStoredStateValue(
    stored: { profileState?: ServerDataSnapshot['profileState']; profileAuth?: Record<string, string>; session?: ServerDataSnapshot['session'] },
    key: string,
    value: unknown,
  ): void {
    const storedKey = SqliteServerDataStore.storedStateKey(key);
    if (storedKey === 'profileState') {
      stored.profileState = value as ServerDataSnapshot['profileState'];
      return;
    }
    if (storedKey === 'profileAuth') {
      stored.profileAuth = value as Record<string, string>;
      return;
    }
    if (storedKey === 'session') {
      stored.session = value as ServerDataSnapshot['session'];
    }
  }

  private writeValue(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO server_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  }

  private static storedStateKey(key: string): string {
    return key === 'profiles' ? 'profileState' : key === 'profile_auth' ? 'profileAuth' : key;
  }
}
