import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import type { CasinoSaveState } from './CasinoSaveState';
import { parseCasinoSaveState } from './parseCasinoSaveState';
import type { ParseError } from '../ParseError';
import type { Result } from '../Result';

export const parseProfileStoreJson = (json: string): Result<CasinoSaveState, ParseError> => {
  try {
    return parseCasinoSaveState(parseJsonText(json));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error('Profile store JSON is invalid.') };
  }
};
