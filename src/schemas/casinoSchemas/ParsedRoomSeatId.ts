import type { HandId } from '../../game/types/HandId';

export type ParsedRoomSeatId = HandId | `seat-${number}`;
