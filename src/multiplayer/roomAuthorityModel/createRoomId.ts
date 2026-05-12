import { secureRandomInt } from '../../game/rng/secureRandomInt';
import type { RoomState } from './RoomState';

const randomIdPartLength = 6;

const randomIdPartSpace = 36 ** randomIdPartLength;

type RandomInt = (maxExclusive: number) => number;

export const createRoomId = (rooms: ReadonlyMap<string, RoomState>, randomInt: RandomInt = secureRandomInt): string => {
  while (true) {
    const id = createRandomIdPart(randomInt).toUpperCase();
    if (!rooms.has(id)) {
      return id;
    }
  }
};

const createRandomIdPart = (randomInt: RandomInt = secureRandomInt): string => randomInt(randomIdPartSpace).toString(36).padStart(randomIdPartLength, '0');
