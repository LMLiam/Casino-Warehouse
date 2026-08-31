import type { RandomInt } from './RandomInt';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import { sessionIdSchema } from '../../schemas/casinoSchemas/sessionIdSchema';
import { createId } from './createId';

export const createSessionId = (randomInt?: RandomInt): SessionId => sessionIdSchema.parse(createId('session', randomInt));
