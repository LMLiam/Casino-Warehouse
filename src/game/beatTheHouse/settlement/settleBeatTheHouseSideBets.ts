import { isBlackAce } from '../../cards/isBlackAce';
import { rankValue } from '../../cards/rankValue';
import { isCard } from '../../blackjackTable/isCard';
import { asHalfUnits } from '../asHalfUnits';
import { asNonNegativeHalfUnits } from '../asNonNegativeHalfUnits';
import { beatTheHouseRules } from '../beatTheHouseRules';
import { calculateHalfUnitPayout } from '../calculateHalfUnitPayout';
import { wholeChipToHalfUnits } from '../wholeChipToHalfUnits';
import type { BeatTheHouseSideSettlement } from './BeatTheHouseSideSettlement';
import type { BeatTheHouseSideSettlementInput } from './BeatTheHouseSideSettlementInput';
import type { BeatTheHouseSideWin } from './BeatTheHouseSideWin';
import { sideBetTypes } from '../../types/sideBetTypes';

export const settleBeatTheHouseSideBets = (input: BeatTheHouseSideSettlementInput): BeatTheHouseSideSettlement => {
  const dealerFirstCard = input.dealer.cards[0];
  if (
    !isCard(input.playerFirstCard) ||
    !dealerFirstCard ||
    !isCard(dealerFirstCard) ||
    input.dealer.cards.length > beatTheHouseRules.maximumDealerCards ||
    input.dealer.bust !== input.dealer.cards.some((card) => card.rank === '2') ||
    input.dealer.blackAce !== isBlackAce(dealerFirstCard) ||
    input.dealer.cards.some((card) => !isCard(card)) ||
    (input.playerFinalCard !== undefined && !isCard(input.playerFinalCard)) ||
    (input.dealer.finalCard !== undefined && !isCard(input.dealer.finalCard))
  ) {
    throw new Error('Beat the House side settlement state is invalid.');
  }

  const stakeHalfUnits = asNonNegativeHalfUnits(sideBetTypes.reduce((total, betType) => total + wholeChipToHalfUnits(input.sideBets[betType]), 0));
  const wins: BeatTheHouseSideWin[] = [];
  const addWin = (betType: BeatTheHouseSideWin['betType'], multiplier: number): void => {
    const stake = input.sideBets[betType];
    if (stake <= 0 || multiplier <= 0) {
      return;
    }
    const payout = calculateHalfUnitPayout(stake, { numerator: multiplier, denominator: 1 });
    wins.push({ betType, ...payout });
  };

  const playerBlackAce = isBlackAce(input.playerFirstCard);
  const dealerBlackAce = isBlackAce(dealerFirstCard);
  if (playerBlackAce || dealerBlackAce) {
    addWin(
      'aceFlash',
      playerBlackAce && dealerBlackAce ? beatTheHouseRules.sideBetProfitMultipliers.aceFlashBoth : beatTheHouseRules.sideBetProfitMultipliers.aceFlashSingle,
    );
  }
  if (input.dealer.bust) {
    addWin('dealerBust', beatTheHouseRules.sideBetProfitMultipliers.dealerBust);
  }
  if (
    input.mainResult !== 'lose' &&
    !input.dealer.bust &&
    !input.dealer.blackAce &&
    input.playerFinalCard &&
    input.dealer.finalCard &&
    rankValue(input.playerFinalCard.rank) === rankValue(input.dealer.finalCard.rank)
  ) {
    addWin('matchPush', beatTheHouseRules.sideBetProfitMultipliers.matchPush);
  }

  const sevenCount = input.dealer.cards.filter((card) => card.rank === '7').length;
  const dealerSevensMultiplier =
    sevenCount === 1
      ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensOne
      : sevenCount === 2
        ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensTwo
        : sevenCount === 3
          ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensThree
          : sevenCount === 4
            ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensFour
            : 0;
  addWin('dealerSevens', dealerSevensMultiplier);

  const returnedHalfUnits = asNonNegativeHalfUnits(wins.reduce((total, win) => total + win.returnedHalfUnits, 0));
  return {
    wins,
    stakeHalfUnits,
    returnedHalfUnits,
    profitHalfUnits: asHalfUnits(returnedHalfUnits - stakeHalfUnits),
  };
};
