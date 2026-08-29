import { authTokenSchema } from './authTokenSchema';

export const profileTokenSchema = authTokenSchema.brand<'profile-token'>();
