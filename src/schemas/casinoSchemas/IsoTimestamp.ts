import type { z } from 'zod';
import { isoTimestampSchema } from './isoTimestampSchema';

export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;
