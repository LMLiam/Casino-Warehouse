export type Rng = () => number;

export const secureRandomInt = (maxExclusive: number): number => {
  if (maxExclusive <= 0 || !Number.isInteger(maxExclusive)) {
    throw new Error('secureRandomInt requires a positive integer bound.');
  }

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Cryptographically secure random values are unavailable in this runtime.');
  }

  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(buffer);
  } while (buffer[0] >= limit);

  return buffer[0] % maxExclusive;
};

export const secureRandomUnit: Rng = () => secureRandomInt(0x1_0000_0000) / 0x1_0000_0000;
