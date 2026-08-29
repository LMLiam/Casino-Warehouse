import type { z } from 'zod';
import { roomRoleSchema } from '../../schemas/casinoSchemas/roomRoleSchema';

export type RoomRole = z.infer<typeof roomRoleSchema>;
