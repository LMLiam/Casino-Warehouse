import type { CasinoAsset } from './CasinoAsset';
import { casinoAssets } from './casinoAssets';

export const allCasinoAssets = (): readonly CasinoAsset[] => [
  casinoAssets.lobbyBackground,
  casinoAssets.beatTheHouseTable,
  casinoAssets.beatTheHouseChips,
  casinoAssets.blackjackTable,
  ...Object.values(casinoAssets.gameTiles),
  ...Object.values(casinoAssets.slotFrames),
  ...Object.values(casinoAssets.slotSymbols),
];
