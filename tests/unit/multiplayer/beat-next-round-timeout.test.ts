import { afterEach, describe, expect, it, vi } from 'vitest';
import { beatNextRoundTimeoutMs } from '../../../src/multiplayer/roomLimits/beatNextRoundTimeoutMs';

const defaultTimeoutMs = 20_000;

describe('beatNextRoundTimeoutMs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the production default when the environment variable is unset', () => {
    expect(beatNextRoundTimeoutMs()).toBe(defaultTimeoutMs);
  });

  it('honors a configured override above the minimum window', () => {
    vi.stubEnv('CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS', '3600000');
    expect(beatNextRoundTimeoutMs()).toBe(3_600_000);
  });

  it('floors fractional configured windows to whole milliseconds', () => {
    vi.stubEnv('CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS', '2500.9');
    expect(beatNextRoundTimeoutMs()).toBe(2_500);
  });

  it('falls back to the default for non-numeric values', () => {
    vi.stubEnv('CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS', 'soon');
    expect(beatNextRoundTimeoutMs()).toBe(defaultTimeoutMs);
  });

  it('falls back to the default for values below the one-second minimum', () => {
    vi.stubEnv('CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS', '500');
    expect(beatNextRoundTimeoutMs()).toBe(defaultTimeoutMs);
  });
});
