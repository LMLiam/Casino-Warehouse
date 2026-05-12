import type { BlackjackTableSettlement } from './BlackjackTableSettlement';
import type { BlackjackTableSnapshot } from './BlackjackTableSnapshot';

export interface BlackjackTableActionResult {
  readonly snapshot: BlackjackTableSnapshot;
  readonly debit: number;
  readonly settlements: readonly BlackjackTableSettlement[];
  readonly error?: string;
}
