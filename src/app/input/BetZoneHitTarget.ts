import type { BetType } from '../../game/types/BetType';
import type { HandId } from '../../game/types/HandId';

export type BetZoneHitTarget = { readonly handId: HandId; readonly betType: BetType } | { readonly handId: HandId; readonly dealerTip: true };
