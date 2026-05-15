import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultServerDataStore } from '../../../src/state/serverDataStore/createDefaultServerDataStore';
import { createMemoryServerDataStore } from '../../../src/state/serverDataStore/createMemoryServerDataStore';
import { SqliteServerDataStore } from '../../../src/state/serverDataStore/SqliteServerDataStore';
import { createSessionState } from '../../../src/state/session/createSessionState';

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('server data store', () => {
  it('keeps profile and session data server-owned in memory', () => {
    const store = createMemoryServerDataStore();
    const created = store.createProfile('Memory QA');
    const profile = created.profileState.profiles[0];

    store.saveSession(
      createSessionState([profile.id], {
        selectedPlayerIndex: 0,
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 200,
        wagered: 50,
        gameSnapshots: {},
      }),
    );

    const snapshot = store.snapshot();
    expect(snapshot.database).toBe('memory');
    expect(snapshot.profileState.profiles[0]).toMatchObject({ name: 'Memory QA', bankroll: 1000 });
    expect(snapshot.session).toMatchObject({ activeGame: 'blackjack', wagerLimit: 200, wagered: 50 });
  });

  it('updates memory profiles, sessions, and missing-record paths explicitly', () => {
    const store = createMemoryServerDataStore();
    const first = store.createProfile('Alpha').profileState.profiles[0];
    const second = store.createProfile('Beta').profileState.profiles[1];

    store.saveSession(
      createSessionState([first.id, second.id], {
        selectedPlayerIndex: 0,
        activeGame: 'slots:thai-princess',
        showingGameLobby: false,
        wagerLimit: 100,
        wagered: 25,
        gameSnapshots: {},
      }),
    );

    expect(store.ensureProfile(first.id, 'Ignored', 10)).toEqual(first);
    expect(store.ensureProfile('manual', '   ', Number.NaN)).toMatchObject({ id: 'manual', name: 'Player', bankroll: 0 });
    expect(store.renameProfile(first.id, 'Renamed').profileState.profiles[0].name).toBe('Renamed');
    expect(store.setProfileBankroll('missing', 10)).toBeUndefined();
    expect(store.setProfileBankroll(first.id, Number.POSITIVE_INFINITY)?.bankroll).toBe(0);
    expect(
      store.recordTransaction(first.id, {
        gameId: 'slots',
        type: 'bonus',
        amount: 40,
        description: 'Memory bonus',
        metadata: {},
      })?.bankroll,
    ).toBe(40);
    expect(
      store.recordTransaction('missing', {
        gameId: 'slots',
        type: 'bonus',
        amount: 40,
        description: 'Missing bonus',
        metadata: {},
      }),
    ).toBeUndefined();
    expect(store.deleteProfile(second.id).session?.profileIds).toEqual([first.id]);
    expect(store.clear()).toMatchObject({ profileState: { profiles: [] }, session: undefined });
  });

  it('accepts House Advances atomically and applies repayment only to net positive gameplay settlements', () => {
    const store = createMemoryServerDataStore();
    const profile = store.createProfile('Advance QA', 0).profileState.profiles[0];

    expect(store.acceptHouseAdvance(profile.id)).toMatchObject({
      bankroll: 100,
      houseAdvance: { outstandingBalance: 100, activeCount: 1 },
      transactions: [expect.objectContaining({ type: 'house_advance_credit', amount: 100 })],
    });
    expect(store.acceptHouseAdvance(profile.id)).toBeUndefined();

    store.setProfileBankroll(profile.id, 0);
    expect(store.acceptHouseAdvance(profile.id)?.houseAdvance).toEqual({ outstandingBalance: 200, activeCount: 2 });
    store.setProfileBankroll(profile.id, 0);
    expect(store.acceptHouseAdvance(profile.id)?.houseAdvance).toEqual({ outstandingBalance: 300, activeCount: 3 });
    store.setProfileBankroll(profile.id, 0);
    expect(store.acceptHouseAdvance(profile.id)).toBeUndefined();

    const push = store.applyGameplaySettlement(profile.id, 25, 0, { gameId: 'blackjack', roomId: 'ROOM1', sessionId: 'SESSION1' });
    expect(push).toMatchObject({ houseAdvanceRepayment: 0, profile: { bankroll: 25, houseAdvance: { outstandingBalance: 300, activeCount: 3 } } });

    const win = store.applyGameplaySettlement(profile.id, 60, 50, { gameId: 'blackjack', roomId: 'ROOM1', sessionId: 'SESSION2' });
    expect(win).toMatchObject({ houseAdvanceRepayment: 5, profile: { bankroll: 80, houseAdvance: { outstandingBalance: 295, activeCount: 3 } } });
    expect(win?.profile.transactions[0]).toMatchObject({
      type: 'house_advance_repayment',
      amount: -5,
      metadata: { grossReturned: 60, netWinnings: 50, houseAdvanceRepayment: 5, outstandingBefore: 300, outstandingAfter: 295 },
    });

    const cleared = store.applyGameplaySettlement(profile.id, 1000, 5000, { gameId: 'blackjack' });
    expect(cleared).toMatchObject({ houseAdvanceRepayment: 295, profile: { bankroll: 785, houseAdvance: { outstandingBalance: 0, activeCount: 0 } } });
  });

  it('persists profile, ledger, and session data in SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const created = store.createProfile('SQLite QA');
    const profile = created.profileState.profiles[0];

    store.recordTransaction(profile.id, {
      gameId: 'admin',
      type: 'admin_adjustment',
      amount: 125,
      description: 'SQLite persistence check',
      metadata: {},
    });
    store.saveSession(
      createSessionState([profile.id], {
        selectedPlayerIndex: 0,
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshots: {},
      }),
    );

    const reloaded = new SqliteServerDataStore(dbPath).snapshot();
    expect(reloaded.database).toBe('sqlite');
    expect(reloaded.profileState.profiles[0]).toMatchObject({
      name: 'SQLite QA',
      bankroll: 1125,
      transactions: [expect.objectContaining({ type: 'admin_adjustment', amount: 125, description: 'SQLite persistence check' })],
    });
    expect(reloaded.session).toMatchObject({ activeGame: 'beat-the-house', profileIds: [profile.id] });
  });

  it('persists House Advance state and repayment ledger entries in SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = store.createProfile('SQLite Advance', 0).profileState.profiles[0];

    store.acceptHouseAdvance(profile.id);

    expect(new SqliteServerDataStore(dbPath).snapshot().profileState.profiles[0]).toMatchObject({
      bankroll: 100,
      houseAdvance: { outstandingBalance: 100, activeCount: 1 },
      transactions: [expect.objectContaining({ type: 'house_advance_credit', amount: 100 })],
    });

    const reloaded = new SqliteServerDataStore(dbPath);
    reloaded.applyGameplaySettlement(profile.id, 50, 50, { gameId: 'blackjack', roomId: 'ROOM1', sessionId: 'SESSION1' });

    expect(new SqliteServerDataStore(dbPath).snapshot().profileState.profiles[0]).toMatchObject({
      bankroll: 145,
      houseAdvance: { outstandingBalance: 95, activeCount: 1 },
      transactions: expect.arrayContaining([expect.objectContaining({ type: 'house_advance_repayment', amount: -5 })]),
    });
  });

  it('persists SQLite profile mutations and session removal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const created = store.createProfile('SQLite Mutations');
    const profile = created.profileState.profiles[0];

    store.saveSession(
      createSessionState([profile.id], {
        selectedPlayerIndex: 0,
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 300,
        wagered: 75,
        gameSnapshots: {},
      }),
    );
    store.renameProfile(profile.id, 'SQLite Renamed');
    store.ensureProfile('manual-sqlite', 'Manual SQLite', Number.NaN);
    store.setProfileBankroll(profile.id, 250.75);
    store.recordTransaction(profile.id, {
      gameId: 'blackjack',
      type: 'wager',
      amount: -50,
      description: 'SQLite wager',
      metadata: {},
    });

    const reloaded = new SqliteServerDataStore(dbPath).snapshot();
    expect(reloaded.profileState.profiles.find((item) => item.id === profile.id)).toMatchObject({
      name: 'SQLite Renamed',
      bankroll: 200,
    });
    expect(reloaded.profileState.profiles.find((item) => item.id === 'manual-sqlite')).toMatchObject({ bankroll: 0 });
    expect(reloaded.session).toMatchObject({ activeGame: 'blackjack', profileIds: [profile.id] });

    const clearingStore = new SqliteServerDataStore(dbPath);
    clearingStore.clear();

    expect(new SqliteServerDataStore(dbPath).snapshot()).toMatchObject({ profileState: { profiles: [] }, session: undefined });
  });

  it.each([
    ['profiles', 'profile rows'],
    ['profile_auth', 'profile auth rows'],
    ['session', 'session rows'],
  ])('recovers from corrupt SQLite %s state while preserving the other rows', async (corruptKey) => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = store.createProfile('SQLite Survivor').profileState.profiles[0];
    store.setProfileTokenHash(profile.id, 'token-hash');
    store.saveSession(
      createSessionState([profile.id], {
        selectedPlayerIndex: 0,
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 300,
        wagered: 75,
        gameSnapshots: {},
      }),
    );
    writeStateValue(dbPath, corruptKey, '{ broken json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const reloaded = new SqliteServerDataStore(dbPath);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`server_state row "${corruptKey}"`), expect.any(SyntaxError));
    expect(readStateValue(dbPath, corruptKey)).not.toBe('{ broken json');
    expect(reloaded.snapshot().profileState.profiles.find((candidate) => candidate.id === profile.id)).toEqual(
      corruptKey === 'profiles' ? undefined : expect.objectContaining({ name: 'SQLite Survivor' }),
    );
    expect(reloaded.profileTokenHash(profile.id)).toBe(corruptKey === 'profile_auth' ? undefined : 'token-hash');
    expect(reloaded.snapshot().session).toEqual(corruptKey === 'session' ? undefined : expect.objectContaining({ activeGame: 'blackjack' }));

    warn.mockRestore();
  });

  it('uses SQLite outside the test environment when an explicit path is configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousCasinoDbPath = process.env.CASINO_DB_PATH;

    process.env.NODE_ENV = 'production';
    process.env.CASINO_DB_PATH = join(dir, 'configured.sqlite');

    try {
      expect(createDefaultServerDataStore().snapshot().database).toBe('sqlite');
    } finally {
      restoreEnvValue('NODE_ENV', previousNodeEnv);
      restoreEnvValue('CASINO_DB_PATH', previousCasinoDbPath);
    }
  });

  it('uses the default SQLite path outside the test environment when no path is configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousCasinoDbPath = process.env.CASINO_DB_PATH;
    const previousCwd = process.cwd();

    process.env.NODE_ENV = 'production';
    delete process.env.CASINO_DB_PATH;
    process.chdir(dir);

    try {
      expect(createDefaultServerDataStore().snapshot().database).toBe('sqlite');
    } finally {
      process.chdir(previousCwd);
      restoreEnvValue('NODE_ENV', previousNodeEnv);
      restoreEnvValue('CASINO_DB_PATH', previousCasinoDbPath);
    }
  });
});

const restoreEnvValue = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

const writeStateValue = (dbPath: string, key: string, value: string): void => {
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare('INSERT INTO server_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  } finally {
    db.close();
  }
};

const readStateValue = (dbPath: string, key: string): string | undefined => {
  const db = new DatabaseSync(dbPath);
  try {
    return (db.prepare('SELECT value FROM server_state WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  } finally {
    db.close();
  }
};
