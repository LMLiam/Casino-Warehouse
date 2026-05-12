export const defaultRealtimeUrl = (): string => {
  const saved = localStorage.getItem('casino_realtime_url');
  if (saved) {
    return saved;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};
