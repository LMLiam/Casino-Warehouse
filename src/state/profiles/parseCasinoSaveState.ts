import { z } from 'zod';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSaveState } from './CasinoSaveState';
import { parseProfileStoreV1 } from './parseProfileStoreV1';

export const parseCasinoSaveState = (value: unknown): CasinoSaveState => {
  const parsed = z.object({ version: z.number().int() }).safeParse(value);
  if (!parsed.success) {
    throw new Error(`Save data is not a casino profile store: ${zodErrorSummary(parsed.error)}`);
  }

  switch (parsed.data.version) {
    case 1:
      return parseProfileStoreV1(value);
    default:
      throw new Error(`Profile store data version ${parsed.data.version} is not supported.`);
  }
};
