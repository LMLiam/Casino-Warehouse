import type { CasinoSessionState } from './CasinoSessionState';

export interface SessionLoadResult {
  readonly session?: CasinoSessionState;
  readonly recovered: boolean;
  readonly error?: string;
}
