import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createProfile as createProfileRecord,
  deleteProfile,
  emptySaveState,
  emptyStats,
  parseProfileStoreJson,
  recordTransaction,
  renameProfile,
  replaceProfile,
  type BankrollTransaction,
  type CasinoProfile,
  type CasinoSaveState,
} from './profiles';
import { createSessionState, parseSessionState, type CasinoSessionState } from './session';

export type ServerDatabaseChoice = 'sqlite' | 'memory';

export interface ServerDataSnapshot {
  readonly database: ServerDatabaseChoice;
  readonly profileState: CasinoSaveState;
  readonly session?: CasinoSessionState;
}

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

class MemoryServerDataStore implements ServerDataStore {
  public readonly database: ServerDatabaseChoice = 'memory';
  private profileState: CasinoSaveState = emptySaveState();
  private session: CasinoSessionState | undefined;

  public snapshot(): ServerDataSnapshot {
    return { database: this.database, profileState: this.profileState, session: this.session };
  }

  public createProfile(name: string, bankroll = 1000): ServerDataSnapshot {
    this.profileState = createProfileRecord(this.profileState, name, bankroll);
    return this.snapshot();
  }

  public renameProfile(profileId: string, name: string): ServerDataSnapshot {
    this.profileState = renameProfile(this.profileState, profileId, name);
    return this.snapshot();
  }

  public deleteProfile(profileId: string): ServerDataSnapshot {
    this.profileState = deleteProfile(this.profileState, profileId);
    this.session = this.session
      ? createSessionState(
          this.session.profileIds.filter((id) => id !== profileId),
          this.session,
        )
      : undefined;
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
    return this.snapshot();
  }

  public ensureProfile(profileId: string, profileName: string, bankroll: number): CasinoProfile {
    const existing = this.findProfile(profileId);
    if (existing) {
      return existing;
    }
    const at = new Date().toISOString();
    const profile: CasinoProfile = {
      id: profileId,
      name: profileName.trim().replace(/\s+/g, ' ').slice(0, 32) || 'Player',
      color: '#7dd3fc',
      bankroll: safeMoney(bankroll),
      stats: emptyStats(),
      transactions: [],
      createdAt: at,
      updatedAt: at,
    };
    this.profileState = { ...this.profileState, profiles: [...this.profileState.profiles, profile] };
    return profile;
  }

  public setProfileBankroll(profileId: string, bankroll: number): CasinoProfile | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const updated = { ...profile, bankroll: safeMoney(bankroll), updatedAt: new Date().toISOString() };
    this.profileState = replaceProfile(this.profileState, updated);
    return updated;
  }

  public recordTransaction(
    profileId: string,
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

  private findProfile(profileId: string): CasinoProfile | undefined {
    return this.profileState.profiles.find((profile) => profile.id === profileId);
  }
}

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
    return this.persist(super.deleteProfile(profileId));
  }

  public override saveSession(session: CasinoSessionState): ServerDataSnapshot {
    return this.persist(super.saveSession(session));
  }

  public override clear(): ServerDataSnapshot {
    return this.persist(super.clear());
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

  private readStoredState(): Partial<Pick<ServerDataSnapshot, 'profileState' | 'session'>> {
    const rows = this.db.prepare('SELECT key, value FROM server_state').all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map((row) => [row.key === 'profiles' ? 'profileState' : row.key, JSON.parse(row.value)]));
  }

  private writeValue(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO server_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  }
}

export const createMemoryServerDataStore = (): ServerDataStore => new MemoryServerDataStore();

export const createDefaultServerDataStore = (): ServerDataStore => {
  if (process.env.NODE_ENV === 'test') {
    return createMemoryServerDataStore();
  }
  return new SqliteServerDataStore(process.env.CASINO_DB_PATH || defaultSqlitePath());
};

const defaultSqlitePath = (): string => resolve(process.cwd(), '.casino', 'casino.sqlite');
const safeMoney = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
