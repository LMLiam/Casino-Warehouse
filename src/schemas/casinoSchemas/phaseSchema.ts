import { z } from 'zod';

export const phaseSchema = z.enum(['betting', 'dealing', 'playing', 'dealer', 'roundOver']);
