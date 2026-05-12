import { z } from 'zod';

export const zodErrorSummary = (error: z.ZodError): string => error.issues[0]?.message ?? 'Payload is invalid.';
