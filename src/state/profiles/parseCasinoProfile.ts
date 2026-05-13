import type { CasinoProfile } from './CasinoProfile';
import { CasinoProfileParser } from './CasinoProfileParser';

export const parseCasinoProfile = (value: unknown): CasinoProfile => CasinoProfileParser.parse(value);
