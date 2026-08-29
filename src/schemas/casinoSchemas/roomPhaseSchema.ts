import { z } from 'zod';

export const roomPhaseSchema = z.enum(['lobby', 'betting', 'playing', 'settled']);
