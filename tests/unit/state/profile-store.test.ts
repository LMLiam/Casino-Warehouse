import { describe, expect, it, vi } from 'vitest';
import { createProfile } from '../../../src/state/profiles/createProfile';
import { deleteProfile } from '../../../src/state/profiles/deleteProfile';
import { houseAdvanceRepaymentForProfit } from '../../../src/state/profiles/houseAdvanceRepaymentForProfit';
import { loadProfileStore } from '../../../src/state/profiles/loadProfileStore';
import { parseCasinoSaveState } from '../../../src/state/profiles/parseCasinoSaveState';
import { parseCasinoProfile } from '../../../src/state/profiles/parseCasinoProfile';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import { recordTransaction } from '../../../src/state/profiles/recordTransaction';
import { renameProfile } from '../../../src/state/profiles/renameProfile';
import { replaceProfile } from '../../../src/state/profiles/replaceProfile';
import { saveProfileStore } from '../../../src/state/profiles/saveProfileStore';
import type { StorageLike } from '../../../src/state/profiles/StorageLike';
import { createStateId } from '../../../src/state/profiles/createStateId';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('profile store', () => {
  it('creates, saves, and reloads persistent profiles', () => {
    const storage = new MemoryStorage();
    expect(loadProfileStore(storage)).toMatchObject({ recovered: false, state: { profiles: [] } });
    const state = createProfile({ version: 1, profiles: [] }, 'Liam', 1500, new Date('2026-05-04T12:00:00Z'));

    saveProfileStore(storage, state);
    const loaded = loadProfileStore(storage);

    expect(loaded.recovered).toBe(false);
    expect(loaded.state.profiles).toHaveLength(1);
    expect(loaded.state.profiles[0].name).toBe('Liam');
    expect(loaded.state.profiles[0].bankroll).toBe(1500);
    expect(loaded.state.profiles[0].houseAdvance).toEqual({ outstandingBalance: 0, activeCount: 0 });
  });

  it('renames and deletes profiles without touching other records', () => {
    let state = createProfile({ version: 1, profiles: [] }, 'One', 100, new Date('2026-05-04T12:00:00Z'));
    state = createProfile(state, 'Two', 200, new Date('2026-05-04T12:01:00Z'));
    const secondId = state.profiles[1].id;

    state = renameProfile(state, secondId, 'VIP Two', new Date('2026-05-04T12:02:00Z'));
    state = deleteProfile(state, state.profiles[0].id);

    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0].name).toBe('VIP Two');
    expect(state.profiles[0].bankroll).toBe(200);
  });

  it('records bankroll transaction history and stats', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'Stats', 1000, new Date('2026-05-04T12:00:00Z'));
    let profile = state.profiles[0];

    profile = recordTransaction(
      profile,
      { gameId: 'blackjack', type: 'wager', amount: -25, description: 'Blackjack wager', metadata: { handId: 'main' } },
      new Date('2026-05-04T12:01:00Z'),
    );
    profile = recordTransaction(
      profile,
      { gameId: 'blackjack', type: 'payout', amount: 50, description: 'Blackjack win', metadata: { handId: 'main' } },
      new Date('2026-05-04T12:02:00Z'),
    );

    expect(profile.bankroll).toBe(1025);
    expect(profile.stats.totalWagered).toBe(25);
    expect(profile.stats.totalWon).toBe(50);
    expect(profile.stats.netProfit).toBe(25);
    expect(profile.stats.biggestWin).toBe(50);
    expect(profile.stats.biggestWager).toBe(25);
    expect(profile.stats.gamesPlayed).toBe(1);
    expect(profile.stats.perGame.blackjack).toMatchObject({ gamesPlayed: 1, wagered: 25, won: 50, netProfit: 25 });
    expect(profile.transactions.map((tx) => tx.balanceAfter)).toEqual([1025, 975]);
    expect(profile.transactions[0]).toMatchObject({ profileId: profile.id, balanceBefore: 975, description: 'Blackjack win' });
  });

  it('keeps House Advance credits and repayments out of gameplay stats', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'Advance Stats', 0, new Date('2026-05-04T12:00:00Z'));
    let profile = state.profiles[0];

    profile = recordTransaction(
      { ...profile, houseAdvance: { outstandingBalance: 100, activeCount: 1 } },
      { gameId: 'house-advance', type: 'house_advance_credit', amount: 100, description: 'House Advance accepted.', metadata: { outstandingBalance: 100 } },
      new Date('2026-05-04T12:01:00Z'),
    );
    profile = recordTransaction(
      { ...profile, houseAdvance: { outstandingBalance: 95, activeCount: 1 } },
      {
        gameId: 'blackjack',
        type: 'house_advance_repayment',
        amount: -5,
        description: 'House Advance repayment.',
        metadata: { houseAdvanceRepayment: 5, outstandingAfter: 95 },
      },
      new Date('2026-05-04T12:02:00Z'),
    );

    expect(profile.bankroll).toBe(95);
    expect(profile.stats).toMatchObject({
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
      biggestWin: 0,
      biggestWager: 0,
      gamesPlayed: 0,
      perGame: {},
    });
    expect(profile.transactions.map((transaction) => transaction.type)).toEqual(['house_advance_repayment', 'house_advance_credit']);
  });

  it('computes House Advance repayments from net positive winnings only', () => {
    const state = { outstandingBalance: 100, activeCount: 1 };

    expect(houseAdvanceRepaymentForProfit(state, 0)).toBe(0);
    expect(houseAdvanceRepaymentForProfit(state, -25)).toBe(0);
    expect(houseAdvanceRepaymentForProfit(state, 5)).toBe(1);
    expect(houseAdvanceRepaymentForProfit(state, 50)).toBe(5);
    expect(houseAdvanceRepaymentForProfit({ outstandingBalance: 3, activeCount: 1 }, 100)).toBe(3);
  });

  it('creates secure state ids without Math.random', () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random should not be used for state ids.');
    });
    const randomUUID = vi
      .fn<() => `${string}-${string}-${string}-${string}-${string}`>()
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID } });

    try {
      const now = new Date('2026-05-04T12:00:00Z');
      const state = createProfile(createProfile({ version: 1, profiles: [] }, 'One', 100, now), 'Two', 200, now);
      const firstProfile = state.profiles[0];
      const secondProfile = state.profiles[1];
      const updated = recordTransaction(
        recordTransaction(firstProfile, { gameId: 'slots', type: 'wager', amount: -10, description: 'Spin', metadata: {} }, now),
        { gameId: 'slots', type: 'payout', amount: 20, description: 'Win', metadata: {} },
        now,
      );

      expect(firstProfile.id).toMatch(/^profile-[a-z0-9]+-00000000-0000-4000-8000-000000000001$/);
      expect(secondProfile.id).toMatch(/^profile-[a-z0-9]+-00000000-0000-4000-8000-000000000002$/);
      expect(firstProfile.id).not.toBe(secondProfile.id);
      expect(updated.transactions.map((transaction) => transaction.id)).toEqual([
        expect.stringMatching(/^tx-[a-z0-9]+-00000000-0000-4000-8000-000000000004$/),
        expect.stringMatching(/^tx-[a-z0-9]+-00000000-0000-4000-8000-000000000003$/),
      ]);
      expect(randomUUID).toHaveBeenCalledTimes(4);
      expect(mathRandom).not.toHaveBeenCalled();
    } finally {
      mathRandom.mockRestore();
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
      }
    }
  });

  it('keeps deterministic id generator seams for state unit tests', () => {
    const profileNow = new Date('2026-05-04T12:00:00Z');
    const transactionNow = new Date('2026-05-04T12:01:00Z');
    const idGenerator = vi.fn((prefix: string, now: Date) => `${prefix}-${now.toISOString()}`);
    const state = createProfile({ version: 1, profiles: [] }, 'Deterministic', 1000, profileNow, idGenerator);
    const profile = recordTransaction(
      state.profiles[0],
      { gameId: 'blackjack', type: 'wager', amount: -25, description: 'Wager', metadata: {} },
      transactionNow,
      idGenerator,
    );

    expect(state.profiles[0].id).toBe('profile-2026-05-04T12:00:00.000Z');
    expect(profile.transactions[0].id).toBe('tx-2026-05-04T12:01:00.000Z');
    expect(idGenerator).toHaveBeenNthCalledWith(1, 'profile', profileNow);
    expect(idGenerator).toHaveBeenNthCalledWith(2, 'tx', transactionNow);
  });

  it('falls back to secure random bytes for state ids when randomUUID is unavailable', () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 128, 129, 130, 131, 132, 133, 134, 135]);
      return bytes;
    });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues } });

    try {
      expect(createStateId('profile', new Date('2026-05-04T12:00:00Z'))).toMatch(/^profile-[a-z0-9]+-00010203-0405-4607-8081-828384858687$/);
      expect(getRandomValues).toHaveBeenCalledOnce();
    } finally {
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
      }
    }
  });

  it('fails clearly when secure state id generation is unavailable', () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    try {
      expect(() => createStateId('profile', new Date('2026-05-04T12:00:00Z'))).toThrow('secure state IDs are unavailable');
    } finally {
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
      }
    }
  });

  it('does not count pushes or admin adjustments as gambling wins', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'Clean stats', 100, new Date('2026-05-04T12:00:00Z'));
    let profile = state.profiles[0];

    profile = recordTransaction(
      profile,
      { gameId: 'blackjack', type: 'push_refund', amount: 10, description: 'Push return', metadata: {} },
      new Date('2026-05-04T12:01:00Z'),
    );
    profile = recordTransaction(
      profile,
      { gameId: 'admin', type: 'admin_adjustment', amount: 500, description: 'Admin add', metadata: {} },
      new Date('2026-05-04T12:02:00Z'),
    );

    expect(profile.bankroll).toBe(610);
    expect(profile.stats.totalWon).toBe(0);
    expect(profile.stats.biggestWin).toBe(0);
  });

  it('parses a validated save file', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'Stored', 777, new Date('2026-05-04T12:00:00Z'));

    const imported = parseProfileStoreJson(JSON.stringify(state));

    expect(imported).toEqual(state);
  });

  it('migrates profile-store v1 legacy transactions and missing optional profile fields', () => {
    const imported = parseCasinoSaveState({
      version: 1,
      profiles: [
        {
          id: 'legacy',
          name: 'Legacy',
          bankroll: 50,
          stats: { totalWagered: 10, totalWon: 20, biggestWin: 20, gamesPlayed: 1 },
          transactions: [
            { id: 'tx1', gameId: 'blackjack', type: 'push', amount: 10, balanceAfter: 50, note: 'Old push' },
            { id: 'tx2', gameId: 'admin', type: 'admin', amount: 5, balanceAfter: 40, note: 'Old admin' },
          ],
        },
      ],
    });

    expect(imported.version).toBe(1);
    expect(imported.profiles[0].color).toMatch(/^#/);
    expect(imported.profiles[0].houseAdvance).toEqual({ outstandingBalance: 0, activeCount: 0 });
    expect(imported.profiles[0].stats.netProfit).toBe(10);
    expect(imported.profiles[0].transactions.map((transaction) => transaction.type)).toEqual(['push_refund', 'admin_adjustment']);
    expect(imported.profiles[0].transactions[0].description).toBe('Old push');
  });

  it('rejects malformed and unsupported profile-store migration inputs clearly', () => {
    expect(() => parseCasinoSaveState({ version: 1 })).toThrow('Profile store v1 data is not valid');
    expect(() => parseProfileStoreJson('{"version":2,"profiles":[]}')).toThrow('Profile store data version 2 is not supported.');
  });

  it('normalizes partial profile records that bypass save-state schema defaults', () => {
    const empty = parseCasinoProfile({ id: 'empty', name: '   ', stats: null });
    const rich = parseCasinoProfile({
      id: 'rich',
      name: '  Rich  ',
      bankroll: Number.NaN,
      houseAdvance: {
        outstandingBalance: 425,
        activeCount: 99,
      },
      stats: {
        perGame: {
          ignored: null,
          slots: { gamesPlayed: 2, wagered: Number.NaN, won: 25, netProfit: 7 },
        },
      },
      transactions: [
        {
          id: 'reset',
          gameId: 'admin',
          roomId: 'room-1',
          sessionId: 'session-1',
          type: 'reset',
          amount: Number.NaN,
          balanceBefore: Number.NaN,
          balanceAfter: Number.NaN,
          metadata: { keep: 'yes', count: 2, flag: false, drop: {} },
        },
        { id: 'import', gameId: 'admin', type: 'import', amount: 5, balanceBefore: 0, balanceAfter: 5 },
        { id: 'correction', gameId: 'admin', type: 'correction', amount: -5, balanceBefore: 5, balanceAfter: 0 },
      ],
    });

    expect(empty).toMatchObject({ name: 'Player', bankroll: 0, transactions: [] });
    expect(rich).toMatchObject({
      name: 'Rich',
      bankroll: 0,
      transactions: [
        expect.objectContaining({
          roomId: 'room-1',
          sessionId: 'session-1',
          type: 'reset',
          amount: 0,
          description: 'Imported legacy transaction.',
          metadata: { keep: 'yes', count: 2, flag: false },
        }),
        expect.objectContaining({ type: 'import' }),
        expect.objectContaining({ type: 'correction' }),
      ],
    });
    expect(rich.stats.perGame.slots).toMatchObject({ gamesPlayed: 2, wagered: 0, won: 25, netProfit: 7 });
    expect(rich.houseAdvance).toEqual({ outstandingBalance: 300, activeCount: 3 });
  });

  it('normalizes invalid House Advance imports without rejecting profiles', () => {
    expect(parseCasinoProfile({ id: 'missing', name: 'Missing' }).houseAdvance).toEqual({ outstandingBalance: 0, activeCount: 0 });
    expect(parseCasinoProfile({ id: 'negative', name: 'Negative', houseAdvance: { outstandingBalance: -100, activeCount: 2 } }).houseAdvance).toEqual({
      outstandingBalance: 0,
      activeCount: 0,
    });
    expect(
      parseCasinoProfile({ id: 'active-missing', name: 'Active Missing', houseAdvance: { outstandingBalance: 100, activeCount: -5 } }).houseAdvance,
    ).toEqual({
      outstandingBalance: 100,
      activeCount: 1,
    });
    expect(parseCasinoProfile({ id: 'too-high', name: 'Too High', houseAdvance: { outstandingBalance: 999, activeCount: 8 } }).houseAdvance).toEqual({
      outstandingBalance: 300,
      activeCount: 3,
    });
  });

  it('rejects invalid imported profiles and transactions', () => {
    expect(() => parseProfileStoreJson(JSON.stringify({ version: 1, profiles: [{ id: 1 }] }))).toThrow('Profile record is invalid.');
    expect(() =>
      parseProfileStoreJson(
        JSON.stringify({
          version: 1,
          profiles: [{ id: 'bad', name: 'Bad', transactions: [{ id: 1 }] }],
        }),
      ),
    ).toThrow('Transaction record is invalid.');
  });

  it('recovers gracefully from corrupted storage data', () => {
    const storage = new MemoryStorage();
    storage.setItem('casino_warehouse_profiles_v1', '{ broken');

    const loaded = loadProfileStore(storage);

    expect(loaded.recovered).toBe(true);
    expect(loaded.state.profiles).toEqual([]);
    expect(loaded.error).toBeTruthy();
  });

  it('keeps save failures visible to the caller', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('quota exceeded');
      }),
    };

    expect(() => saveProfileStore(storage, { version: 1, profiles: [] })).toThrow('quota exceeded');
  });

  it('replaces one profile in a save state', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'A', 100, new Date('2026-05-04T12:00:00Z'));
    const updated = recordTransaction(
      state.profiles[0],
      { gameId: 'slots', type: 'bonus', amount: 500, description: 'Bonus win', metadata: { slotTheme: 'thai-princess' } },
      new Date('2026-05-04T12:01:00Z'),
    );

    const next = replaceProfile(state, updated);

    expect(next.profiles[0].bankroll).toBe(600);
    expect(next.profiles[0].transactions[0].description).toBe('Bonus win');
  });
});
