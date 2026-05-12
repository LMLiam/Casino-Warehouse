import type { SharedSlotsFlowEvent } from './SharedSlotsFlowEvent';
import type { SharedSlotsFlowPhase } from './SharedSlotsFlowPhase';

const slotsAllowedEvents: Record<SharedSlotsFlowPhase, readonly SharedSlotsFlowEvent['type'][]> = {
  'collecting-wagers': ['SET_WAGER', 'READY', 'RESET'],
  'ready-to-spin': ['SET_WAGER', 'SPIN', 'RESET'],
  spinning: ['READY', 'SET_WAGER', 'BONUS_PICK', 'RESET'],
  bonus: ['BONUS_PICK', 'RESET'],
};

export const canSharedSlotsTransition = (phase: SharedSlotsFlowPhase, event: SharedSlotsFlowEvent): boolean => slotsAllowedEvents[phase].includes(event.type);
