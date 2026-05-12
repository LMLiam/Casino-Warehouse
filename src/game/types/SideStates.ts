import type { BetType } from './BetType';
import type { HandId } from './HandId';
import type { SideBetState } from './SideBetState';

export type SideStates = Record<HandId, Record<Exclude<BetType, 'main'>, SideBetState>>;
