import { z } from 'zod';
import { currentProfileStoreVersion } from '../../state/profiles/currentProfileStoreVersion';

// Bump this only when persisted profile-store records require a profile-save migration.
export const currentProfileStoreVersionSchema = z.literal(currentProfileStoreVersion);
