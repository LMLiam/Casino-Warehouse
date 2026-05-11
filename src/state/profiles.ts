import { casinoSaveStateEnvelopeSchema, zodErrorSummary } from '../schemas/casinoSchemas';

export interface ProfileStats {
  readonly totalWagered: number;
  readonly totalWon: number;
  readonly netProfit: number;
  readonly biggestWin: number;
  readonly biggestWager: number;
  readonly gamesPlayed: number;
  readonly perGame: Readonly<Record<string, PerGameStats>>;
  readonly favouriteGame?: string;
}

export interface PerGameStats {
  readonly gamesPlayed: number;
  readonly wagered: number;
  readonly won: number;
  readonly netProfit: number;
}

export type TransactionType = 'wager' | 'payout' | 'push_refund' | 'bonus' | 'admin_adjustment' | 'reset' | 'import' | 'correction';

export interface BankrollTransaction {
  readonly id: string;
  readonly profileId: string;
  readonly at: string;
  readonly gameId: string;
  readonly roomId?: string;
  readonly sessionId?: string;
  readonly type: TransactionType;
  readonly amount: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly description: string;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface CasinoProfile {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly bankroll: number;
  readonly stats: ProfileStats;
  readonly transactions: readonly BankrollTransaction[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CasinoSaveState {
  readonly version: 1;
  readonly profiles: readonly CasinoProfile[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProfileStoreResult {
  readonly state: CasinoSaveState;
  readonly recovered: boolean;
  readonly error?: string;
}

export const profileStorageKey = 'casino_warehouse_profiles_v1';

export const emptyStats = (): ProfileStats => ({
  totalWagered: 0,
  totalWon: 0,
  netProfit: 0,
  biggestWin: 0,
  biggestWager: 0,
  gamesPlayed: 0,
  perGame: {},
});

export const emptySaveState = (): CasinoSaveState => ({
  version: 1,
  profiles: [],
});

export const loadProfileStore = (storage: StorageLike, key = profileStorageKey): ProfileStoreResult => {
  const raw = storage.getItem(key);
  if (!raw) {
    return { state: emptySaveState(), recovered: false };
  }

  try {
    return { state: parseSaveState(JSON.parse(raw)), recovered: false };
  } catch (error) {
    return {
      state: emptySaveState(),
      recovered: true,
      error: error instanceof Error ? error.message : 'Unknown save-data error.',
    };
  }
};

export const saveProfileStore = (storage: StorageLike, state: CasinoSaveState, key = profileStorageKey): void => {
  storage.setItem(key, JSON.stringify(parseSaveState(state)));
};

export const parseProfileStoreJson = (json: string): CasinoSaveState => parseSaveState(JSON.parse(json));

export const createProfile = (state: CasinoSaveState, name: string, bankroll = 1000, now = new Date()): CasinoSaveState => {
  const profileName = normalizeName(name);
  const at = now.toISOString();
  const profile: CasinoProfile = {
    id: createId('profile', now),
    name: profileName,
    color: colorFromName(profileName),
    bankroll: Math.max(0, Math.floor(bankroll)),
    stats: emptyStats(),
    transactions: [],
    createdAt: at,
    updatedAt: at,
  };

  return { ...state, profiles: [...state.profiles, profile] };
};

export const renameProfile = (state: CasinoSaveState, profileId: string, name: string, now = new Date()): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.map((profile) => (profile.id === profileId ? { ...profile, name: normalizeName(name), updatedAt: now.toISOString() } : profile)),
});

export const deleteProfile = (state: CasinoSaveState, profileId: string): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.filter((profile) => profile.id !== profileId),
});

export const recordTransaction = (
  profile: CasinoProfile,
  transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  now = new Date(),
): CasinoProfile => {
  const amount = Math.floor(transaction.amount);
  const balanceBefore = profile.bankroll;
  const balanceAfter = Math.max(0, profile.bankroll + amount);
  const countsAsWin = amount > 0 && (transaction.type === 'payout' || transaction.type === 'bonus');
  const countsAsWager = transaction.type === 'wager';
  const previousGame = profile.stats.perGame[transaction.gameId] ?? emptyPerGameStats();
  const nextPerGame: PerGameStats = {
    gamesPlayed: previousGame.gamesPlayed + (countsAsWager ? 1 : 0),
    wagered: previousGame.wagered + (countsAsWager ? Math.abs(amount) : 0),
    won: previousGame.won + (countsAsWin ? amount : 0),
    netProfit: previousGame.netProfit + amount,
  };
  const perGame = {
    ...profile.stats.perGame,
    [transaction.gameId]: nextPerGame,
  };
  const nextStats: ProfileStats = {
    totalWagered: profile.stats.totalWagered + (countsAsWager ? Math.abs(amount) : 0),
    totalWon: profile.stats.totalWon + (countsAsWin ? amount : 0),
    netProfit: profile.stats.netProfit + amount,
    biggestWin: Math.max(profile.stats.biggestWin, countsAsWin ? amount : 0),
    biggestWager: Math.max(profile.stats.biggestWager, countsAsWager ? Math.abs(amount) : 0),
    gamesPlayed: profile.stats.gamesPlayed + (countsAsWager ? 1 : 0),
    perGame,
    favouriteGame: favouriteGame(perGame),
  };

  return {
    ...profile,
    bankroll: balanceAfter,
    stats: nextStats,
    transactions: [
      {
        id: createId('tx', now),
        profileId: profile.id,
        at: now.toISOString(),
        gameId: transaction.gameId,
        roomId: transaction.roomId,
        sessionId: transaction.sessionId,
        type: transaction.type,
        amount,
        balanceBefore,
        balanceAfter,
        description: transaction.description,
        metadata: transaction.metadata,
      },
      ...profile.transactions,
    ].slice(0, 200),
    updatedAt: now.toISOString(),
  };
};

export const replaceProfile = (state: CasinoSaveState, updated: CasinoProfile): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.map((profile) => (profile.id === updated.id ? parseProfile(updated) : profile)),
});

