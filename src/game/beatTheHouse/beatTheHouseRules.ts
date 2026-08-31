export const beatTheHouseRules = {
  deckCount: 6,
  cardsPerDeck: 52,
  cardsPerShoe: 312,
  cutThreshold: {
    minimum: 219,
    maximum: 234,
  },
  maximumPlayerCards: 4,
  maximumDealerCards: 4,
  dealerDrawMaximumRank: 9,
  blackAceProfitRatio: {
    numerator: 3,
    denominator: 2,
  },
  sideBetProfitMultipliers: {
    aceFlashSingle: 12,
    aceFlashBoth: 60,
    dealerBust: 6,
    matchPush: 9,
    dealerSevensOne: 4,
    dealerSevensTwo: 18,
    dealerSevensThree: 150,
    dealerSevensFour: 1000,
  },
  halfUnitsPerWholeChip: 2,
} as const;
