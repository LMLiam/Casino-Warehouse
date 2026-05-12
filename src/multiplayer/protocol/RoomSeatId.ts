import type { HandId } from '../../game/types/HandId';

export type RoomSeatId = HandId | `seat-${number}`;
