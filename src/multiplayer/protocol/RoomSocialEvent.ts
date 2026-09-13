import type { z } from 'zod';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { roomReactionSchema } from '../../schemas/casinoSchemas/roomReactionSchema';
import type { RoomRole } from './RoomRole';

export type RoomSocialEvent =
  | {
      readonly kind: 'chat';
      readonly profileId: ProfileId;
      readonly profileName: string;
      readonly role: RoomRole;
      readonly createdAt: number;
      readonly text: string;
    }
  | {
      readonly kind: 'reaction';
      readonly profileId: ProfileId;
      readonly profileName: string;
      readonly role: RoomRole;
      readonly createdAt: number;
      readonly reaction: z.infer<typeof roomReactionSchema>;
    };
