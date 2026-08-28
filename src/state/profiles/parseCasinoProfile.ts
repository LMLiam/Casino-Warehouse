import type { CasinoProfile } from './CasinoProfile';
import { CasinoProfileParser } from './CasinoProfileParser';
import type { LegacyCasinoProfile } from './LegacyCasinoProfile';

export const parseCasinoProfile = (value: LegacyCasinoProfile | null): CasinoProfile => CasinoProfileParser.parse(value);
