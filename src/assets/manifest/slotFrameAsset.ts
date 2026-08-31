import type { CasinoAsset } from './CasinoAsset';
import { casinoAssets } from './casinoAssets';
import type { SlotThemeId } from '../../schemas/casinoSchemas/SlotThemeId';

export const slotFrameAsset = (themeId: SlotThemeId): CasinoAsset => {
  const asset = casinoAssets.slotFrames[themeId];
  if (!asset) {
    throw new Error(`Slot frame asset is missing for ${themeId}.`);
  }
  return asset;
};
