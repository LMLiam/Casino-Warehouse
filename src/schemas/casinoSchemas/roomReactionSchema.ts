import { z } from 'zod';

export const roomReactionSchema = z.enum(['nice', 'cheer', 'laugh', 'wow', 'ouch', 'gg']);
