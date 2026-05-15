import type { BankrollTransactionMetadata } from './BankrollTransactionMetadata';
import type { TransactionType } from './TransactionType';

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
  readonly metadata: BankrollTransactionMetadata;
}
