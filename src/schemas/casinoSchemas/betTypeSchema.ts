import { z } from 'zod';
import { betTypes } from '../../game/types/betTypes';

export const betTypeSchema = z.enum(betTypes);
