import type { AssetCategory } from './AssetCategory';
import type { AssetSource } from './AssetSource';
import type { AssetStatus } from './AssetStatus';

export interface CasinoAsset {
  readonly id: string;
  readonly path: string;
  readonly owner: string;
  readonly category: AssetCategory;
  readonly status: AssetStatus;
  readonly source: AssetSource;
  readonly dimensions: string;
  readonly transparent: boolean;
}
