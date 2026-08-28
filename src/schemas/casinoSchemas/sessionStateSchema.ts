import { z } from 'zod';
import { creditSchema } from './creditSchema';
import { currentSessionStateVersionSchema } from './currentSessionStateVersionSchema';
import { profileIdSchema } from './profileIdSchema';
import { roomGameIdSchema } from './roomGameIdSchema';
import { sessionGameSnapshotSchema } from './sessionGameSnapshotSchema';

export const sessionStateSchema = z.object({
  version: currentSessionStateVersionSchema,
  profileId: profileIdSchema,
  activeGame: roomGameIdSchema.default('beat-the-house'),
  showingGameLobby: z.coerce.boolean().default(true),
  wagerLimit: creditSchema.default(0),
  wagered: creditSchema.default(0),
  gameSnapshot: sessionGameSnapshotSchema.optional(),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
