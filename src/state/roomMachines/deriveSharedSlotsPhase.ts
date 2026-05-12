import type { SlotPhase } from '../../game/slots/SlotPhase';
import type { SharedSlotsFlowPhase } from './SharedSlotsFlowPhase';

export const deriveSharedSlotsPhase = (players: number, wageredPlayers: number, readyPlayers: number, slotPhase: SlotPhase): SharedSlotsFlowPhase => {
  if (slotPhase === 'bonus') {
    return 'bonus';
  }
  if (players > 0 && wageredPlayers >= players && readyPlayers >= players) {
    return 'ready-to-spin';
  }
  return slotPhase === 'spun' ? 'spinning' : 'collecting-wagers';
};
