export const isSideBetWithinMainBet = (mainBet: number, currentSideBet: number, additionalSideBet: number): boolean =>
  Number.isFinite(mainBet) &&
  Number.isFinite(currentSideBet) &&
  Number.isFinite(additionalSideBet) &&
  mainBet >= 0 &&
  currentSideBet >= 0 &&
  additionalSideBet >= 0 &&
  currentSideBet + additionalSideBet <= mainBet;
