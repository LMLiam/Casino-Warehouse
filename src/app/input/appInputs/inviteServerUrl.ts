export const inviteServerUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  return params.get('server')?.trim() || params.get('ws')?.trim() || undefined;
};
