import { secureRandomInt } from '../../game/rng/secureRandomInt';
import { createRandomIdPart } from './createRandomIdPart';
import type { RandomInt } from './RandomInt';
import type { RoomState } from './RoomState';

export const createRoomId = (rooms: ReadonlyMap<string, RoomState>, randomInt: RandomInt = secureRandomInt): string => {
  while (true) {
    const id = createRandomIdPart(randomInt).toUpperCase();
    if (!rooms.has(id)) {
      return id;
    }
  }
};
