import { getInitialSnapshot, getNextSnapshot, type SnapshotFrom } from 'xstate';
import type { RoomFlowEvent } from './RoomFlowEvent';
import { roomFlowMachine } from './roomFlowMachine';
import type { RoomFlowPhase } from './RoomFlowPhase';

export const nextRoomFlowPhase = (phase: RoomFlowPhase, event: RoomFlowEvent): RoomFlowPhase => {
  const roomPhaseBootEvents: Record<RoomFlowPhase, readonly RoomFlowEvent[]> = {
    lobby: [],
    betting: [{ type: 'PLAYER_JOINED' }],
    playing: [{ type: 'PLAYER_JOINED' }, { type: 'START_PLAY' }],
    settled: [{ type: 'PLAYER_JOINED' }, { type: 'START_PLAY' }, { type: 'SETTLE' }],
  };
  const snapshot = roomPhaseBootEvents[phase].reduce<SnapshotFrom<typeof roomFlowMachine>>(
    (current, bootEvent) => getNextSnapshot(roomFlowMachine, current, bootEvent),
    getInitialSnapshot(roomFlowMachine),
  );
  return getNextSnapshot(roomFlowMachine, snapshot, event).value as RoomFlowPhase;
};
