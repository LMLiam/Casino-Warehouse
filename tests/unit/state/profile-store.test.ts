import { describe, expect, it, vi } from 'vitest';
import {
  createProfile,
  deleteProfile,
  loadProfileStore,
  parseProfileStoreJson,
  recordTransaction,
  renameProfile,
  replaceProfile,
  saveProfileStore,
  type StorageLike,
} from '../../../src/state/profiles';

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
    const state = createProfile({ version: 1, profiles: [] }, 'Liam', 1500, new Date('2026-05-04T12:00:00Z'));

    saveProfileStore(storage, state);
    const loaded = loadProfileStore(storage);

    expect(loaded.recovered).toBe(false);
    expect(loaded.state.profiles).toHaveLength(1);
    expect(loaded.state.profiles[0].name).toBe('Liam');
    expect(loaded.state.profiles[0].bankroll).toBe(1500);
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

  it('does not count pushes or admin adjustments as gambling wins', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'Clean stats', 100, new Date('2026-05-04T12:00:00Z'));
    let profile = state.profiles[0];

    profile = recordTransaction(profile, { gameId: 'blackjack', type: 'push_refund', amount: 10, description: 'Push return', metadata: {} }, new Date('2026-05-04T12:01:00Z'));
    profile = recordTransaction(profile, { gameId: 'admin', type: 'admin_adjustment', amount: 500, description: 'Admin add', metadata: {} }, new Date('2026-05-04T12:02:00Z'));

    expect(profile.bankroll).toBe(610);
    expect(profile.stats.totalWon).toBe(0);
    expect(profile.stats.biggestWin).toBe(0);
  });

  it('parses a validated save file', () => {
    const state = createProfile({ version: 1, profiles: [] }, 'Stored', 777, new Date('2026-05-04T12:00:00Z'));

    const imported = parseProfileStoreJson(JSON.stringify(state));

    expect(imported).toEqual(state);
  });

  it('migrates legacy transactions and missing optional profile fields', () => {
    const imported = parseProfileStoreJson(
      JSON.stringify({
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
      }),
    );

    expect(imported.profiles[0].color).toMatch(/^#/);
    expect(imported.profiles[0].stats.netProfit).toBe(10);
    expect(imported.profiles[0].transactions.map((transaction) => transaction.type)).toEqual(['push_refund', 'admin_adjustment']);
    expect(imported.profiles[0].transactions[0].description).toBe('Old push');
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
