import { casinoSaveStateSchema } from '../../schemas/casinoSchemas/casinoSaveStateSchema';
import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSaveState } from './CasinoSaveState';
import type { ParseError } from '../ParseError';
import type { Result } from '../Result';

export const parseCasinoSaveState = (value: JsonValue | CasinoSaveState): Result<CasinoSaveState, ParseError> => {
  const parsed = casinoSaveStateSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: new Error(`Save data is not a casino profile store: ${zodErrorSummary(parsed.error)}`) };
  }
  return { ok: true, value: parsed.data };
};
