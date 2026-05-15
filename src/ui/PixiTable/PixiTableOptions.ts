import type { BeatTheHouseStakeTarget } from '../../game/types/BeatTheHouseStakeTarget';
import type { HandId } from '../../game/types/HandId';

export interface PixiTableOptions {
  readonly onBet: (handId: HandId, stakeTarget: BeatTheHouseStakeTarget) => void;
}
