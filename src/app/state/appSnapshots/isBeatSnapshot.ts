import type { RoomGameSnapshot } from '../../../multiplayer/protocol/RoomGameSnapshot';
import type { GameSnapshot } from '../../../game/types/GameSnapshot';

export const isBeatSnapshot = (snapshot: RoomGameSnapshot): snapshot is GameSnapshot => 'bets' in snapshot && 'hands' in snapshot && 'dealer' in snapshot;
