import type { BankrollTransaction } from './BankrollTransaction';
import type { BankrollTransactionMetadata } from './BankrollTransactionMetadata';
import type { CasinoProfile } from './CasinoProfile';
import { emptyStats } from './emptyStats';
import { favouriteGame } from './favouriteGame';
import { normalizeHouseAdvanceState } from './normalizeHouseAdvanceState';
import { normalizeProfileName } from './normalizeProfileName';
import type { PerGameStats } from './PerGameStats';
import { profileColorFromName } from './profileColorFromName';
import type { ProfileStats } from './ProfileStats';
import type { TransactionType } from './TransactionType';
import type { LegacyCasinoProfile } from './LegacyCasinoProfile';

export class CasinoProfileParser {
  public static parse(value: LegacyCasinoProfile | null): CasinoProfile {
    if (value === null || typeof value.id !== 'string' || typeof value.name !== 'string') {
      throw new Error('Profile record is invalid.');
    }

    return {
      id: value.id,
      name: normalizeProfileName(value.name),
      color: typeof value.color === 'string' ? value.color : profileColorFromName(value.name),
      bankroll: CasinoProfileParser.safeMoney(value.bankroll),
      houseAdvance: normalizeHouseAdvanceState(value.houseAdvance),
      stats: CasinoProfileParser.parseStats(value.stats),
      transactions: Array.isArray(value.transactions) ? value.transactions.map(CasinoProfileParser.parseTransaction) : [],
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    };
  }

  private static safeMoney(value: number | string | null | undefined): number {
    const numericValue = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
    return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
  }

  private static parseStats(value: LegacyCasinoProfile['stats']): ProfileStats {
    if (!value) {
      return emptyStats();
    }

    return {
      totalWagered: CasinoProfileParser.safeMoney(value.totalWagered),
      totalWon: CasinoProfileParser.safeMoney(value.totalWon),
      netProfit: Number.isFinite(value.netProfit)
        ? Math.floor(Number(value.netProfit))
        : CasinoProfileParser.safeMoney(value.totalWon) - CasinoProfileParser.safeMoney(value.totalWagered),
      biggestWin: CasinoProfileParser.safeMoney(value.biggestWin),
      biggestWager: CasinoProfileParser.safeMoney(value.biggestWager),
      gamesPlayed: CasinoProfileParser.safeMoney(value.gamesPlayed),
      perGame: CasinoProfileParser.parsePerGameStats(value.perGame),
      favouriteGame: typeof value.favouriteGame === 'string' ? value.favouriteGame : favouriteGame(CasinoProfileParser.parsePerGameStats(value.perGame)),
    };
  }

  private static parseTransaction(value: NonNullable<LegacyCasinoProfile['transactions']>[number]): BankrollTransaction {
    if (typeof value.id !== 'string' || typeof value.gameId !== 'string') {
      throw new Error('Transaction record is invalid.');
    }

    return {
      id: value.id,
      profileId: typeof value.profileId === 'string' ? value.profileId : '',
      at: typeof value.at === 'string' ? value.at : new Date().toISOString(),
      gameId: value.gameId,
      roomId: typeof value.roomId === 'string' ? value.roomId : undefined,
      sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
      type: CasinoProfileParser.parseTransactionType(value.type),
      amount: Number.isFinite(value.amount) ? Math.floor(Number(value.amount)) : 0,
      balanceBefore: CasinoProfileParser.safeMoney(value.balanceBefore),
      balanceAfter: CasinoProfileParser.safeMoney(value.balanceAfter),
      description: typeof value.description === 'string' ? value.description : typeof value.note === 'string' ? value.note : 'Imported legacy transaction.',
      metadata: CasinoProfileParser.parseMetadata(value.metadata),
    };
  }

  private static parseTransactionType(value: string | null | undefined): TransactionType {
    if (value === 'push') {
      return 'push_refund';
    }
    if (value === 'admin') {
      return 'admin_adjustment';
    }
    return CasinoProfileParser.isTransactionType(value) ? value : 'correction';
  }

  private static isTransactionType(value: string | null | undefined): value is TransactionType {
    return (
      value === 'wager' ||
      value === 'payout' ||
      value === 'push_refund' ||
      value === 'bonus' ||
      value === 'admin_adjustment' ||
      value === 'reset' ||
      value === 'import' ||
      value === 'correction' ||
      value === 'dealer_tip' ||
      value === 'dealer_thanks' ||
      value === 'house_advance_credit' ||
      value === 'house_advance_repayment'
    );
  }

  private static parsePerGameStats(value: NonNullable<LegacyCasinoProfile['stats']>['perGame']): Readonly<Record<string, PerGameStats>> {
    if (!value) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).flatMap(([gameId, stats]) => {
        if (!stats) {
          return [];
        }
        return [
          [
            gameId,
            {
              gamesPlayed: CasinoProfileParser.safeMoney(stats.gamesPlayed),
              wagered: CasinoProfileParser.safeMoney(stats.wagered),
              won: CasinoProfileParser.safeMoney(stats.won),
              netProfit: Number.isFinite(stats.netProfit)
                ? Math.floor(Number(stats.netProfit))
                : CasinoProfileParser.safeMoney(stats.won) - CasinoProfileParser.safeMoney(stats.wagered),
            },
          ],
        ];
      }),
    );
  }

  private static parseMetadata(value: NonNullable<LegacyCasinoProfile['transactions']>[number]['metadata']): BankrollTransactionMetadata {
    if (!value) {
      return {};
    }

    const metadata: Record<string, BankrollTransactionMetadata[string]> = {};
    for (const [key, metadataValue] of Object.entries(value)) {
      if (typeof metadataValue === 'string' || typeof metadataValue === 'number' || typeof metadataValue === 'boolean') {
        metadata[key] = metadataValue;
      }
    }
    return metadata;
  }
}
