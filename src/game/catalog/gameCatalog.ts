import { beatTheHouseRules } from '../beatTheHouse/beatTheHouseRules';
import { gameCatalogSchema } from '../../schemas/casinoSchemas/gameCatalogSchema';
import { hexColourSchema } from '../../schemas/casinoSchemas/hexColourSchema';
import { roomGameIdSchema } from '../../schemas/casinoSchemas/roomGameIdSchema';
import type { GameCatalogEntry } from './GameCatalogEntry';
import { slotThemes } from './slotThemes';

export const gameCatalog: readonly GameCatalogEntry[] = [
  {
    id: 'beat-the-house',
    title: 'Beat the House',
    kind: 'beat-the-house',
    description: 'Multi-hand Beat the House table with side bets.',
    accent: hexColourSchema.parse('#ffd56b'),
    rules: [
      `Play up to three hands at once, each with independent main and side bets.`,
      `One persistent ${beatTheHouseRules.deckCount}-deck shoe holds ${beatTheHouseRules.cardsPerShoe} cards.`,
      `A cut threshold is uniformly selected from ${beatTheHouseRules.cutThreshold.minimum} through ${beatTheHouseRules.cutThreshold.maximum} cards dealt, about 70.2% through 75% penetration.`,
      `The active round finishes after the cut, and the shoe shuffles before the next deal.`,
      `The dealer hits ranks 3 through 9 and stands on 10, J, Q, K, and A.`,
      `A player first card of 2 loses immediately. A dealer 2 causes a dealer bust and every live hand wins.`,
      `Players and the dealer have a ${beatTheHouseRules.maximumPlayerCards}-card maximum, and ties push.`,
      `Each side-bet type can equal, but cannot exceed, the main bet on that hand.`,
      `Wagers and Dealer's Thanks remain whole-chip. Each profile can hold zero or one Beat the House half-chip. Two half-chips release one whole chip automatically, and the residual is not wagerable.`,
      `Credits are fictional, have no cash value, and do not support deposits, withdrawals, cash-out, crypto, or commercial gambling.`,
    ],
    paytable: [
      `Main wins pay 1:1 profit and pushes return the main wager.`,
      `A first-card black Ace pays ${beatTheHouseRules.blackAceProfitRatio.numerator}:${beatTheHouseRules.blackAceProfitRatio.denominator} profit, including when the dealer also has a first-card black Ace.`,
      `Ace Flash pays ${beatTheHouseRules.sideBetProfitMultipliers.aceFlashSingle}:1 profit for one qualifying black Ace and ${beatTheHouseRules.sideBetProfitMultipliers.aceFlashBoth}:1 profit for two.`,
      `Dealer Bust pays ${beatTheHouseRules.sideBetProfitMultipliers.dealerBust}:1 profit. Match Push pays ${beatTheHouseRules.sideBetProfitMultipliers.matchPush}:1 profit.`,
      `Dealer Sevens pays ${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensOne}:1, ${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensTwo}:1, ${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensThree}:1, or ${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensFour}:1 profit for one through four qualifying dealer sevens.`,
    ],
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    kind: 'blackjack',
    description: 'Standalone Blackjack table with dealer rules.',
    accent: hexColourSchema.parse('#75ff92'),
    rules: [
      'Beat the dealer without going over 21.',
      'The dealer reveals the hole card after the player stands or busts.',
      'Dealer stands on soft 17 and hard 17 or higher.',
    ],
    paytable: ['Blackjack pays 3:2.', 'Regular wins pay 1:1.', 'Pushes return the wager.'],
  },
  ...slotThemes.map(
    (slotTheme): GameCatalogEntry => ({
      id: roomGameIdSchema.parse(`slots:${slotTheme.id}`),
      title: slotTheme.title,
      kind: 'slots',
      description: 'Themed slot machine with jackpots and bonus picks.',
      accent: slotTheme.accent,
      rules: [
        `${slotTheme.title} uses a ${slotTheme.columns} column by ${slotTheme.rows} row grid with ${slotTheme.bonus.triggerSymbol} scatter-style bonus symbols.`,
        ...(slotTheme.wildSymbol ? [`${slotTheme.wildSymbol} symbols act as wilds on left-to-right line wins.`] : []),
        `Three ${slotTheme.bonus.triggerSymbol} symbols open a ${slotTheme.bonus.picks}-pick bonus.`,
        `Two ${slotTheme.bonus.triggerSymbol} symbols award ${slotTheme.bonus.freeSpinsOnTwoBonus} free spins.`,
        'Free spins use the current wager without another bankroll debit.',
      ],
      paytable: [
        ...Object.entries(slotTheme.jackpots).map(([, jackpot]) => `${jackpot.label}: three ${jackpot.symbol} symbols pay ${jackpot.multiplier}:1.`),
        ...Object.entries(slotTheme.payouts).map(([symbol, multiplier]) => `Three ${symbol} symbols pay ${multiplier}:1.`),
        ...(slotTheme.wildSymbol ? [`${slotTheme.wildSymbol} substitutes for every paying symbol except ${slotTheme.bonus.triggerSymbol}.`] : []),
        `Bonus picks can award ${slotTheme.bonus.multipliers.join(', ')}x the wager.`,
      ],
      slotTheme,
    }),
  ),
];

gameCatalogSchema.parse(gameCatalog);
