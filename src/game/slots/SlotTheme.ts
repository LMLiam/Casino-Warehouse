import type { JackpotTier } from './JackpotTier';
import type { SlotSymbol } from './SlotSymbol';
import type { SlotThemeId } from '../../schemas/casinoSchemas/SlotThemeId';
import type { HexColour } from '../../schemas/casinoSchemas/HexColour';

export interface SlotTheme {
  readonly id: SlotThemeId;
  readonly title: string;
  readonly accent: HexColour;
  readonly columns: number;
  readonly rows: number;
  readonly wildSymbol?: SlotSymbol | undefined;
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
