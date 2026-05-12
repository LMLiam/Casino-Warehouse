import type { Rng } from './Rng';
import { secureRandomInt } from './secureRandomInt';

export const secureRandomUnit: Rng = () => secureRandomInt(0x1_0000_0000) / 0x1_0000_0000;
