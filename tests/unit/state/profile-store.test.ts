import { describe, expect, it, vi } from 'vitest';
import { createProfile } from '../../../src/state/profiles/createProfile';
import { deleteProfile } from '../../../src/state/profiles/deleteProfile';
import { houseAdvanceRepaymentForProfit } from '../../../src/state/profiles/houseAdvanceRepaymentForProfit';
import { loadProfileStore } from '../../../src/state/profiles/loadProfileStore';
import { parseCasinoSaveState } from '../../../src/state/profiles/parseCasinoSaveState';
import { parseProfileStoreJson } from '../../../src/state/profiles/parseProfileStoreJson';
import { recordTransaction } from '../../../src/state/profiles/recordTransaction';
import { renameProfile } from '../../../src/state/profiles/renameProfile';
import { replaceProfile } from '../../../src/state/profiles/replaceProfile';
import { saveProfileStore } from '../../../src/state/profiles/saveProfileStore';
import type { StorageLike } from '../../../src/state/profiles/StorageLike';
import { createStateId } from '../../../src/state/profiles/createStateId';
import type { CasinoProfile } from '../../../src/state/profiles/CasinoProfile';

const requireProfileAt = (profiles: readonly CasinoProfile[], index: number): CasinoProfile => {
  const profile = profiles[index];
  if (!profile) {
    throw new Error(`Missing profile at index ${index}.`);
  }
  return profile;
};

