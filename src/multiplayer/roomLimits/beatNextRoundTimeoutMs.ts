export const beatNextRoundTimeoutMs = (): number => {
  const defaultTimeoutMs = 20_000;
  const minimumTimeoutMs = 1_000;
  const configured = Number(process.env.CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured < minimumTimeoutMs) {
    return defaultTimeoutMs;
  }
  return Math.floor(configured);
};
