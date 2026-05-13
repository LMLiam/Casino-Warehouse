import { secureRandomInt } from '../../game/rng/secureRandomInt';
import type { RandomInt } from './RandomInt';

export const createRandomIdPart = (randomInt: RandomInt = secureRandomInt): string => {
  const randomIdPartLength = 6;
  const randomIdPartSpace = 36 ** randomIdPartLength;
  return randomInt(randomIdPartSpace).toString(36).padStart(randomIdPartLength, '0');
};
