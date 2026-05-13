import { z } from 'zod';
import { currentSessionStateVersion } from '../../state/session/currentSessionStateVersion';

// Bump this only when persisted session-state records require a session-save migration.
export const currentSessionStateVersionSchema = z.literal(currentSessionStateVersion);
