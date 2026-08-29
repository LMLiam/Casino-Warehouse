import { z } from 'zod';

export const finiteNumberSchema = z.number().finite();
