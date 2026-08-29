import type { SideBetType } from './SideBetType';
import type { HandId } from './HandId';
import type { SideBetState } from './SideBetState';

export type SideStates = Record<HandId, Record<SideBetType, SideBetState>>;
