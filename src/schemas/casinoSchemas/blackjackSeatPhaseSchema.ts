import { z } from 'zod';

export const blackjackSeatPhaseSchema = z.enum(['empty', 'betting', 'player', 'stood', 'settled']);
