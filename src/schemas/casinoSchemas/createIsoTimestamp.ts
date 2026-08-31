import type { IsoTimestamp } from './IsoTimestamp';
import { isoTimestampSchema } from './isoTimestampSchema';

export const createIsoTimestamp = (now: Date): IsoTimestamp => isoTimestampSchema.parse(now.toISOString());
