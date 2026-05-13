import { currentPageRealtimeUrl } from '../../../multiplayer/client/currentPageRealtimeUrl';
import { normalizeRealtimeUrl } from '../../../multiplayer/client/normalizeRealtimeUrl';

export const inviteServerUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('server')?.trim() || params.get('ws')?.trim() || '';
  if (!value) {
    return { invalid: false, url: undefined };
  }

  const url = normalizeRealtimeUrl(value);
  const currentUrl = currentPageRealtimeUrl();
  return url === currentUrl ? { invalid: false, url: currentUrl } : { invalid: true, url: undefined };
};
