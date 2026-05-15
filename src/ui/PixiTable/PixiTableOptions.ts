import type { BeatTheHouseChipTarget } from '../../game/types/BeatTheHouseChipTarget';
import type { HandId } from '../../game/types/HandId';

export interface PixiTableOptions {
  readonly onBet: (handId: HandId, chipTarget: BeatTheHouseChipTarget) => void;
}
