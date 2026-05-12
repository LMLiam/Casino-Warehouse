import { z } from 'zod';

export const slotSymbolSchema = z.enum(['princess', 'lotus', 'elephant', 'temple', 'fan', 'orchid']);
