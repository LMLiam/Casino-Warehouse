import { describe, expect, it } from 'vitest';
import { maxRoomPlayers } from '../../../src/multiplayer/roomLimits/maxRoomPlayers';
import { minRoomPlayers } from '../../../src/multiplayer/roomLimits/minRoomPlayers';
import { normalizeRoomMaxPlayers } from '../../../src/multiplayer/roomLimits/normalizeRoomMaxPlayers';

describe('room player limits', () => {
  it('sets per-game minimums and maximums', () => {
    expect(maxRoomPlayers('beat-the-house')).toBe(3);
    expect(maxRoomPlayers('blackjack')).toBe(5);
    expect(maxRoomPlayers('slots:thai-princess')).toBe(4);

    expect(minRoomPlayers('beat-the-house')).toBe(1);
    expect(minRoomPlayers('blackjack')).toBe(1);
    expect(minRoomPlayers('slots:thai-princess')).toBe(2);
  });

  it('normalizes requested room sizes within each game range', () => {
    expect(normalizeRoomMaxPlayers('beat-the-house')).toBe(3);
    expect(normalizeRoomMaxPlayers('beat-the-house', 2.8)).toBe(2);
    expect(normalizeRoomMaxPlayers('beat-the-house', 0)).toBe(3);
    expect(normalizeRoomMaxPlayers('blackjack', 99)).toBe(5);
    expect(normalizeRoomMaxPlayers('slots:thai-princess', 1)).toBe(2);
  });
});
