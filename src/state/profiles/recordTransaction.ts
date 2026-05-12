import type { BankrollTransaction } from './BankrollTransaction';
import type { CasinoProfile } from './CasinoProfile';
import { createStateId } from './createStateId';
import type { PerGameStats } from './PerGameStats';
import type { ProfileStats } from './ProfileStats';

type StateIdGenerator = (prefix: string, now: Date) => string;

export const recordTransaction = (
  profile: CasinoProfile,
  transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  now = new Date(),
  idGenerator: StateIdGenerator = createStateId,
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
        id: idGenerator('tx', now),
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

const emptyPerGameStats = (): PerGameStats => ({
  gamesPlayed: 0,
  wagered: 0,
  won: 0,
  netProfit: 0,
});

const favouriteGame = (perGame: Readonly<Record<string, PerGameStats>>): string | undefined =>
  Object.entries(perGame).sort(([, left], [, right]) => right.gamesPlayed - left.gamesPlayed)[0]?.[0];
