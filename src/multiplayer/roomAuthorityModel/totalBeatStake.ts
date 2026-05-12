import { betTypes } from '../../game/types/betTypes';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { HandId } from '../../game/types/HandId';

export const totalBeatStake = (snapshot: GameSnapshot, handId: HandId): number => betTypes.reduce((sum, betType) => sum + snapshot.bets[handId][betType], 0);
