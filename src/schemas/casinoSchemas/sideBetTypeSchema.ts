import { z } from 'zod';
import { sideBetTypes } from '../../game/types/sideBetTypes';

export const sideBetTypeSchema = z.enum(sideBetTypes);
