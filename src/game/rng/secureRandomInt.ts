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
    const value = buffer[0];
    if (value === undefined) {
      throw new Error('Cryptographically secure random values are unavailable in this runtime.');
    }
    if (value < limit) {
      return value % maxExclusive;
    }
    // eslint-disable-next-line no-constant-condition -- retry until value is below limit
  } while (true);
};
