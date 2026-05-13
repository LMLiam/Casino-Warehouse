import type { SharedSlotsFlowEvent } from './SharedSlotsFlowEvent';
import type { SharedSlotsFlowPhase } from './SharedSlotsFlowPhase';

export const canSharedSlotsTransition = (phase: SharedSlotsFlowPhase, event: SharedSlotsFlowEvent): boolean => {
  const slotsAllowedEvents: Record<SharedSlotsFlowPhase, readonly SharedSlotsFlowEvent['type'][]> = {
    'collecting-wagers': ['SET_WAGER', 'READY', 'RESET'],
    'ready-to-spin': ['SET_WAGER', 'SPIN', 'RESET'],
    spinning: ['READY', 'SET_WAGER', 'BONUS_PICK', 'RESET'],
    bonus: ['BONUS_PICK', 'RESET'],
  };
  return slotsAllowedEvents[phase].includes(event.type);
};
