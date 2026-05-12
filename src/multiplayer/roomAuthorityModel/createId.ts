import { secureRandomInt } from '../../game/rng/secureRandomInt';

const randomIdPartLength = 6;

const randomIdPartSpace = 36 ** randomIdPartLength;

type RandomInt = (maxExclusive: number) => number;

export const createId = (prefix: string, randomInt: RandomInt = secureRandomInt): string =>
  `${prefix}-${Date.now().toString(36)}-${createRandomIdPart(randomInt)}`;

const createRandomIdPart = (randomInt: RandomInt = secureRandomInt): string => randomInt(randomIdPartSpace).toString(36).padStart(randomIdPartLength, '0');
