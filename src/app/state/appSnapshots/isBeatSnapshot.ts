import type { GameSnapshot } from '../../../game/types/GameSnapshot';
import type { RoomGameSnapshot } from '../../../multiplayer/protocol/RoomGameSnapshot';

export const isBeatSnapshot = (snapshot: RoomGameSnapshot | null): snapshot is GameSnapshot =>
  snapshot !== null && 'bets' in snapshot && 'hands' in snapshot && 'dealer' in snapshot;
