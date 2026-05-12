import type { JackpotTier } from './JackpotTier';
import type { SlotSymbol } from './SlotSymbol';

export interface SlotTheme {
  readonly id: string;
  readonly title: string;
  readonly accent: string;
  readonly columns: number;
  readonly rows: number;
  readonly wildSymbol?: SlotSymbol;
  readonly reelStrip: readonly SlotSymbol[];
  readonly payouts: Readonly<Partial<Record<SlotSymbol, number>>>;
  readonly jackpots: Readonly<Partial<Record<JackpotTier, { readonly symbol: SlotSymbol; readonly multiplier: number; readonly label: string }>>>;
  readonly bonus: {
    readonly triggerSymbol: SlotSymbol;
    readonly picks: number;
    readonly freeSpinsOnTwoBonus: number;
    readonly multipliers: readonly number[];
  };
}
