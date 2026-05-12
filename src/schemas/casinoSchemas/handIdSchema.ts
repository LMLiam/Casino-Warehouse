import { z } from 'zod';
import { handIds } from '../../game/types/handIds';

export const handIdSchema = z.enum(handIds);
