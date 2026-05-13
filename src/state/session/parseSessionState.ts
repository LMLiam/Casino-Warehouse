import { z } from 'zod';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionState } from './CasinoSessionState';
import { parseSessionStateV1 } from './parseSessionStateV1';

export const parseSessionState = (value: unknown): CasinoSessionState => {
  const parsed = z.object({ version: z.number().int() }).safeParse(value);
  if (!parsed.success) {
    throw new Error(`Session data is not valid. ${zodErrorSummary(parsed.error)}`);
  }

  switch (parsed.data.version) {
    case 1:
      return parseSessionStateV1(value);
    default:
      throw new Error(`Session data version ${parsed.data.version} is not supported.`);
  }
};
