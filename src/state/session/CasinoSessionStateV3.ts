import type { CasinoSessionState } from './CasinoSessionState';
import type { PlayerGameSnapshotsV3 } from './PlayerGameSnapshotsV3';

export type CasinoSessionStateV3 = Omit<CasinoSessionState, 'version' | 'gameSnapshot'> & {
  readonly version: 3;
  readonly gameSnapshot?: PlayerGameSnapshotsV3;
};
