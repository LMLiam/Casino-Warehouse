import { z } from 'zod';
import { creditSchema } from './creditSchema';
import { currentSessionStateVersionSchema } from './currentSessionStateVersionSchema';
import { roomGameIdSchema } from './roomGameIdSchema';

export const sessionStateSchema = z.object({
  version: currentSessionStateVersionSchema,
  profileIds: z.array(z.string()).default([]),
  selectedPlayerIndex: creditSchema.default(0),
  activeGame: roomGameIdSchema.default('beat-the-house'),
  showingGameLobby: z.coerce.boolean().default(true),
  wagerLimit: creditSchema.default(0),
  wagered: creditSchema.default(0),
  gameSnapshots: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
