import type { RoomRole } from './RoomRole';

export interface RoomPlayer {
  readonly connectionId: string;
  readonly profileId: string;
  readonly profileName: string;
  readonly bankroll: number;
  readonly sessionStartBankroll: number;
  readonly role: RoomRole;
}