const requireTransactionAt = (profile: CasinoProfile, index: number): CasinoProfile['transactions'][number] => {
  const transaction = profile.transactions[index];
  if (!transaction) {
    throw new Error(`Missing transaction at index ${index}.`);
  }
  return transaction;
};

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
    const state = createProfile({ profiles: [] }, 'Liam', 1500, new Date('2026-05-04T12:00:00Z'));

    saveProfileStore(storage, state);
    const loaded = loadProfileStore(storage);

    expect(loaded.recovered).toBe(false);
    expect(loaded.state.profiles).toHaveLength(1);
    expect(requireProfileAt(loaded.state.profiles, 0).name).toBe('Liam');
    expect(requireProfileAt(loaded.state.profiles, 0).bankroll).toBe(1500);
    expect(requireProfileAt(loaded.state.profiles, 0).houseAdvance).toEqual({ outstandingBalance: 0, activeCount: 0 });
  });

  it('renames and deletes profiles without touching other records', () => {
    let state = createProfile({ profiles: [] }, 'One', 100, new Date('2026-05-04T12:00:00Z'));
    state = createProfile(state, 'Two', 200, new Date('2026-05-04T12:01:00Z'));
    const secondId = requireProfileAt(state.profiles, 1).id;

    state = renameProfile(state, secondId, 'VIP Two', new Date('2026-05-04T12:02:00Z'));
    state = deleteProfile(state, requireProfileAt(state.profiles, 0).id);

    expect(state.profiles).toHaveLength(1);
    expect(requireProfileAt(state.profiles, 0).name).toBe('VIP Two');
    expect(requireProfileAt(state.profiles, 0).bankroll).toBe(200);
  });

  it('records bankroll transaction history and stats', () => {
    const state = createProfile({ profiles: [] }, 'Stats', 1000, new Date('2026-05-04T12:00:00Z'));
    let profile = requireProfileAt(state.profiles, 0);

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
    expect(requireTransactionAt(profile, 0)).toMatchObject({ profileId: profile.id, balanceBefore: 975, description: 'Blackjack win' });
  });

  it('keeps House Advance credits and repayments out of gameplay stats', () => {
    const state = createProfile({ profiles: [] }, 'Advance Stats', 0, new Date('2026-05-04T12:00:00Z'));
    let profile = requireProfileAt(state.profiles, 0);

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

  it('keeps dealer tips and Dealer Thanks rewards out of wager and winnings stats', () => {
    const state = createProfile({ profiles: [] }, 'Tip Stats', 100, new Date('2026-05-04T12:00:00Z'));
    let profile = requireProfileAt(state.profiles, 0);

    profile = recordTransaction(
      profile,
      { gameId: 'beat-the-house', type: 'dealer_tip', amount: -10, description: 'Dealer tip taken.', metadata: { handId: 'left' } },
      new Date('2026-05-04T12:01:00Z'),
    );
    profile = recordTransaction(
      profile,
      { gameId: 'beat-the-house', type: 'dealer_thanks', amount: 20, description: "Dealer's Thanks reward.", metadata: { handId: 'left' } },
      new Date('2026-05-04T12:02:00Z'),
    );

    expect(profile.bankroll).toBe(110);
    expect(profile.stats).toMatchObject({
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
      biggestWin: 0,
      biggestWager: 0,
      gamesPlayed: 0,
      perGame: {},
    });
    expect(profile.transactions.map((transaction) => transaction.type)).toEqual(['dealer_thanks', 'dealer_tip']);
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
      const state = createProfile(createProfile({ profiles: [] }, 'One', 100, now), 'Two', 200, now);
      const firstProfile = requireProfileAt(state.profiles, 0);
      const secondProfile = requireProfileAt(state.profiles, 1);
      const updated = recordTransaction(
        recordTransaction(firstProfile, { gameId: 'slots:thai-princess', type: 'wager', amount: -10, description: 'Spin', metadata: {} }, now),
        { gameId: 'slots:thai-princess', type: 'payout', amount: 20, description: 'Win', metadata: {} },
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
    const state = createProfile({ profiles: [] }, 'Deterministic', 1000, profileNow, idGenerator);
    const profile = recordTransaction(
      requireProfileAt(state.profiles, 0),
      { gameId: 'blackjack', type: 'wager', amount: -25, description: 'Wager', metadata: {} },
      transactionNow,
      idGenerator,
    );

    expect(requireProfileAt(state.profiles, 0).id).toBe('profile-2026-05-04T12:00:00.000Z');
    expect(requireTransactionAt(profile, 0).id).toBe('tx-2026-05-04T12:01:00.000Z');
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
    const state = createProfile({ profiles: [] }, 'Clean stats', 100, new Date('2026-05-04T12:00:00Z'));
    let profile = requireProfileAt(state.profiles, 0);

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
    const state = createProfile({ profiles: [] }, 'Stored', 777, new Date('2026-05-04T12:00:00Z'));

    const imported = parseProfileStoreJson(JSON.stringify(state));

    expect(imported).toEqual(state);
  });

  it('rejects obsolete and malformed profile stores instead of migrating them', () => {
    expect(() => parseCasinoSaveState({ version: 1, profiles: [] })).toThrow('Unrecognized key: "version"');
    expect(() => parseProfileStoreJson('{"profiles":[{"id":1}]}')).toThrow('Save data is not a casino profile store');
  });

  it('recovers gracefully from corrupted storage data', () => {
    const storage = new MemoryStorage();
    storage.setItem('casino_warehouse_profiles', '{ broken');

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

    expect(() => saveProfileStore(storage, { profiles: [] })).toThrow('quota exceeded');
  });

  it('replaces one profile in a save state', () => {
    const state = createProfile({ profiles: [] }, 'A', 100, new Date('2026-05-04T12:00:00Z'));
    const updated = recordTransaction(
      requireProfileAt(state.profiles, 0),
      { gameId: 'slots:thai-princess', type: 'bonus', amount: 500, description: 'Bonus win', metadata: { slotTheme: 'thai-princess' } },
      new Date('2026-05-04T12:01:00Z'),
    );

    const next = replaceProfile(state, updated);

    expect(requireProfileAt(next.profiles, 0).bankroll).toBe(600);
    expect(requireTransactionAt(requireProfileAt(next.profiles, 0), 0).description).toBe('Bonus win');
  });
});
