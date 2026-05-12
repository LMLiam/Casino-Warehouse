import { z } from 'zod';

export const roomRoleSchema = z.enum(['player', 'spectator']);
