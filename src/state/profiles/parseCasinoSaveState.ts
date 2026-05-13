import { casinoSaveStateEnvelopeSchema } from '../../schemas/casinoSchemas/casinoSaveStateEnvelopeSchema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSaveState } from './CasinoSaveState';
import { currentProfileStoreVersion } from './currentProfileStoreVersion';
import { parseCasinoProfile } from './parseCasinoProfile';

export const parseCasinoSaveState = (value: unknown): CasinoSaveState => {
  const parsed = casinoSaveStateEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Save data is not a casino profile store: ${zodErrorSummary(parsed.error)}`);
  }

  return {
    version: currentProfileStoreVersion,
    profiles: parsed.data.profiles.map(parseCasinoProfile),
  };
};
