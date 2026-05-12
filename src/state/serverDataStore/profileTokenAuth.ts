import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const profileTokenAuth = {
  createToken: (): string => randomBytes(32).toString('base64url'),
  hash: (profileId: string, profileToken: string): string => profileTokenHash(profileId, profileToken),
  matches: (profileId: string, profileToken: string, expectedHash: string): boolean => safeSecretEqual(expectedHash, profileTokenHash(profileId, profileToken)),
  safeSecretEqual: (expected: string, candidate: string): boolean => safeSecretEqual(expected, candidate),
};

const profileTokenHash = (profileId: string, profileToken: string): string => createHash('sha256').update(`${profileId}:${profileToken}`).digest('hex');

const safeSecretEqual = (expected: string, candidate: string): boolean => {
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
};
