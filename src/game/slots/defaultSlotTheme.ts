import type { SlotTheme } from './SlotTheme';
import { hexColourSchema } from '../../schemas/casinoSchemas/hexColourSchema';
import { slotThemeIdSchema } from '../../schemas/casinoSchemas/slotThemeIdSchema';

export const defaultSlotTheme: SlotTheme = {
  id: slotThemeIdSchema.parse('thai-princess'),
  title: 'Thai Princess',
  accent: hexColourSchema.parse('#f4bf58'),
  columns: 3,
  rows: 5,
  wildSymbol: 'princess',
  reelStrip: [
    'princess',
    'lotus',
    'elephant',
    'temple',
    'fan',
    'orchid',
    'lotus',
    'elephant',
    'temple',
    'fan',
    'princess',
    'orchid',
    'lotus',
    'temple',
    'fan',
    'elephant',
    'orchid',
    'princess',
    'lotus',
    'temple',
  ],
  payouts: {
    princess: 200,
    elephant: 40,
    temple: 35,
    fan: 24,
    orchid: 16,
  },
  jackpots: {
    mini: { symbol: 'fan', multiplier: 24, label: 'Fan' },
    minor: { symbol: 'temple', multiplier: 35, label: 'Temple' },
    major: { symbol: 'elephant', multiplier: 40, label: 'Elephant' },
    grand: { symbol: 'princess', multiplier: 200, label: 'Princess' },
  },
  bonus: {
    triggerSymbol: 'lotus',
    picks: 4,
    freeSpinsOnTwoBonus: 8,
    multipliers: [5, 8, 12, 16, 20, 32, 50, 75],
  },
};
