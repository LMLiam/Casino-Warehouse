import type { LegacyBeatMigrationResult } from './LegacyBeatMigrationResult';
import type { LegacyBeatSessionEvidence } from './LegacyBeatSessionEvidence';

export interface LegacyBeatMigrationPort {
  migrateLegacyBeatTheHouseSession(evidence: LegacyBeatSessionEvidence): LegacyBeatMigrationResult;
}
