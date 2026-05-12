import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { RoomState } from './RoomState';

export const roomPhase = (room: RoomState): RoomSnapshot['phase'] => {
  if (room.model.kind === 'beat-the-house') {
    const phase = room.model.game.snapshot().phase;
    return phase === 'roundOver' ? 'settled' : phase === 'playing' || phase === 'dealing' ? 'playing' : 'betting';
  }
  if (room.model.kind === 'blackjack') {
    const phase = room.model.table.snapshot(room.seats.size > 0 ? [] : []).phase;
    return phase === 'settled' ? 'settled' : phase === 'playing' ? 'playing' : 'betting';
  }
  return room.model.game.snapshot().phase === 'bonus' ? 'playing' : 'betting';
};
