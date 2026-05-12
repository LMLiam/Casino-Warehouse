import type { RoomFlowEvent } from './RoomFlowEvent';
import type { RoomFlowPhase } from './RoomFlowPhase';

const roomAllowedEvents: Record<RoomFlowPhase, readonly RoomFlowEvent['type'][]> = {
  lobby: ['PLAYER_JOINED', 'RESET', 'CLOSE'],
  betting: ['START_PLAY', 'RESET', 'CLOSE'],
  playing: ['SETTLE', 'RESET', 'CLOSE'],
  settled: ['NEXT_ROUND', 'RESET', 'CLOSE'],
};

export const canRoomFlowTransition = (phase: RoomFlowPhase, event: RoomFlowEvent): boolean => roomAllowedEvents[phase].includes(event.type);
