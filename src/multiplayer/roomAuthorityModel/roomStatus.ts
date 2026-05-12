import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import { roomPhase } from './roomPhase';
import type { RoomState } from './RoomState';

export const roomStatus = (room: RoomState): RoomSnapshot['status'] => {
  if (room.players.size === 0) {
    return 'waiting';
  }
  const phase = roomPhase(room);
  if (phase === 'settled') {
    return 'complete';
  }
  if (phase === 'playing') {
    return 'in-progress';
  }
  return room.model.kind === 'slots' ? 'open' : 'betting';
};
