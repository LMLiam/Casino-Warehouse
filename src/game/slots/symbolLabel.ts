import type { SlotSymbol } from './SlotSymbol';

export const symbolLabel = (symbol: SlotSymbol): string =>
  ({
    princess: 'Princess Wild',
    lotus: 'Lotus Scatter',
    elephant: 'Elephant',
    temple: 'Temple',
    fan: 'Fan',
    orchid: 'Orchid',
  })[symbol];
