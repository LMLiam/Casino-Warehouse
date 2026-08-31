import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ProfileToken } from '../../schemas/casinoSchemas/ProfileToken';
import type { ProfileTokenHash } from '../../schemas/casinoSchemas/ProfileTokenHash';
import { profileTokenHashSchema } from '../../schemas/casinoSchemas/profileTokenHashSchema';
import { profileTokenSchema } from '../../schemas/casinoSchemas/profileTokenSchema';

export const profileTokenAuth = (() => {
  const profileTokenHash = (profileId: ProfileId, profileToken: ProfileToken): ProfileTokenHash =>
    profileTokenHashSchema.parse(createHash('sha256').update(`${profileId}:${profileToken}`).digest('hex'));

  const safeSecretEqual = (expected: string, candidate: string): boolean => {
    const expectedBuffer = Buffer.from(expected);
    const candidateBuffer = Buffer.from(candidate);
    return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
  };

  return {
    createToken: (): ProfileToken => profileTokenSchema.parse(randomBytes(32).toString('base64url')),
    hash: (profileId: ProfileId, profileToken: ProfileToken): ProfileTokenHash => profileTokenHash(profileId, profileToken),
    matches: (profileId: ProfileId, profileToken: ProfileToken, expectedHash: string): boolean =>
      safeSecretEqual(expectedHash, profileTokenHash(profileId, profileToken)),
    safeSecretEqual: (expected: string, candidate: string): boolean => safeSecretEqual(expected, candidate),
  };
})();
