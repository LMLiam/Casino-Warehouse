import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import { sessionStateSchema } from '../../schemas/casinoSchemas/sessionStateSchema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionState } from './CasinoSessionState';

export const parseSessionState = (value: JsonValue | CasinoSessionState): CasinoSessionState => {
  const parsed = sessionStateSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Session data is not valid: ${zodErrorSummary(parsed.error)}`);
  }
  return parsed.data;
};
