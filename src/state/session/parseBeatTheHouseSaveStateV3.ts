import { beatTheHouseRules } from '../../game/beatTheHouse/beatTheHouseRules';
import { isCard } from '../../game/blackjackTable/isCard';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { BeatTheHouseSaveStateV3 } from './BeatTheHouseSaveStateV3';
import type { BeatTheHouseShoeSaveState } from '../../game/beatTheHouse/shoe/BeatTheHouseShoeSaveState';
import { validateBeatTheHouseShoeSaveState } from '../../game/beatTheHouse/shoe/validateBeatTheHouseShoeSaveState';

export const parseBeatTheHouseSaveStateV3 = (
  value:
    | BeatTheHouseSaveState
    | BeatTheHouseSaveStateV3
    | {
        readonly shoe?:
          | BeatTheHouseShoeSaveState
          | {
              readonly remainingCards?: readonly Parameters<typeof isCard>[0][];
              readonly totalCards?: number;
              readonly cutThresholdCardsDealt?: number;
              readonly shufflePending?: boolean;
            }
          | null;
        readonly deck?: readonly Parameters<typeof isCard>[0][];
      }
    | null
    | undefined,
): BeatTheHouseSaveStateV3 | undefined => {
  const isShoeSaveState = (
    candidate:
      | BeatTheHouseShoeSaveState
      | {
          readonly remainingCards?: readonly Parameters<typeof isCard>[0][];
          readonly totalCards?: number;
          readonly cutThresholdCardsDealt?: number;
          readonly shufflePending?: boolean;
        }
      | null
      | undefined,
  ): candidate is BeatTheHouseShoeSaveState =>
    candidate !== null && candidate !== undefined && Array.isArray(candidate.remainingCards) && candidate.remainingCards.every(isCard);

  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || !('shoe' in value) || 'deck' in value) {
    throw new Error('Beat the House session v3 save state is not valid.');
  }

  const shoe = value.shoe;
  if (!isShoeSaveState(shoe)) {
    throw new Error('Beat the House session v3 shoe is not valid.');
  }
  validateBeatTheHouseShoeSaveState(shoe);
  if (shoe.totalCards !== beatTheHouseRules.cardsPerShoe) {
    throw new Error('Beat the House session v3 shoe must contain a six-deck capacity.');
  }
  return value as BeatTheHouseSaveStateV3;
};
