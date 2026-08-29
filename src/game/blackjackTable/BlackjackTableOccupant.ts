import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { BlackjackSeatId } from '../../schemas/casinoSchemas/BlackjackSeatId';

export interface BlackjackTableOccupant {
  readonly seatId: BlackjackSeatId;
  readonly profileId?: ProfileId | undefined;
  readonly profileName?: string | undefined;
  readonly bankroll?: number | undefined;
}
