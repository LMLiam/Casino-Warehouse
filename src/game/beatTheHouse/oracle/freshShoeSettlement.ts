import { beatTheHouseRules } from '../beatTheHouseRules';
import { calculateHalfUnitPayout } from '../calculateHalfUnitPayout';
import type { FreshShoeSettlementInput } from './FreshShoeSettlementInput';
import { freshShoeCardKinds } from './freshShoeCardKinds';

export const freshShoeSettlement = (input: FreshShoeSettlementInput): number => {
  const mainResultFor = (): 'lose' | 'push' | 'win' => {
    if (input.mainMode === 'lose' || input.dealer.blackAce) {
      return 'lose';
    }
    if (input.dealer.bust) {
      return 'win';
    }
    if (input.playerFinalKind === undefined || input.dealer.finalKind === undefined) {
      return 'lose';
    }
    const playerValue = freshShoeCardKinds[input.playerFinalKind]?.value;
    const dealerValue = freshShoeCardKinds[input.dealer.finalKind]?.value;
    if (playerValue === undefined || dealerValue === undefined) {
      throw new Error('Oracle settlement final card kind is invalid.');
    }
    return playerValue > dealerValue ? 'win' : playerValue === dealerValue ? 'push' : 'lose';
  };
  const sideReturn = (ratio: number, multiplier: number): number => {
    if (ratio === 0 || multiplier === 0) {
      return 0;
    }
    const returnedPerWholeSideStake = calculateHalfUnitPayout(1, { numerator: multiplier, denominator: 1 }).returnedHalfUnits;
    return (input.context.mainStake * ratio * returnedPerWholeSideStake) / beatTheHouseRules.halfUnitsPerWholeChip;
  };
  const aceFlashMultiplier = (playerBlackAce: boolean, dealerBlackAce: boolean): number => {
    if (!input.context.sideBetRatios.aceFlash) {
      return 0;
    }
    return playerBlackAce && dealerBlackAce
      ? beatTheHouseRules.sideBetProfitMultipliers.aceFlashBoth
      : playerBlackAce || dealerBlackAce
        ? beatTheHouseRules.sideBetProfitMultipliers.aceFlashSingle
        : 0;
  };
  const matchPushApplies = (mainResult: 'lose' | 'push' | 'win'): boolean =>
    mainResult !== 'lose' &&
    !input.dealer.bust &&
    !input.dealer.blackAce &&
    input.playerFinalKind !== undefined &&
    input.dealer.finalKind !== undefined &&
    freshShoeCardKinds[input.playerFinalKind]?.value === freshShoeCardKinds[input.dealer.finalKind]?.value;
  const dealerSevensMultiplier = (sevenCount: number): number =>
    sevenCount === 1
      ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensOne
      : sevenCount === 2
        ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensTwo
        : sevenCount === 3
          ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensThree
          : sevenCount === 4
            ? beatTheHouseRules.sideBetProfitMultipliers.dealerSevensFour
            : 0;

  const playerFirst = freshShoeCardKinds[input.playerFirstKind];
  const dealerFirst = freshShoeCardKinds[input.dealer.firstKind];
  if (!playerFirst || !dealerFirst) {
    throw new Error('Oracle settlement card kind is invalid.');
  }

  const mainResult = input.mainMode === 'automaticWin' ? 'win' : mainResultFor();
  const mainReturned =
    mainResult === 'win'
      ? calculateHalfUnitPayout(
          input.context.mainStake,
          input.mainMode === 'automaticWin' ? beatTheHouseRules.blackAceProfitRatio : { numerator: 1, denominator: 1 },
        ).returnedHalfUnits / beatTheHouseRules.halfUnitsPerWholeChip
      : mainResult === 'push'
        ? input.context.mainStake
        : 0;

  const sideReturned =
    sideReturn(input.context.sideBetRatios.aceFlash, aceFlashMultiplier(playerFirst.isBlackAce, dealerFirst.isBlackAce)) +
    sideReturn(input.context.sideBetRatios.dealerBust, input.dealer.bust ? beatTheHouseRules.sideBetProfitMultipliers.dealerBust : 0) +
    sideReturn(input.context.sideBetRatios.matchPush, matchPushApplies(mainResult) ? beatTheHouseRules.sideBetProfitMultipliers.matchPush : 0) +
    sideReturn(input.context.sideBetRatios.dealerSevens, dealerSevensMultiplier(input.dealer.sevenCount));

  return mainReturned + sideReturned;
};
