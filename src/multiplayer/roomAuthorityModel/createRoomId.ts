import { secureRandomInt } from '../../game/rng/secureRandomInt';
import { roomIdSchema } from '../../schemas/casinoSchemas/roomIdSchema';
import { createRandomIdPart } from './createRandomIdPart';
import type { RandomInt } from './RandomInt';
import type { RoomState } from './RoomState';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';

export const createRoomId = (rooms: ReadonlyMap<RoomId, RoomState>, randomInt: RandomInt = secureRandomInt): RoomId => {
  while (true) {
    const id = roomIdSchema.parse(createRandomIdPart(randomInt));
    if (!rooms.has(id)) {
      return id;
    }
  }
};
