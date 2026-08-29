import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import { sessionStateSchema } from '../../schemas/casinoSchemas/sessionStateSchema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionState } from './CasinoSessionState';
import type { ParseError } from '../ParseError';
import type { Result } from '../Result';

export const parseSessionState = (value: JsonValue | CasinoSessionState): Result<CasinoSessionState, ParseError> => {
  const parsed = sessionStateSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: new Error(`Session data is not valid: ${zodErrorSummary(parsed.error)}`) };
  }
  return { ok: true, value: parsed.data };
};
