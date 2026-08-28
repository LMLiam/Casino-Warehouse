import { casinoSaveStateSchema } from '../../schemas/casinoSchemas/casinoSaveStateSchema';
import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSaveState } from './CasinoSaveState';

export const parseCasinoSaveState = (value: JsonValue | CasinoSaveState): CasinoSaveState => {
  const parsed = casinoSaveStateSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Save data is not a casino profile store: ${zodErrorSummary(parsed.error)}`);
  }
  return parsed.data;
};
