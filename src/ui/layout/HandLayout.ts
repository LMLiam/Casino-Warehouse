import type { BetType } from '../../game/types/BetType';
import type { HandId } from '../../game/types/HandId';
import type { PointPercent } from './PointPercent';
import type { RectPercent } from './RectPercent';

export interface HandLayout {
  readonly id: HandId;
  readonly label: string;
  readonly cards: readonly PointPercent[];
  readonly marker: PointPercent;
  readonly popup: PointPercent;
  readonly zones: Record<BetType, RectPercent>;
}
