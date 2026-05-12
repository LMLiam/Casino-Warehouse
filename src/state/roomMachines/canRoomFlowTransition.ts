import type { RoomFlowEvent } from './RoomFlowEvent';
import type { RoomFlowPhase } from './RoomFlowPhase';

export const canRoomFlowTransition = (phase: RoomFlowPhase, event: RoomFlowEvent): boolean => {
  const roomAllowedEvents: Record<RoomFlowPhase, readonly RoomFlowEvent['type'][]> = {
    lobby: ['PLAYER_JOINED', 'RESET', 'CLOSE'],
    betting: ['START_PLAY', 'RESET', 'CLOSE'],
    playing: ['SETTLE', 'RESET', 'CLOSE'],
    settled: ['NEXT_ROUND', 'RESET', 'CLOSE'],
  };
  return roomAllowedEvents[phase].includes(event.type);
};
