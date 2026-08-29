import { z } from 'zod';

export const isoTimestampSchema = z.iso.datetime().brand<'iso-timestamp'>();
