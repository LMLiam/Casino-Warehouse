import type { z } from 'zod';
import { hexColourSchema } from './hexColourSchema';

export type HexColour = z.infer<typeof hexColourSchema>;
