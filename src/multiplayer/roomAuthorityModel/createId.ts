import { secureRandomInt } from '../../game/rng/secureRandomInt';
import { createRandomIdPart } from './createRandomIdPart';
import type { RandomInt } from './RandomInt';

export const createId = (prefix: string, randomInt: RandomInt = secureRandomInt): string =>
  `${prefix}-${Date.now().toString(36)}-${createRandomIdPart(randomInt)}`;
