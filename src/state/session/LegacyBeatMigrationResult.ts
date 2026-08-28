import type { CasinoProfile } from '../profiles/CasinoProfile';

export interface LegacyBeatMigrationResult {
  readonly status: 'migrated' | 'already-migrated' | 'blocked';
  readonly profile?: CasinoProfile;
  readonly refundedWholeCredits: number;
  readonly reason?: string;
}
