import type { AssetCategory } from './AssetCategory';
import type { AssetSource } from './AssetSource';
import type { AssetStatus } from './AssetStatus';
import type { CasinoAsset } from './CasinoAsset';

export function createCasinoAsset(
  id: string,
  path: string,
  owner: string,
  category: AssetCategory,
  status: AssetStatus,
  source: AssetSource,
  dimensions: string,
  transparent = false,
): CasinoAsset {
  return {
    id,
    path,
    owner,
    category,
    status,
    source,
    dimensions,
    transparent,
  };
}
