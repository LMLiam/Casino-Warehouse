import { profileStoreV1Schema } from '../../schemas/casinoSchemas/profileStoreV1Schema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSaveState } from './CasinoSaveState';
import { currentProfileStoreVersion } from './currentProfileStoreVersion';
import { parseCasinoProfile } from './parseCasinoProfile';

export const parseProfileStoreV1 = (value: unknown): CasinoSaveState => {
  const parsed = profileStoreV1Schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Profile store v1 data is not valid: ${zodErrorSummary(parsed.error)}`);
  }

  return {
    version: currentProfileStoreVersion,
    profiles: parsed.data.profiles.map(parseCasinoProfile),
  };
};
