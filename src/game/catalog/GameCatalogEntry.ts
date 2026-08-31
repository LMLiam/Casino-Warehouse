import type { SlotTheme } from '../slots/SlotTheme';
import type { CasinoGameId } from '../ids';
import type { HexColour } from '../../schemas/casinoSchemas/HexColour';

export interface GameCatalogEntry {
  readonly id: CasinoGameId;
  readonly title: string;
  readonly kind: 'beat-the-house' | 'blackjack' | 'slots';
  readonly description: string;
  readonly accent: HexColour;
  readonly rules: readonly string[];
  readonly paytable: readonly string[];
  readonly slotTheme?: SlotTheme;
}
