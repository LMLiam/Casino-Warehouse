import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asHalfUnits } from '../../../src/game/beatTheHouse/asHalfUnits';
import type { HalfUnits } from '../../../src/game/beatTheHouse/HalfUnits';
import type { BeatTheHouseSettlementContext } from '../../../src/state/serverDataStore/BeatTheHouseSettlementContext';
import type { BeatTheHouseSettlementResult } from '../../../src/state/serverDataStore/BeatTheHouseSettlementResult';
import { MemoryServerDataStore } from '../../../src/state/serverDataStore/MemoryServerDataStore';
import { SqliteServerDataStore } from '../../../src/state/serverDataStore/SqliteServerDataStore';
import { createSessionState } from '../../../src/state/session/createSessionState';
import type { CasinoProfile } from '../../../src/state/profiles/CasinoProfile';
import type { ProfileId } from '../../../src/schemas/casinoSchemas/ProfileId';
import { testProfileId, testProfileTokenHash, testRoomId, testSessionId } from '../schemas/testIds';

const receiptStateKey = 'beat_the_house_settlements';
const tempDirs: string[] = [];

const requireProfile = (store: MemoryServerDataStore | SqliteServerDataStore, profileId: string): CasinoProfile => {
  const profile = store.snapshot().profileState.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) {
    throw new Error(`Missing profile ${profileId}.`);
  }
  return profile;
};

const requireSettlement = (result: BeatTheHouseSettlementResult | undefined): BeatTheHouseSettlementResult => {
  if (!result) {
    throw new Error('Expected a settlement result.');
  }
  return result;
};

const context = (settlementKey: string, roomId = testRoomId('ROOM1'), sessionId = testSessionId('SESSION1')): BeatTheHouseSettlementContext => ({
  gameId: 'beat-the-house',
  roomId,
  sessionId,
  settlementKey,
});

