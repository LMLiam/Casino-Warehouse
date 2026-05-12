import { z } from 'zod';

export const metadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
