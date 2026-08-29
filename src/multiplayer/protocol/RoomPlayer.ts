import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { RoomRole } from './RoomRole';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';

export interface RoomPlayer {
  readonly connectionId: ConnectionId;
  readonly profileId: ProfileId;
  readonly profileName: string;
  readonly bankroll: number;
  readonly sessionStartBankroll: number;
  readonly role: RoomRole;
}
