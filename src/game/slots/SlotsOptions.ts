import type { Rng } from '../rng/Rng';
import type { SlotTheme } from './SlotTheme';

export interface SlotsOptions {
  readonly rng?: Rng;
  readonly theme?: SlotTheme;
}
