import type { BeatTheHouseSettlementContext } from './BeatTheHouseSettlementContext';

export const validateBeatTheHouseSettlement = (returnedHalfUnits: number, profitHalfUnits: number, context: BeatTheHouseSettlementContext): void => {
  if (context.gameId !== 'beat-the-house') {
    throw new Error('Beat the House settlements require the Beat the House game context.');
  }
  if (typeof context.settlementKey !== 'string' || context.settlementKey.length === 0) {
    throw new Error('Beat the House settlements require a non-empty settlement key.');
  }
  if (!Number.isSafeInteger(returnedHalfUnits) || returnedHalfUnits < 0) {
    throw new Error('Returned Beat the House half-units must be non-negative safe integers.');
  }
  if (!Number.isSafeInteger(profitHalfUnits)) {
    throw new Error('Beat the House profit half-units must be safe integers.');
  }

  const stakeHalfUnits = returnedHalfUnits - profitHalfUnits;
  if (!Number.isSafeInteger(stakeHalfUnits) || stakeHalfUnits < 0 || stakeHalfUnits % 2 !== 0) {
    throw new Error('Beat the House return and profit must describe a whole-chip stake.');
  }
};
