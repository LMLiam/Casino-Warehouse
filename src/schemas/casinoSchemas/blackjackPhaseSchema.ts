import { z } from 'zod';

export const blackjackPhaseSchema = z.enum(['idle', 'player', 'dealer', 'settled']);