const seedResidual = (store: MemoryServerDataStore | SqliteServerDataStore, profileId: ProfileId): void => {
  const result = requireSettlement(store.applyBeatTheHouseSettlement(profileId, asHalfUnits(1), asHalfUnits(-1), context('seed-residual')));
  expect(result).toMatchObject({
    returnedHalfUnits: 1,
    profitHalfUnits: -1,
    halfChipBefore: 0,
    halfChipAfter: 1,
    wholeCreditsReleased: 0,
    houseAdvanceRepayment: 0,
    alreadyApplied: false,
  });
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
    const row = db.prepare('SELECT value FROM server_state WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  } finally {
    db.close();
  }
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('exact Beat the House store settlement', () => {
  it.each([
    ['no advance, no residual', 73, false, false, 5, 3, 2, 0, 1, 75],
    ['no advance, existing residual', 73, false, true, 5, 3, 3, 0, 0, 76],
    ['even return, no residual', 73, false, false, 4, 2, 2, 0, 0, 75],
    ['even return, existing residual', 73, false, true, 4, 2, 2, 0, 1, 75],
    ['active advance, no residual', 50, true, false, 5, 3, 2, 1, 1, 51],
    ['active advance, existing residual', 50, true, true, 5, 3, 3, 1, 0, 52],
    ['push completes existing residual', 50, true, true, 2, 0, 1, 0, 1, 51],
    ['half-unit profit does not repay', 50, true, false, 5, 1, 2, 0, 1, 52],
  ])(
    'settles the approved accounting row: %s',
    async (
      _label,
      startingBankroll,
      hasAdvance,
      hasResidual,
      returnedHalfUnits,
      profitHalfUnits,
      wholeCreditsReleased,
      repayment,
      residualAfter,
      expectedBankroll,
    ) => {
      const memory = new MemoryServerDataStore();
      const directory = await mkdtemp(join(tmpdir(), 'casino-exact-settlement-'));
      tempDirs.push(directory);
      const sqlite = new SqliteServerDataStore(join(directory, 'casino.sqlite'));

      for (const store of [memory, sqlite]) {
        const profileId = requireProfile(store, store.createProfile('Exact QA', hasAdvance ? 0 : startingBankroll).profileState.profiles[0]?.id ?? '').id;
        if (hasAdvance) {
          store.acceptHouseAdvance(profileId);
          store.setProfileBankroll(profileId, startingBankroll);
        }
        if (hasResidual) {
          seedResidual(store, profileId);
        }

        const result = requireSettlement(
          store.applyBeatTheHouseSettlement(profileId, asHalfUnits(returnedHalfUnits), asHalfUnits(profitHalfUnits), context(`row-${_label}`)),
        );
        expect(result).toMatchObject({
          returnedHalfUnits,
          profitHalfUnits,
          halfChipBefore: hasResidual ? 1 : 0,
          halfChipAfter: residualAfter,
          wholeCreditsReleased,
          houseAdvanceRepayment: repayment,
          alreadyApplied: false,
          profile: {
            bankroll: expectedBankroll,
            gameCredits: { beatTheHouseHalfChip: residualAfter },
            houseAdvance: { outstandingBalance: hasAdvance ? 100 - repayment : 0 },
          },
        });
        expect((hasResidual ? 1 : 0) + returnedHalfUnits).toBe(wholeCreditsReleased * 2 + residualAfter);
        if (repayment > 0) {
          expect(result.profile.transactions[0]).toMatchObject({
            type: 'house_advance_repayment',
            amount: -repayment,
            metadata: {
              returnedHalfUnits,
              profitHalfUnits,
              halfChipBefore: hasResidual ? 1 : 0,
              halfChipAfter: residualAfter,
              wholeCreditsReleased,
              houseAdvanceRepayment: repayment,
              outstandingBefore: 100,
              outstandingAfter: 100 - repayment,
            },
          });
        }
      }
    },
  );

  it('keeps losses, pushes, and duplicate retries whole-chip safe', () => {
    const store = new MemoryServerDataStore();
    const profileId = requireProfile(store, store.createProfile('Loss QA', 50).profileState.profiles[0]?.id ?? '').id;

    const loss = requireSettlement(store.applyBeatTheHouseSettlement(profileId, asHalfUnits(0), asHalfUnits(-2), context('loss')));
    expect(loss).toMatchObject({ wholeCreditsReleased: 0, halfChipBefore: 0, halfChipAfter: 0, houseAdvanceRepayment: 0, profile: { bankroll: 50 } });

    seedResidual(store, profileId);
    const push = requireSettlement(store.applyBeatTheHouseSettlement(profileId, asHalfUnits(2), asHalfUnits(0), context('push')));
    expect(push).toMatchObject({ wholeCreditsReleased: 1, halfChipBefore: 1, halfChipAfter: 1, houseAdvanceRepayment: 0, profile: { bankroll: 51 } });
  });

  it('rejects invalid exact inputs before changing the profile', () => {
    const store = new MemoryServerDataStore();
    const profileId = requireProfile(store, store.createProfile('Validation QA', 50).profileState.profiles[0]?.id ?? '').id;
    const before = store.snapshot();

    expect(() =>
      store.applyBeatTheHouseSettlement(profileId, asHalfUnits(2), asHalfUnits(0), {
        ...context('wrong-game'),
        gameId: 'blackjack',
      } as BeatTheHouseSettlementContext),
    ).toThrow();
    expect(() => store.applyBeatTheHouseSettlement(profileId, asHalfUnits(2), asHalfUnits(0), context(''))).toThrow();
    expect(() => store.applyBeatTheHouseSettlement(profileId, -1 as HalfUnits, asHalfUnits(-3), context('negative-return'))).toThrow();
    expect(() => store.applyBeatTheHouseSettlement(profileId, 0.5 as HalfUnits, asHalfUnits(-1.5), context('fractional'))).toThrow();
    expect(() => store.applyBeatTheHouseSettlement(profileId, Number.POSITIVE_INFINITY as HalfUnits, asHalfUnits(0), context('infinite'))).toThrow();
    expect(() => store.applyBeatTheHouseSettlement(profileId, asHalfUnits(3), asHalfUnits(0), context('odd-stake'))).toThrow();
    expect(() => store.applyBeatTheHouseSettlement(profileId, asHalfUnits(0), asHalfUnits(1), context('negative-stake'))).toThrow();
    expect(store.snapshot()).toEqual(before);

    const unsafeProfileId = requireProfile(store, store.createProfile('Unsafe bankroll', Number.MAX_SAFE_INTEGER).profileState.profiles[1]?.id ?? '').id;
    const unsafeBefore = store.snapshot();
    expect(() => store.applyBeatTheHouseSettlement(unsafeProfileId, asHalfUnits(2), asHalfUnits(2), context('unsafe-bankroll'))).toThrow();
    expect(store.snapshot()).toEqual(unsafeBefore);

    seedResidual(store, profileId);
    const unsafeResidualBefore = store.snapshot();
    expect(() =>
      store.applyBeatTheHouseSettlement(profileId, asHalfUnits(Number.MAX_SAFE_INTEGER), asHalfUnits(Number.MAX_SAFE_INTEGER - 2), context('unsafe-residual')),
    ).toThrow();
    expect(store.snapshot()).toEqual(unsafeResidualBefore);
  });

  it('returns undefined only for a missing profile', () => {
    const store = new MemoryServerDataStore();

    expect(store.applyBeatTheHouseSettlement(testProfileId('missing'), asHalfUnits(0), asHalfUnits(0), context('missing'))).toBeUndefined();
  });

  it('returns a live profile for matching duplicate keys without a second mutation', () => {
    const store = new MemoryServerDataStore();
    const profileId = requireProfile(store, store.createProfile('Idempotency QA', 73).profileState.profiles[0]?.id ?? '').id;
    const first = requireSettlement(store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('duplicate')));
    const immediateBefore = store.snapshot();
    const immediateDuplicate = requireSettlement(store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('duplicate')));
    expect(immediateDuplicate).toMatchObject({ alreadyApplied: true, profile: immediateBefore.profileState.profiles[0] });
    expect(store.snapshot()).toEqual(immediateBefore);

    store.renameProfile(profileId, 'Changed after settlement');
    const beforeRetry = store.snapshot();
    const retry = requireSettlement(store.applyBeatTheHouseSettlement(profileId, first.returnedHalfUnits, first.profitHalfUnits, context('duplicate')));
    expect(retry).toMatchObject({
      alreadyApplied: true,
      returnedHalfUnits: 5,
      profitHalfUnits: 3,
      wholeCreditsReleased: 2,
      profile: { name: 'Changed after settlement', bankroll: 75, gameCredits: { beatTheHouseHalfChip: 1 } },
    });
    expect(store.snapshot()).toEqual(beforeRetry);
  });

  it('rejects key conflicts across exact values, context, profiles, and profile incarnations', () => {
    const store = new MemoryServerDataStore();
    const firstProfileId = requireProfile(store, store.createProfile('First', 73).profileState.profiles[0]?.id ?? '').id;
    const secondProfileId = requireProfile(store, store.createProfile('Second', 73).profileState.profiles[1]?.id ?? '').id;
    store.applyBeatTheHouseSettlement(firstProfileId, asHalfUnits(5), asHalfUnits(3), context('conflict'));

    const beforeValueConflict = store.snapshot();
    expect(() => store.applyBeatTheHouseSettlement(firstProfileId, asHalfUnits(4), asHalfUnits(2), context('conflict'))).toThrow();
    expect(store.snapshot()).toEqual(beforeValueConflict);

    const beforeContextConflict = store.snapshot();
    expect(() => store.applyBeatTheHouseSettlement(firstProfileId, asHalfUnits(5), asHalfUnits(3), context('conflict', testRoomId('ROOM2')))).toThrow();
    expect(store.snapshot()).toEqual(beforeContextConflict);

    const beforeProfileConflict = store.snapshot();
    expect(() => store.applyBeatTheHouseSettlement(secondProfileId, asHalfUnits(5), asHalfUnits(3), context('conflict'))).toThrow();
    expect(store.snapshot()).toEqual(beforeProfileConflict);

    store.deleteProfile(firstProfileId);
    expect(store.applyBeatTheHouseSettlement(firstProfileId, asHalfUnits(5), asHalfUnits(3), context('conflict'))).toBeUndefined();
    vi.useFakeTimers({ now: new Date('2099-01-01T00:00:00.000Z') });
    try {
      const recreated = store.ensureProfile(firstProfileId, 'Recreated', 73);
      expect(() => store.applyBeatTheHouseSettlement(recreated.id, asHalfUnits(5), asHalfUnits(3), context('conflict'))).toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears receipt tombstones with the profile store', () => {
    const store = new MemoryServerDataStore();
    const profileId = requireProfile(store, store.createProfile('Clear QA', 73).profileState.profiles[0]?.id ?? '').id;
    store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('clear-key'));
    store.deleteProfile(profileId);
    store.clear();
    const recreated = store.ensureProfile(profileId, 'Recreated', 73);

    expect(store.applyBeatTheHouseSettlement(recreated.id, asHalfUnits(5), asHalfUnits(3), context('clear-key'))).toMatchObject({ alreadyApplied: false });
  });

  it('retains exact receipts across SQLite restart and later profile mutations', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'casino-exact-restart-'));
    tempDirs.push(directory);
    const dbPath = join(directory, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profileId = requireProfile(store, store.createProfile('Restart QA', 73).profileState.profiles[0]?.id ?? '').id;
    store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('restart-key'));

    const reloaded = new SqliteServerDataStore(dbPath);
    reloaded.renameProfile(profileId, 'After restart');
    const beforeRetry = reloaded.snapshot();
    const retry = requireSettlement(reloaded.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('restart-key')));

    expect(retry).toMatchObject({ alreadyApplied: true, profile: { name: 'After restart', bankroll: 75 } });
    expect(reloaded.snapshot()).toEqual(beforeRetry);
  });

  it('caps exact House Advance repayment by the outstanding balance', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'casino-exact-cap-'));
    tempDirs.push(directory);
    const dbPath = join(directory, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profile = requireProfile(store, store.createProfile('Cap QA', 50).profileState.profiles[0]?.id ?? '');
    writeStateValue(
      dbPath,
      'profiles',
      JSON.stringify({
        profiles: [{ ...profile, houseAdvance: { outstandingBalance: 3, activeCount: 1 } }],
      }),
    );

    const reloaded = new SqliteServerDataStore(dbPath);
    const result = requireSettlement(reloaded.applyBeatTheHouseSettlement(profile.id, asHalfUnits(1000), asHalfUnits(1000), context('cap-key')));

    expect(result).toMatchObject({
      wholeCreditsReleased: 500,
      houseAdvanceRepayment: 3,
      halfChipBefore: 0,
      halfChipAfter: 0,
      profile: { bankroll: 547, houseAdvance: { outstandingBalance: 0, activeCount: 0 } },
    });
    expect(result.profile.transactions[0]).toMatchObject({
      amount: -3,
      metadata: { outstandingBefore: 3, outstandingAfter: 0, wholeCreditsReleased: 500 },
    });
  });

  it('rolls back SQLite profile and receipt writes together when the receipt write fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'casino-exact-rollback-'));
    tempDirs.push(directory);
    const dbPath = join(directory, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profileId = requireProfile(store, store.createProfile('Rollback QA', 73).profileState.profiles[0]?.id ?? '').id;
    const before = store.snapshot();
    const db = new DatabaseSync(dbPath);
    db.exec(
      `CREATE TRIGGER fail_exact_receipt_write BEFORE INSERT ON server_state
       WHEN NEW.key = '${receiptStateKey}'
       BEGIN SELECT RAISE(ABORT, 'receipt write failure'); END`,
    );
    db.close();

    expect(() => store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('rollback-key'))).toThrow('receipt write failure');
    expect(store.snapshot()).toEqual(before);
    expect(JSON.parse(readStateValue(dbPath, receiptStateKey) ?? '{}')).toEqual({});
    expect(requireProfile(new SqliteServerDataStore(dbPath), profileId)).toMatchObject({ bankroll: 73, gameCredits: { beatTheHouseHalfChip: 0 } });

    const dropTrigger = new DatabaseSync(dbPath);
    dropTrigger.exec('DROP TRIGGER fail_exact_receipt_write');
    dropTrigger.close();
    expect(store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('rollback-key'))).toMatchObject({ alreadyApplied: false });
  });

  it('fails closed when the SQLite receipt ledger is corrupt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'casino-exact-corrupt-'));
    tempDirs.push(directory);
    const dbPath = join(directory, 'casino.sqlite');
    const original = new SqliteServerDataStore(dbPath);
    const profileId = requireProfile(original, original.createProfile('Corrupt QA', 73).profileState.profiles[0]?.id ?? '').id;
    writeStateValue(dbPath, receiptStateKey, '{ broken json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const reloaded = new SqliteServerDataStore(dbPath);
    const before = reloaded.snapshot();
    expect(() => reloaded.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('corrupt-key'))).toThrow(
      'exact settlement is disabled',
    );
    expect(reloaded.snapshot()).toEqual(before);
    expect(readStateValue(dbPath, receiptStateKey)).toBe('{ broken json');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`server_state row "${receiptStateKey}"`), expect.any(SyntaxError));

    const restarted = new SqliteServerDataStore(dbPath);
    expect(() => restarted.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('corrupt-key'))).toThrow(
      'exact settlement is disabled',
    );
  });

  it('removes SQLite receipt tombstones when clearing the store', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'casino-exact-clear-'));
    tempDirs.push(directory);
    const dbPath = join(directory, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profileId = requireProfile(store, store.createProfile('Clear SQLite QA', 73).profileState.profiles[0]?.id ?? '').id;
    store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('clear-sqlite-key'));

    store.clear();

    expect(readStateValue(dbPath, receiptStateKey)).toBeUndefined();
    const recreated = store.ensureProfile(profileId, 'Recreated', 73);
    expect(store.applyBeatTheHouseSettlement(recreated.id, asHalfUnits(5), asHalfUnits(3), context('clear-sqlite-key'))).toMatchObject({
      alreadyApplied: false,
    });
  });

  it('rolls back SQLite clear state together when receipt deletion fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'casino-exact-clear-rollback-'));
    tempDirs.push(directory);
    const dbPath = join(directory, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const profileId = requireProfile(store, store.createProfile('Clear Rollback QA', 73).profileState.profiles[0]?.id ?? '').id;
    const tokenHash = testProfileTokenHash('a'.repeat(64));
    store.setProfileTokenHash(profileId, tokenHash);
    store.saveSession(createSessionState(profileId, { activeGame: 'blackjack', showingGameLobby: false }));
    store.applyBeatTheHouseSettlement(profileId, asHalfUnits(5), asHalfUnits(3), context('clear-rollback-key'));
    const before = store.snapshot();

    const db = new DatabaseSync(dbPath);
    db.exec(
      `CREATE TRIGGER fail_clear_receipt_delete BEFORE DELETE ON server_state
       WHEN OLD.key = '${receiptStateKey}'
       BEGIN SELECT RAISE(ABORT, 'receipt delete failure'); END`,
    );
    db.close();

    expect(() => store.clear()).toThrow('receipt delete failure');
    expect(store.snapshot()).toEqual(before);
    expect(readStateValue(dbPath, receiptStateKey)).toBeTruthy();
    expect(new SqliteServerDataStore(dbPath).profileTokenHash(profileId)).toBe(tokenHash);

    const dropTrigger = new DatabaseSync(dbPath);
    dropTrigger.exec('DROP TRIGGER fail_clear_receipt_delete');
    dropTrigger.close();
    expect(store.clear()).toMatchObject({ profileState: { profiles: [] }, session: undefined });
    expect(readStateValue(dbPath, receiptStateKey)).toBeUndefined();
    expect(readStateValue(dbPath, 'profile_auth')).toBe('{}');
  });
});
