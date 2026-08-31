import { z } from 'zod';

export const roomReadyPhaseSchema = z.enum(['betting', 'roundOver']);
