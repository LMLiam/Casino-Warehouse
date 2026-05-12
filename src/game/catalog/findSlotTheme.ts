import { defaultSlotTheme } from '../slots/defaultSlotTheme';
import type { SlotTheme } from '../slots/SlotTheme';
import type { CasinoGameId } from '../ids';
import { findGame } from './findGame';

export const findSlotTheme = (gameId: CasinoGameId): SlotTheme => findGame(gameId).slotTheme ?? defaultSlotTheme;
