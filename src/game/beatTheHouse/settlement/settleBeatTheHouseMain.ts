import { isBlackAce } from '../../cards/isBlackAce';
import { rankValue } from '../../cards/rankValue';
import { isCard } from '../../blackjackTable/isCard';
import { asHalfUnits } from '../asHalfUnits';
import { beatTheHouseRules } from '../beatTheHouseRules';
import { calculateHalfUnitPayout } from '../calculateHalfUnitPayout';
import { wholeChipToHalfUnits } from '../wholeChipToHalfUnits';
import type { BeatTheHouseMainSettlement } from './BeatTheHouseMainSettlement';
import type { BeatTheHouseMainSettlementInput } from './BeatTheHouseMainSettlementInput';

export const settleBeatTheHouseMain = (input: BeatTheHouseMainSettlementInput): BeatTheHouseMainSettlement => {
  const resultFor = (): 'lose' | 'push' | 'win' => {
    if (input.playerMode === 'immediateLoss') {
      return 'lose';
    }
    if (input.playerMode === 'automaticWin') {
      return 'win';
    }
    if (isBlackAce(input.dealerFirstCard)) {
      return 'lose';
    }
    if (input.dealerBust) {
      return 'win';
    }
    if (!input.playerFinalCard || !input.dealerFinalCard) {
      throw new Error('Comparable player and dealer states require final cards.');
    }
    const playerValue = rankValue(input.playerFinalCard.rank);
    const dealerValue = rankValue(input.dealerFinalCard.rank);
    return playerValue > dealerValue ? 'win' : playerValue === dealerValue ? 'push' : 'lose';
  };

  if (
    !isCard(input.playerFirstCard) ||
    !isCard(input.dealerFirstCard) ||
    (input.playerFinalCard !== undefined && !isCard(input.playerFinalCard)) ||
    (input.dealerFinalCard !== undefined && !isCard(input.dealerFinalCard)) ||
    typeof input.dealerBust !== 'boolean'
  ) {
    throw new Error('Beat the House main settlement cards are invalid.');
  }

  const stakeHalfUnits = wholeChipToHalfUnits(input.mainStake);
  if (stakeHalfUnits <= 0) {
    throw new Error('Beat the House main settlement stake must be positive.');
  }
  if (input.playerMode === 'automaticWin' && !isBlackAce(input.playerFirstCard)) {
    throw new Error('Automatic player wins require a first-card black Ace.');
  }
  if (input.playerMode === 'compare' && (input.playerFirstCard.rank === '2' || isBlackAce(input.playerFirstCard) || !input.playerFinalCard)) {
    throw new Error('Comparable player states are invalid.');
  }
  if (input.playerMode === 'immediateLoss' && isBlackAce(input.playerFirstCard)) {
    throw new Error('A first-card black Ace cannot be an immediate player loss.');
  }
  if (input.dealerBust && isBlackAce(input.dealerFirstCard)) {
    throw new Error('A dealer black Ace cannot also be a dealer bust.');
  }
  if (!input.dealerBust && input.dealerFirstCard.rank === '2') {
    throw new Error('A dealer first-card 2 must bust.');
  }
  if (!input.dealerBust && !isBlackAce(input.dealerFirstCard) && !input.dealerFinalCard) {
    throw new Error('A live dealer hand requires a final card.');
  }

  const result = resultFor();
  const ordinaryProfitRatio = { numerator: 1, denominator: 1 } as const;
  const returnedHalfUnits =
    result === 'win'
      ? calculateHalfUnitPayout(input.mainStake, input.playerMode === 'automaticWin' ? beatTheHouseRules.blackAceProfitRatio : ordinaryProfitRatio)
          .returnedHalfUnits
      : result === 'push'
        ? stakeHalfUnits
        : asHalfUnits(0);
  return {
    result,
    stakeHalfUnits,
    returnedHalfUnits,
    profitHalfUnits: asHalfUnits(returnedHalfUnits - stakeHalfUnits),
  };
};
