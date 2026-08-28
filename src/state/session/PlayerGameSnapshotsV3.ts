import type { PlayerGameSnapshots } from './PlayerGameSnapshots';
import type { BeatTheHouseSaveStateV3 } from './BeatTheHouseSaveStateV3';

export type PlayerGameSnapshotsV3 = Omit<PlayerGameSnapshots, 'beatTheHouse'> & {
  readonly beatTheHouse?: BeatTheHouseSaveStateV3;
};
