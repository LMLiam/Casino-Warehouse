import type { CasinoSessionStateV3 } from './CasinoSessionStateV3';
import type { BeatTheHouseSaveStateV3 } from './BeatTheHouseSaveStateV3';
import type { LegacyBeatMigrationPort } from './LegacyBeatMigrationPort';
import type { LegacyBeatMigrationResult } from './LegacyBeatMigrationResult';
import type { LegacyBeatSessionEvidence } from './LegacyBeatSessionEvidence';
import type { LegacyBeatPhase } from './LegacyBeatPhase';
import { parseSessionStateV2 } from './parseSessionStateV2';
import { parseSessionStateV3 } from './parseSessionStateV3';
import { SessionStateParser } from './SessionStateParser';
import type { SessionStateInput } from './SessionStateInput';

export const migrateLegacyBeatTheHouseSession = (input: {
  readonly value: SessionStateInput;
  readonly profileBankroll: number;
  readonly freshBeatSaveState: BeatTheHouseSaveStateV3;
  readonly port: LegacyBeatMigrationPort;
}): { readonly session?: CasinoSessionStateV3; readonly migration: LegacyBeatMigrationResult } => {
  const legacy = parseSessionStateV2(input.value);
  const isLegacyBeatPhase = (value: string | undefined): value is LegacyBeatPhase =>
    value === 'betting' || value === 'dealing' || value === 'playing' || value === 'dealer' || value === 'roundOver';
  const legacyBeatEvidence = (session: ReturnType<typeof parseSessionStateV2>): LegacyBeatSessionEvidence | undefined => {
    if (session.activeGame !== 'beat-the-house' && !session.gameSnapshot?.beatTheHouse) {
      return undefined;
    }
    const snapshot = session.gameSnapshot?.beatTheHouse;
    const phase = snapshot?.phase;
    if (!isLegacyBeatPhase(phase)) {
      return undefined;
    }
    const bets = snapshot?.bets;
    const dealerTips = snapshot?.dealerTips;
    const summaries = snapshot?.summaries;
    if (!bets || !dealerTips || !Array.isArray(summaries)) {
      return undefined;
    }
    let snapshotTableCredits = 0;
    for (const handBets of Object.values(bets)) {
      if (!handBets) {
        return undefined;
      }
      for (const amount of Object.values(handBets)) {
        snapshotTableCredits += SessionStateParser.safeMoney(amount);
      }
    }
    for (const amount of Object.values(dealerTips)) {
      snapshotTableCredits += SessionStateParser.safeMoney(amount);
    }
    return {
      migrationKey: 'beat-v2-to-v3',
      profileId: session.profileId,
      phase,
      snapshotTableCredits,
      snapshotHasSummary: Boolean(summaries.length),
    };
  };
  const isAllowedMigration = (evidence: LegacyBeatSessionEvidence, migration: LegacyBeatMigrationResult): boolean => {
    if (migration.status === 'blocked' || !Number.isSafeInteger(migration.refundedWholeCredits) || migration.refundedWholeCredits < 0) {
      return false;
    }
    if (migration.status === 'already-migrated') {
      return migration.refundedWholeCredits === 0;
    }
    if (evidence.phase === 'roundOver') {
      return migration.refundedWholeCredits === 0;
    }
    if (evidence.phase === 'betting' && evidence.snapshotTableCredits === 0) {
      return migration.refundedWholeCredits === 0;
    }
    return migration.refundedWholeCredits > 0;
  };
  const emptyBets: BeatTheHouseSaveStateV3['bets'] = {
    left: { main: 0, aceFlash: 0, dealerBust: 0, matchPush: 0, dealerSevens: 0 },
    centre: { main: 0, aceFlash: 0, dealerBust: 0, matchPush: 0, dealerSevens: 0 },
    right: { main: 0, aceFlash: 0, dealerBust: 0, matchPush: 0, dealerSevens: 0 },
  };
  const emptyDealerTips: BeatTheHouseSaveStateV3['dealerTips'] = { left: 0, centre: 0, right: 0 };
  const { lastBets: _legacyLastBets, ...freshState } = input.freshBeatSaveState;
  const buildSession = (bankroll: number): CasinoSessionStateV3 =>
    parseSessionStateV3({
      ...legacy,
      version: 3,
      gameSnapshot: {
        ...legacy.gameSnapshot,
        beatTheHouse: {
          ...freshState,
          phase: 'betting',
          bankroll: SessionStateParser.safeMoney(bankroll),
          bets: emptyBets,
          dealerTips: emptyDealerTips,
          dealerTipRewards: emptyDealerTips,
          activeHand: undefined,
          summaries: [],
        },
      },
    });

  const evidence = legacyBeatEvidence(legacy);
  if (!evidence) {
    return { migration: { status: 'blocked', refundedWholeCredits: 0, reason: 'Legacy Beat the House phase is not recoverable.' } };
  }

  const validatedSession = buildSession(input.profileBankroll);
  const migration = input.port.migrateLegacyBeatTheHouseSession(evidence);
  if (!isAllowedMigration(evidence, migration)) {
    return {
      migration: {
        ...migration,
        status: 'blocked',
        refundedWholeCredits: 0,
        reason: migration.reason ?? 'Legacy Beat the House migration evidence is incomplete.',
      },
    };
  }

  const session = migration.profile ? buildSession(migration.profile.bankroll) : validatedSession;
  return { session, migration };
};
