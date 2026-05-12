import type { SlotTheme } from '../slots/SlotTheme';
import type { CasinoGameId } from '../ids';

export interface GameCatalogEntry {
  readonly id: CasinoGameId;
  readonly title: string;
  readonly kind: 'beat-the-house' | 'blackjack' | 'slots';
  readonly description: string;
  readonly accent: string;
  readonly rules: readonly string[];
  readonly paytable: readonly string[];
  readonly slotTheme?: SlotTheme;
}
