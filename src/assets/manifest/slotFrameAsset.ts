import type { CasinoAsset } from './CasinoAsset';
import { casinoAssets } from './casinoAssets';

export const slotFrameAsset = (themeId: string): CasinoAsset => casinoAssets.slotFrames[themeId as keyof typeof casinoAssets.slotFrames];
