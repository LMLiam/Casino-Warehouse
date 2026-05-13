export const normalizeRealtimeUrl = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.hash || url.search || url.pathname !== '/ws' || (url.protocol !== 'ws:' && url.protocol !== 'wss:')) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
};
