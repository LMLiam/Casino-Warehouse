import type { SlotSymbol } from '../../game/slots/SlotSymbol';
import type { CasinoAsset } from './CasinoAsset';
import { casinoAssets } from './casinoAssets';

export const slotSymbolAsset = (symbol: SlotSymbol): CasinoAsset => casinoAssets.slotSymbols[symbol];
