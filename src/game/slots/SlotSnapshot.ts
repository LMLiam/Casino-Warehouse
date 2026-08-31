import type { JackpotWin } from './JackpotWin';
import type { SlotThemeId } from '../../schemas/casinoSchemas/SlotThemeId';
import type { SlotPhase } from './SlotPhase';
import type { SlotSymbol } from './SlotSymbol';

export interface SlotSnapshot {
  readonly themeId: SlotThemeId;
  readonly themeTitle: string;
  readonly phase: SlotPhase;
  readonly wager: number;
  readonly columns: number;
  readonly rows: number;
  readonly reels: readonly SlotSymbol[];
  readonly lineWin: number;
  readonly jackpotWin?: JackpotWin | undefined;
  readonly bonusPicksRemaining: number;
  readonly freeSpinsRemaining: number;
  readonly bonusBank: number;
  readonly returned: number;
  readonly status: string;
}
