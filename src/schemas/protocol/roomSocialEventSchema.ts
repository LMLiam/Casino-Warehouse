import { z } from 'zod';
import type { RoomSocialEvent } from '../../multiplayer/protocol/RoomSocialEvent';
import { finiteNumberSchema } from '../casinoSchemas/finiteNumberSchema';
import { profileIdSchema } from '../casinoSchemas/profileIdSchema';
import { roomChatTextSchema } from '../casinoSchemas/roomChatTextSchema';
import { roomReactionSchema } from '../casinoSchemas/roomReactionSchema';
import { roomRoleSchema } from '../casinoSchemas/roomRoleSchema';

export const roomSocialEventSchema = (() => {
  const roomSocialEventActorSchema = z
    .object({
      profileId: profileIdSchema,
      profileName: z.string(),
      role: roomRoleSchema,
      createdAt: finiteNumberSchema,
    })
    .strict();

  return z.discriminatedUnion('kind', [
    roomSocialEventActorSchema
      .extend({
        kind: z.literal('chat'),
        text: roomChatTextSchema,
      })
      .strict(),
    roomSocialEventActorSchema
      .extend({
        kind: z.literal('reaction'),
        reaction: roomReactionSchema,
      })
      .strict(),
  ]) satisfies z.ZodType<RoomSocialEvent>;
})();
