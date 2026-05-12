import type { BetType } from './BetType';
import type { HandId } from './HandId';

export type Bets = Record<HandId, Record<BetType, number>>;
