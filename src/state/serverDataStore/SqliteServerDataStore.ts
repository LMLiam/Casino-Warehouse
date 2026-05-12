import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import { MemoryServerDataStore } from './MemoryServerDataStore';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';

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
    return Object.fromEntries(rows.map((row) => [storedStateKey(row.key), JSON.parse(row.value)]));
  }

  private writeValue(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO server_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  }
}

const defaultSqlitePath = (): string => resolve(process.cwd(), '.casino', 'casino.sqlite');

const storedStateKey = (key: string): string => (key === 'profiles' ? 'profileState' : key === 'profile_auth' ? 'profileAuth' : key);
