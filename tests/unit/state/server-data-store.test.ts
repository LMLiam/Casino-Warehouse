import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { createDefaultServerDataStore } from '../../../src/state/serverDataStore/createDefaultServerDataStore';
import { createMemoryServerDataStore } from '../../../src/state/serverDataStore/createMemoryServerDataStore';
import type { JsonValue } from '../../../src/schemas/casinoSchemas/JsonValue';
import { SqliteServerDataStore } from '../../../src/state/serverDataStore/SqliteServerDataStore';
import { createSessionState } from '../../../src/state/session/createSessionState';
import type { CasinoProfile } from '../../../src/state/profiles/CasinoProfile';
import { testProfileId, testProfileTokenHash, testRoomId, testSessionId } from '../schemas/testIds';

const requireProfile = (profiles: readonly CasinoProfile[], index: number): CasinoProfile => {
  const profile = profiles[index];
  if (!profile) {
    throw new Error(`Missing profile at index ${index}.`);
  }
  return profile;
};

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('server data store', () => {
  it('keeps profile and session data server-owned in memory', () => {
    const store = createMemoryServerDataStore();
    const created = store.createProfile('Memory QA');
    const profile = requireProfile(created.profileState.profiles, 0);

    store.saveSession(
      createSessionState(profile.id, {
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 200,
        wagered: 50,
        gameSnapshot: undefined,
      }),
    );

    const snapshot = store.snapshot();
    expect(snapshot.database).toBe('memory');
    expect(requireProfile(snapshot.profileState.profiles, 0)).toMatchObject({ name: 'Memory QA', bankroll: 1000 });
    expect(snapshot.session).toMatchObject({ activeGame: 'blackjack', wagerLimit: 200, wagered: 50 });
  });

  it('updates memory profiles, sessions, and missing-record paths explicitly', () => {
    const store = createMemoryServerDataStore();
    const first = requireProfile(store.createProfile('Alpha').profileState.profiles, 0);
    const second = requireProfile(store.createProfile('Beta').profileState.profiles, 1);

    store.saveSession(
      createSessionState(first.id, {
        activeGame: 'slots:thai-princess',
        showingGameLobby: false,
        wagerLimit: 100,
        wagered: 25,
        gameSnapshot: undefined,
      }),
    );

    expect(store.ensureProfile(first.id, 'Ignored', 10)).toEqual(first);
    expect(store.ensureProfile(testProfileId('manual'), '   ', Number.NaN)).toMatchObject({ id: 'manual', name: 'Player', bankroll: 0 });
    expect(requireProfile(store.renameProfile(first.id, 'Renamed').profileState.profiles, 0).name).toBe('Renamed');
    expect(store.setProfileBankroll(testProfileId('missing'), 10)).toBeUndefined();
    expect(store.setProfileBankroll(first.id, Number.POSITIVE_INFINITY)?.bankroll).toBe(0);
    expect(
      store.recordTransaction(first.id, {
        gameId: 'slots:thai-princess',
        type: 'bonus',
        amount: 40,
        description: 'Memory bonus',
        metadata: {},
      })?.bankroll,
    ).toBe(40);
    expect(
      store.recordTransaction(testProfileId('missing'), {
        gameId: 'slots:thai-princess',
        type: 'bonus',
        amount: 40,
        description: 'Missing bonus',
        metadata: {},
      }),
    ).toBeUndefined();
    expect(store.deleteProfile(second.id).session?.profileId).toBe(first.id);
    expect(store.clear()).toMatchObject({ profileState: { profiles: [] }, session: undefined });
  });

  it('accepts House Advances atomically and applies repayment only to net positive gameplay settlements', () => {
    const store = createMemoryServerDataStore();
    const profile = requireProfile(store.createProfile('Advance QA', 0).profileState.profiles, 0);

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

    const push = store.applyGameplaySettlement(profile.id, 25, 0, { gameId: 'blackjack', roomId: testRoomId('ROOM1'), sessionId: testSessionId('SESSION1') });
    expect(push).toMatchObject({ houseAdvanceRepayment: 0, profile: { bankroll: 25, houseAdvance: { outstandingBalance: 300, activeCount: 3 } } });

    const win = store.applyGameplaySettlement(profile.id, 60, 50, { gameId: 'blackjack', roomId: testRoomId('ROOM1'), sessionId: testSessionId('SESSION2') });
    expect(win).toMatchObject({ houseAdvanceRepayment: 5, profile: { bankroll: 80, houseAdvance: { outstandingBalance: 295, activeCount: 3 } } });
    expect(win?.profile.transactions[0]).toMatchObject({
      type: 'house_advance_repayment',
      amount: -5,
      metadata: { grossReturned: 60, netWinnings: 50, houseAdvanceRepayment: 5, outstandingBefore: 300, outstandingAfter: 295 },
    });

    const cleared = store.applyGameplaySettlement(profile.id, 1000, 5000, { gameId: 'blackjack' });
    expect(cleared).toMatchObject({ houseAdvanceRepayment: 295, profile: { bankroll: 785, houseAdvance: { outstandingBalance: 0, activeCount: 0 } } });
  });

  it('floors decimal values in generic gameplay settlements', () => {
    const store = createMemoryServerDataStore();
    const profile = requireProfile(store.createProfile('Decimal QA', 0).profileState.profiles, 0);
    store.acceptHouseAdvance(profile.id);

    const result = store.applyGameplaySettlement(profile.id, 12.9, 19.9, { gameId: 'blackjack' });

    expect(result).toMatchObject({
      houseAdvanceRepayment: 1,
      profile: { bankroll: 111, houseAdvance: { outstandingBalance: 99 } },
    });
    expect(result?.profile.transactions[0]).toMatchObject({
      metadata: { grossReturned: 12, netWinnings: 19 },
    });
  });

  it('persists profile, ledger, and session data in SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const created = store.createProfile('SQLite QA');
    const profile = requireProfile(created.profileState.profiles, 0);

    store.recordTransaction(profile.id, {
      gameId: 'admin',
      type: 'admin_adjustment',
      amount: 125,
      description: 'SQLite persistence check',
      metadata: {},
    });
    store.saveSession(
      createSessionState(profile.id, {
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshot: undefined,
      }),
    );

    const reloaded = new SqliteServerDataStore(dbPath).snapshot();
    expect(reloaded.database).toBe('sqlite');
    expect(requireProfile(reloaded.profileState.profiles, 0)).toMatchObject({
      name: 'SQLite QA',
      bankroll: 1125,
      transactions: [expect.objectContaining({ type: 'admin_adjustment', amount: 125, description: 'SQLite persistence check' })],
    });
    expect(reloaded.session).toMatchObject({ activeGame: 'beat-the-house', profileId: profile.id });
  });

  it('persists House Advance state and repayment ledger entries in SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = requireProfile(store.createProfile('SQLite Advance', 0).profileState.profiles, 0);

    store.acceptHouseAdvance(profile.id);

    expect(requireProfile(new SqliteServerDataStore(dbPath).snapshot().profileState.profiles, 0)).toMatchObject({
      bankroll: 100,
      houseAdvance: { outstandingBalance: 100, activeCount: 1 },
      transactions: [expect.objectContaining({ type: 'house_advance_credit', amount: 100 })],
    });

    const reloaded = new SqliteServerDataStore(dbPath);
    reloaded.applyGameplaySettlement(profile.id, 50, 50, { gameId: 'blackjack', roomId: testRoomId('ROOM1'), sessionId: testSessionId('SESSION1') });

    expect(requireProfile(new SqliteServerDataStore(dbPath).snapshot().profileState.profiles, 0)).toMatchObject({
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
    const profile = requireProfile(created.profileState.profiles, 0);

    store.saveSession(
      createSessionState(profile.id, {
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 300,
        wagered: 75,
        gameSnapshot: undefined,
      }),
    );
    store.renameProfile(profile.id, 'SQLite Renamed');
    store.ensureProfile(testProfileId('manual-sqlite'), 'Manual SQLite', Number.NaN);
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
    expect(reloaded.session).toMatchObject({ activeGame: 'blackjack', profileId: profile.id });

    const clearingStore = new SqliteServerDataStore(dbPath);
    clearingStore.clear();

    expect(new SqliteServerDataStore(dbPath).snapshot()).toMatchObject({ profileState: { profiles: [] }, session: undefined });
  });

  it('gives memory and SQLite profiles zero game credits', () => {
    const memory = createMemoryServerDataStore();
    expect(requireProfile(memory.createProfile('Memory Fresh').profileState.profiles, 0).gameCredits).toEqual({ beatTheHouseHalfChip: 0 });
    expect(memory.ensureProfile(testProfileId('manual-fresh'), 'Manual Fresh', 100).gameCredits).toEqual({ beatTheHouseHalfChip: 0 });
  });

  it('preserves residual game credits in SQLite across restarts and unrelated mutations', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = requireProfile(store.createProfile('Residual QA').profileState.profiles, 0);
    seedResidualOne(dbPath, profile.id);

    const reloaded = new SqliteServerDataStore(dbPath);
    expect(reloaded.snapshot().profileState.profiles.find((candidate) => candidate.id === profile.id)).toMatchObject({
      bankroll: 1000,
      gameCredits: { beatTheHouseHalfChip: 1 },
    });

    expect(reloaded.setProfileBankroll(profile.id, 0)).toMatchObject({ bankroll: 0, gameCredits: { beatTheHouseHalfChip: 1 } });
    expect(reloaded.acceptHouseAdvance(profile.id)).toMatchObject({
      bankroll: 100,
      gameCredits: { beatTheHouseHalfChip: 1 },
      houseAdvance: { outstandingBalance: 100, activeCount: 1 },
    });
    expect(
      reloaded.recordTransaction(profile.id, {
        gameId: 'blackjack',
        type: 'payout',
        amount: 50,
        description: 'Unrelated win',
        metadata: {},
      }),
    ).toMatchObject({ bankroll: 150, gameCredits: { beatTheHouseHalfChip: 1 } });
    expect(reloaded.renameProfile(profile.id, 'Residual Renamed').profileState.profiles.find((candidate) => candidate.id === profile.id)).toMatchObject({
      name: 'Residual Renamed',
      gameCredits: { beatTheHouseHalfChip: 1 },
    });

    const settlement = reloaded.applyGameplaySettlement(profile.id, 60, 50, {
      gameId: 'blackjack',
      roomId: testRoomId('ROOM1'),
      sessionId: testSessionId('SESSION1'),
    });
    expect(settlement).toMatchObject({ houseAdvanceRepayment: 5, profile: { bankroll: 205, gameCredits: { beatTheHouseHalfChip: 1 } } });

    expect(new SqliteServerDataStore(dbPath).snapshot().profileState.profiles.find((candidate) => candidate.id === profile.id)).toMatchObject({
      name: 'Residual Renamed',
      bankroll: 205,
      gameCredits: { beatTheHouseHalfChip: 1 },
      houseAdvance: { outstandingBalance: 95, activeCount: 1 },
      transactions: expect.arrayContaining([
        expect.objectContaining({ type: 'house_advance_repayment', amount: -5 }),
        expect.objectContaining({ type: 'payout', amount: 50 }),
      ]),
    });
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
    const profile = requireProfile(store.createProfile('SQLite Survivor').profileState.profiles, 0);
    const tokenHash = testProfileTokenHash('a'.repeat(64));
    store.setProfileTokenHash(profile.id, tokenHash);
    store.saveSession(
      createSessionState(profile.id, {
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 300,
        wagered: 75,
        gameSnapshot: undefined,
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
    expect(reloaded.profileTokenHash(profile.id)).toBe(corruptKey === 'profile_auth' ? undefined : tokenHash);
    expect(reloaded.snapshot().session).toEqual(corruptKey === 'session' ? undefined : expect.objectContaining({ activeGame: 'blackjack' }));

    warn.mockRestore();
  });

  it('deletes unsupported SQLite session rows without dropping profiles or profile auth', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = requireProfile(store.createProfile('SQLite Session Break').profileState.profiles, 0);
    const tokenHash = testProfileTokenHash('a'.repeat(64));
    store.setProfileTokenHash(profile.id, tokenHash);
    writeStateValue(
      dbPath,
      'session',
      JSON.stringify({
        version: 1,
        profileIds: [profile.id],
        selectedPlayerIndex: 0,
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshots: {},
      }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const reloaded = new SqliteServerDataStore(dbPath);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('server_state row "session"'), expect.any(Error));
    expect(readStateValue(dbPath, 'session')).toBeUndefined();
    expect(reloaded.snapshot().profileState.profiles.find((candidate) => candidate.id === profile.id)).toMatchObject({ name: 'SQLite Session Break' });
    expect(reloaded.profileTokenHash(profile.id)).toBe(tokenHash);
    expect(reloaded.snapshot().session).toBeUndefined();

    warn.mockRestore();
  });

  it('deletes SQLite sessions with obsolete Beat deck data without dropping profiles or profile auth', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = requireProfile(store.createProfile('SQLite Beat Break').profileState.profiles, 0);
    const tokenHash = testProfileTokenHash('b'.repeat(64));
    store.setProfileTokenHash(profile.id, tokenHash);
    const beatTheHouse = new BeatTheHouseGame({ initialBankroll: profile.bankroll }).saveState();
    const { shoe: _shoe, ...obsoleteBeatSave } = beatTheHouse;
    writeStateValue(
      dbPath,
      'session',
      JSON.stringify({
        profileId: profile.id,
        activeGame: 'beat-the-house',
        showingGameLobby: false,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshot: { beatTheHouse: { ...obsoleteBeatSave, deck: [] } },
        updatedAt: '2026-05-04T12:00:00.000Z',
      }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const reloaded = new SqliteServerDataStore(dbPath);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('server_state row "session"'), expect.any(Error));
    expect(readStateValue(dbPath, 'session')).toBeUndefined();
    expect(reloaded.snapshot().profileState.profiles.find((candidate) => candidate.id === profile.id)).toMatchObject({ name: 'SQLite Beat Break' });
    expect(reloaded.profileTokenHash(profile.id)).toBe(tokenHash);
    expect(reloaded.snapshot().session).toBeUndefined();

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

const seedResidualOne = (dbPath: string, profileId: string): void => {
  const raw = readStateValue(dbPath, 'profiles');
  if (!raw) {
    throw new Error('Missing profiles row.');
  }
  const state = JSON.parse(raw) as { profiles: { id: string; gameCredits?: JsonValue }[] };
  const target = state.profiles.find((candidate) => candidate.id === profileId);
  if (!target) {
    throw new Error('Missing seeded profile.');
  }
  target.gameCredits = { beatTheHouseHalfChip: 1 };
  writeStateValue(dbPath, 'profiles', JSON.stringify(state));
};

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
