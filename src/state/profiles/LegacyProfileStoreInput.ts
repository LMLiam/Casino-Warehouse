import type { LegacyCasinoProfile } from './LegacyCasinoProfile';

export interface LegacyProfileStoreInput {
  readonly version?: number;
  readonly profiles?: readonly LegacyCasinoProfile[];
}
