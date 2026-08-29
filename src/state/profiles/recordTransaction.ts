import type { BankrollTransaction } from './BankrollTransaction';
import type { CasinoProfile } from './CasinoProfile';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import { transactionIdSchema } from '../../schemas/casinoSchemas/transactionIdSchema';
import { createStateId } from './createStateId';
import { defaultHouseAdvanceState } from './defaultHouseAdvanceState';
import { favouriteGame } from './favouriteGame';
import type { PerGameStats } from './PerGameStats';
import type { ProfileStats } from './ProfileStats';
import type { StateIdGenerator } from './StateIdGenerator';

export const recordTransaction = (
  profile: CasinoProfile,
  transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  now = new Date(),
  idGenerator: StateIdGenerator = createStateId,
): CasinoProfile => {
  const emptyPerGameStats = (): PerGameStats => ({
    gamesPlayed: 0,
    wagered: 0,
    won: 0,
    netProfit: 0,
  });

  const amount = Math.floor(transaction.amount);
  const balanceBefore = profile.bankroll;
  const balanceAfter = Math.max(0, profile.bankroll + amount);
  const countsAsWin = amount > 0 && (transaction.type === 'payout' || transaction.type === 'bonus');
  const countsAsWager = transaction.type === 'wager';
  const statsNeutral =
    transaction.type === 'dealer_tip' ||
    transaction.type === 'dealer_thanks' ||
    transaction.type === 'house_advance_credit' ||
    transaction.type === 'house_advance_repayment';
  const casinoGameId = transaction.gameId === 'admin' || transaction.gameId === 'house-advance' ? undefined : transaction.gameId;
  const previousGame = casinoGameId ? (profile.stats.perGame[casinoGameId] ?? emptyPerGameStats()) : emptyPerGameStats();
  const nextPerGame: PerGameStats = {
    gamesPlayed: previousGame.gamesPlayed + (!statsNeutral && countsAsWager ? 1 : 0),
    wagered: previousGame.wagered + (!statsNeutral && countsAsWager ? Math.abs(amount) : 0),
    won: previousGame.won + (!statsNeutral && countsAsWin ? amount : 0),
    netProfit: previousGame.netProfit + (statsNeutral ? 0 : amount),
  };
  const perGame = statsNeutral || !casinoGameId ? profile.stats.perGame : { ...profile.stats.perGame, [casinoGameId]: nextPerGame };
  const nextStats: ProfileStats = {
    totalWagered: profile.stats.totalWagered + (!statsNeutral && countsAsWager ? Math.abs(amount) : 0),
    totalWon: profile.stats.totalWon + (!statsNeutral && countsAsWin ? amount : 0),
    netProfit: profile.stats.netProfit + (statsNeutral ? 0 : amount),
    biggestWin: Math.max(profile.stats.biggestWin, !statsNeutral && countsAsWin ? amount : 0),
    biggestWager: Math.max(profile.stats.biggestWager, !statsNeutral && countsAsWager ? Math.abs(amount) : 0),
    gamesPlayed: profile.stats.gamesPlayed + (!statsNeutral && countsAsWager ? 1 : 0),
    perGame,
    favouriteGame: favouriteGame(perGame),
  };

  return {
    ...profile,
    bankroll: balanceAfter,
    houseAdvance: transaction.type === 'reset' ? defaultHouseAdvanceState : profile.houseAdvance,
    stats: nextStats,
    transactions: [
      {
        id: transactionIdSchema.parse(idGenerator('tx', now)),
        profileId: profile.id,
        at: createIsoTimestamp(now),
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
    updatedAt: createIsoTimestamp(now),
  };
};
