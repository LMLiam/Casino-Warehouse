import { getInitialSnapshot, getNextSnapshot, type SnapshotFrom } from 'xstate';
import type { SharedSlotsFlowEvent } from './SharedSlotsFlowEvent';
import { sharedSlotsFlowMachine } from './sharedSlotsFlowMachine';
import type { SharedSlotsFlowPhase } from './SharedSlotsFlowPhase';

const slotsPhaseBootEvents: Record<SharedSlotsFlowPhase, readonly SharedSlotsFlowEvent[]> = {
  'collecting-wagers': [],
  'ready-to-spin': [{ type: 'READY' }],
  spinning: [{ type: 'READY' }, { type: 'SPIN' }],
  bonus: [{ type: 'READY' }, { type: 'SPIN' }, { type: 'BONUS_PICK' }],
};

export const nextSharedSlotsPhase = (phase: SharedSlotsFlowPhase, event: SharedSlotsFlowEvent): SharedSlotsFlowPhase => {
  const snapshot = slotsPhaseBootEvents[phase].reduce<SnapshotFrom<typeof sharedSlotsFlowMachine>>(
    (current, bootEvent) => getNextSnapshot(sharedSlotsFlowMachine, current, bootEvent),
    getInitialSnapshot(sharedSlotsFlowMachine),
  );
  return getNextSnapshot(sharedSlotsFlowMachine, snapshot, event).value as SharedSlotsFlowPhase;
};
