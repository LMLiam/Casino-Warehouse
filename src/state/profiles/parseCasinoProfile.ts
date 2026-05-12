import type { BankrollTransaction } from './BankrollTransaction';
import type { CasinoProfile } from './CasinoProfile';
import { emptyStats } from './emptyStats';
import type { PerGameStats } from './PerGameStats';
import type { ProfileStats } from './ProfileStats';
import type { TransactionType } from './TransactionType';

export const parseCasinoProfile = (value: unknown): CasinoProfile => {
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

const normalizeName = (name: string): string => name.trim().slice(0, 32) || 'Player';

const safeMoney = (value: unknown): number => (Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

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
