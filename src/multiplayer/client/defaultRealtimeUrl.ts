import { currentPageRealtimeUrl } from './currentPageRealtimeUrl';
import { normalizeRealtimeUrl } from './normalizeRealtimeUrl';

export const defaultRealtimeUrl = (): string => {
  const configured = normalizeRealtimeUrl(globalThis.document?.querySelector<HTMLMetaElement>('meta[name="casino-realtime-url"]')?.content);
  if (configured) {
    return configured;
  }

  try {
    const saved = globalThis.localStorage?.getItem('casino_realtime_url') ?? '';
    if (saved) {
      const savedUrl = normalizeRealtimeUrl(saved);
      if (savedUrl) {
        return savedUrl;
      }
      globalThis.localStorage?.removeItem('casino_realtime_url');
    }
  } catch {
    // Browser storage can be unavailable in private contexts; fall back to the current host.
  }

  return currentPageRealtimeUrl();
};
