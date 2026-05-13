import type { CasinoGameId } from '../ids';
import { gameCatalogSchema } from '../../schemas/casinoSchemas/gameCatalogSchema';
import type { GameCatalogEntry } from './GameCatalogEntry';
import { slotThemes } from './slotThemes';

export const gameCatalog: readonly GameCatalogEntry[] = [
  {
    id: 'beat-the-house',
    title: 'Beat the House',
    kind: 'beat-the-house',
    description: 'Multi-hand Beat the House table with side bets.',
    accent: '#ffd56b',
    rules: [
      'Play up to three hands at once, each with independent main and side bets.',
      'A first-card black Ace wins automatically; any 2 immediately loses that hand.',
      'After all player hands stand or lose, the dealer draws and every active hand settles.',
    ],
    paytable: [
      'Main wins pay 1:1 and pushes return the main wager.',
      'Ace Flash pays 10:1 for one black Ace and 50:1 when player and dealer both show one.',
      'Dealer Bust, Match Push, and Dealer Sevens pay according to their named side-bet outcomes.',
    ],
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    kind: 'blackjack',
    description: 'Standalone Blackjack table with dealer rules.',
    accent: '#75ff92',
    rules: [
      'Beat the dealer without going over 21.',
      'The dealer reveals the hole card after the player stands or busts.',
      'Dealer stands on soft 17 and hard 17 or higher.',
    ],
    paytable: ['Blackjack pays 3:2.', 'Regular wins pay 1:1.', 'Pushes return the wager.'],
  },
  ...slotThemes.map(
    (slotTheme): GameCatalogEntry => ({
      id: `slots:${slotTheme.id}` as CasinoGameId,
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
