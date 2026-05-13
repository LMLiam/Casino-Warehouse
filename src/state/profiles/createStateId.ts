export const createStateId = (prefix: string, now = new Date()): string => {
  const randomUuid = (): string => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }
    if (!cryptoApi?.getRandomValues) {
      throw new Error('Cryptographically secure state IDs are unavailable in this runtime.');
    }

    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return uuidFromBytes(bytes);
  };

  const uuidFromBytes = (bytes: Uint8Array): string => {
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  return `${prefix}-${now.getTime().toString(36)}-${randomUuid()}`;
};
