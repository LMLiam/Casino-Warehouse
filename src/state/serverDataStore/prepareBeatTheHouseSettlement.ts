import type { HalfUnits } from '../../game/beatTheHouse/HalfUnits';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import { recordTransaction } from '../profiles/recordTransaction';
import { reduceHouseAdvanceBalance } from '../profiles/reduceHouseAdvanceBalance';
import type { BeatTheHouseSettlementContext } from './BeatTheHouseSettlementContext';
import type { BeatTheHouseSettlementReceipt } from './BeatTheHouseSettlementReceipt';
import type { BeatTheHouseSettlementTransition } from './BeatTheHouseSettlementTransition';
import { validateBeatTheHouseSettlement } from './validateBeatTheHouseSettlement';

export const prepareBeatTheHouseSettlement = (
  profile: CasinoProfile,
  returnedHalfUnits: HalfUnits,
  profitHalfUnits: HalfUnits,
  context: BeatTheHouseSettlementContext,
): BeatTheHouseSettlementTransition => {
  const houseAdvanceRepaymentNumerator = 1;
  const houseAdvanceRepaymentDenominator = 10;
  validateBeatTheHouseSettlement(returnedHalfUnits, profitHalfUnits, context);

  const halfChipBefore = profile.gameCredits.beatTheHouseHalfChip;
  if (halfChipBefore !== 0 && halfChipBefore !== 1) {
    throw new Error('The profile Beat the House residual is invalid.');
  }
  if (!Number.isSafeInteger(profile.bankroll) || profile.bankroll < 0) {
    throw new Error('The profile bankroll is not a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(profile.houseAdvance.outstandingBalance) || profile.houseAdvance.outstandingBalance < 0) {
    throw new Error('The profile House Advance balance is not a non-negative safe integer.');
  }

  const totalHalfUnits = halfChipBefore + returnedHalfUnits;
  if (!Number.isSafeInteger(totalHalfUnits)) {
    throw new Error('Beat the House residual arithmetic is unsafe.');
  }
  const wholeCreditsReleased = Math.floor(totalHalfUnits / 2);
  const halfChipAfter: 0 | 1 = totalHalfUnits % 2 === 0 ? 0 : 1;
  const wholeNetWinnings = Math.floor(Math.max(0, profitHalfUnits) / 2);
  const repaymentBase =
    profile.houseAdvance.outstandingBalance <= 0 || wholeNetWinnings <= 0
      ? 0
      : Math.min(
          profile.houseAdvance.outstandingBalance,
          Math.max(1, Math.floor((wholeNetWinnings * houseAdvanceRepaymentNumerator) / houseAdvanceRepaymentDenominator)),
        );
  const houseAdvanceRepayment = Math.min(wholeCreditsReleased, repaymentBase);
  const bankrollBeforeRepayment = profile.bankroll + wholeCreditsReleased;
  const bankrollAfter = bankrollBeforeRepayment - houseAdvanceRepayment;
  if (!Number.isSafeInteger(bankrollBeforeRepayment) || !Number.isSafeInteger(bankrollAfter) || bankrollAfter < 0) {
    throw new Error('Beat the House bankroll arithmetic is unsafe.');
  }

  const houseAdvanceAfter = reduceHouseAdvanceBalance(profile.houseAdvance, houseAdvanceRepayment);
  const gameCredits = { beatTheHouseHalfChip: halfChipAfter } as const;
  const grossProfile = {
    ...profile,
    bankroll: bankrollBeforeRepayment,
    gameCredits,
    houseAdvance: houseAdvanceAfter,
  };
  const now = new Date();
  const updated =
    houseAdvanceRepayment > 0
      ? recordTransaction(
          grossProfile,
          {
            gameId: context.gameId,
            roomId: context.roomId,
            sessionId: context.sessionId,
            type: 'house_advance_repayment',
            amount: -houseAdvanceRepayment,
            description: `House Advance repayment withheld from ${context.gameId} net winnings.`,
            metadata: {
              returnedHalfUnits,
              profitHalfUnits,
              halfChipBefore,
              halfChipAfter,
              wholeCreditsReleased,
              houseAdvanceRepayment,
              outstandingBefore: profile.houseAdvance.outstandingBalance,
              outstandingAfter: houseAdvanceAfter.outstandingBalance,
            },
          },
          now,
        )
      : { ...grossProfile, updatedAt: createIsoTimestamp(now) };

  if (updated.bankroll !== bankrollAfter || updated.gameCredits.beatTheHouseHalfChip !== halfChipAfter) {
    throw new Error('Beat the House settlement produced an inconsistent profile.');
  }

  const receipt: BeatTheHouseSettlementReceipt = {
    settlementKey: context.settlementKey,
    profileId: profile.id,
    profileCreatedAt: profile.createdAt,
    gameId: 'beat-the-house',
    ...(context.roomId === undefined ? {} : { roomId: context.roomId }),
    ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
    returnedHalfUnits,
    profitHalfUnits,
    halfChipBefore,
    halfChipAfter,
    wholeCreditsReleased,
    houseAdvanceRepayment,
    bankrollAfter,
    houseAdvanceAfter,
  };

  return { profile: updated, receipt };
};
