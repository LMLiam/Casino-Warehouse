import type { BankrollTransactionMetadata } from './BankrollTransactionMetadata';
import type { IsoTimestamp } from '../../schemas/casinoSchemas/IsoTimestamp';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import type { TransactionGameId } from '../../schemas/casinoSchemas/TransactionGameId';
import type { TransactionId } from '../../schemas/casinoSchemas/TransactionId';
import type { TransactionType } from './TransactionType';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';

export interface BankrollTransaction {
  readonly id: TransactionId;
  readonly profileId: ProfileId;
  readonly at: IsoTimestamp;
  readonly gameId: TransactionGameId;
  readonly roomId?: RoomId | undefined;
  readonly sessionId?: SessionId | undefined;
  readonly type: TransactionType;
  readonly amount: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly description: string;
  readonly metadata: BankrollTransactionMetadata;
}
