import { describe, expect, it } from 'vitest';
import { canRoomFlowTransition } from '../../../src/state/roomMachines/canRoomFlowTransition';
import { canSharedSlotsTransition } from '../../../src/state/roomMachines/canSharedSlotsTransition';
import { deriveSharedSlotsPhase } from '../../../src/state/roomMachines/deriveSharedSlotsPhase';
import { nextRoomFlowPhase } from '../../../src/state/roomMachines/nextRoomFlowPhase';
import { nextSharedSlotsPhase } from '../../../src/state/roomMachines/nextSharedSlotsPhase';

describe('XState casino room machines', () => {
  it('allows only explicit multiplayer room phase transitions', () => {
    expect(nextRoomFlowPhase('lobby', { type: 'PLAYER_JOINED' })).toBe('betting');
    expect(nextRoomFlowPhase('betting', { type: 'START_PLAY' })).toBe('playing');
    expect(nextRoomFlowPhase('playing', { type: 'SETTLE' })).toBe('settled');
    expect(nextRoomFlowPhase('settled', { type: 'NEXT_ROUND' })).toBe('betting');

    expect(canRoomFlowTransition('betting', { type: 'NEXT_ROUND' })).toBe(false);
    expect(canRoomFlowTransition('playing', { type: 'START_PLAY' })).toBe(false);
  });

  it('guards shared Slots spins until every player has wagered and readied', () => {
    expect(deriveSharedSlotsPhase(4, 3, 4, 'idle')).toBe('collecting-wagers');
    expect(deriveSharedSlotsPhase(4, 4, 3, 'idle')).toBe('collecting-wagers');
    expect(deriveSharedSlotsPhase(4, 4, 4, 'idle')).toBe('ready-to-spin');
    expect(canSharedSlotsTransition('collecting-wagers', { type: 'SPIN' })).toBe(false);
    expect(nextSharedSlotsPhase('ready-to-spin', { type: 'SPIN' })).toBe('spinning');
    expect(deriveSharedSlotsPhase(4, 4, 4, 'bonus')).toBe('bonus');
    expect(canSharedSlotsTransition('bonus', { type: 'SPIN' })).toBe(false);
  });
});
