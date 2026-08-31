import { z } from 'zod';

export const blackjackTablePhaseSchema = z.enum(['betting', 'playing', 'settled']);