const parseSaveState = (value: unknown): CasinoSaveState => {
  const parsed = casinoSaveStateEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Save data is not a casino profile store: ${zodErrorSummary(parsed.error)}`);
  }

  return {
    version: 1,
    profiles: parsed.data.profiles.map(parseProfile),
  };
};

const parseProfile = (value: unknown): CasinoProfile => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new Error('Profile record is invalid.');
  }

  return {
    id: value.id,
    name: normalizeName(value.name),
    color: typeof value.color === 'string' ? value.color : colorFromName(value.name),
    bankroll: safeMoney(value.bankroll),
    stats: parseStats(value.stats),
    transactions: Array.isArray(value.transactions) ? value.transactions.map(parseTransaction) : [],
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
};

const parseStats = (value: unknown): ProfileStats => {
  if (!isRecord(value)) {
    return emptyStats();
  }

  return {
    totalWagered: safeMoney(value.totalWagered),
    totalWon: safeMoney(value.totalWon),
    netProfit: Number.isFinite(value.netProfit) ? Math.floor(Number(value.netProfit)) : safeMoney(value.totalWon) - safeMoney(value.totalWagered),
    biggestWin: safeMoney(value.biggestWin),
    biggestWager: safeMoney(value.biggestWager),
    gamesPlayed: safeMoney(value.gamesPlayed),
    perGame: parsePerGameStats(value.perGame),
    favouriteGame: typeof value.favouriteGame === 'string' ? value.favouriteGame : favouriteGame(parsePerGameStats(value.perGame)),
  };
};

const parseTransaction = (value: unknown): BankrollTransaction => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.gameId !== 'string') {
    throw new Error('Transaction record is invalid.');
  }

  return {
    id: value.id,
    profileId: typeof value.profileId === 'string' ? value.profileId : '',
    at: typeof value.at === 'string' ? value.at : new Date().toISOString(),
    gameId: value.gameId,
    roomId: typeof value.roomId === 'string' ? value.roomId : undefined,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
    type: parseTransactionType(value.type),
    amount: Number.isFinite(value.amount) ? Math.floor(Number(value.amount)) : 0,
    balanceBefore: safeMoney(value.balanceBefore),
    balanceAfter: safeMoney(value.balanceAfter),
    description: typeof value.description === 'string' ? value.description : typeof value.note === 'string' ? value.note : 'Imported legacy transaction.',
    metadata: parseMetadata(value.metadata),
  };
};

const normalizeName = (name: string): string => name.trim().slice(0, 32) || 'Player';

const safeMoney = (value: unknown): number => (Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0);

const createId = (prefix: string, now: Date): string => `${prefix}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseTransactionType = (value: unknown): TransactionType => {
  if (value === 'push') {
    return 'push_refund';
  }
  if (value === 'admin') {
    return 'admin_adjustment';
  }
  return isTransactionType(value) ? value : 'correction';
};

const isTransactionType = (value: unknown): value is TransactionType =>
  value === 'wager' ||
  value === 'payout' ||
  value === 'push_refund' ||
  value === 'bonus' ||
  value === 'admin_adjustment' ||
  value === 'reset' ||
  value === 'import' ||
  value === 'correction';

const emptyPerGameStats = (): PerGameStats => ({
  gamesPlayed: 0,
  wagered: 0,
  won: 0,
  netProfit: 0,
});

const parsePerGameStats = (value: unknown): Readonly<Record<string, PerGameStats>> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([gameId, stats]) => {
      if (!isRecord(stats)) {
        return [];
      }
      return [
        [
          gameId,
          {
            gamesPlayed: safeMoney(stats.gamesPlayed),
            wagered: safeMoney(stats.wagered),
            won: safeMoney(stats.won),
            netProfit: Number.isFinite(stats.netProfit) ? Math.floor(Number(stats.netProfit)) : safeMoney(stats.won) - safeMoney(stats.wagered),
          },
        ],
      ];
    }),
  );
};

const favouriteGame = (perGame: Readonly<Record<string, PerGameStats>>): string | undefined =>
  Object.entries(perGame).sort(([, left], [, right]) => right.gamesPlayed - left.gamesPlayed)[0]?.[0];

const parseMetadata = (value: unknown): Readonly<Record<string, string | number | boolean>> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean] => {
      const metadataValue = entry[1];
      return typeof metadataValue === 'string' || typeof metadataValue === 'number' || typeof metadataValue === 'boolean';
    }),
  );
};

const colorFromName = (name: string): string => {
  const colors = ['#ffd56b', '#75ff92', '#26f0ff', '#ff8ac6', '#b48cff', '#ffb13b'];
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[total % colors.length];
};
