import type { LegacyBeatPhase } from './LegacyBeatPhase';

export interface LegacyBeatSessionEvidence {
  readonly migrationKey: 'beat-v2-to-v3';
  readonly profileId: string;
  readonly phase: LegacyBeatPhase;
  readonly snapshotTableCredits: number;
  readonly snapshotHasSummary: boolean;
}
