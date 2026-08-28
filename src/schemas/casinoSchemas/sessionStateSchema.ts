import { z } from 'zod';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import { creditSchema } from './creditSchema';
import { playerGameSnapshotsSchema } from './playerGameSnapshotsSchema';
import { profileIdSchema } from './profileIdSchema';
import { roomGameIdSchema } from './roomGameIdSchema';
import { roomRoleSchema } from './roomRoleSchema';
import { roomSeatIdSchema } from './roomSeatIdSchema';

export const sessionStateSchema = z
  .object({
    profileId: profileIdSchema,
    activeGame: roomGameIdSchema,
    showingGameLobby: z.boolean(),
    wagerLimit: creditSchema,
    wagered: creditSchema,
    gameSnapshot: playerGameSnapshotsSchema.optional(),
    room: z
      .object({
        roomId: z.string().trim().min(1),
        gameId: roomGameIdSchema,
        role: roomRoleSchema,
        seatId: roomSeatIdSchema.optional(),
      })
      .strict()
      .optional(),
    updatedAt: z.string(),
  })
  .strict() satisfies z.ZodType<CasinoSessionState>;
