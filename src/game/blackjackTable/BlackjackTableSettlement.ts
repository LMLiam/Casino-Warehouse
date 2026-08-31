import type { BlackjackSeatId } from '../../schemas/casinoSchemas/BlackjackSeatId';

export interface BlackjackTableSettlement {
  readonly seatId: BlackjackSeatId;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
}
