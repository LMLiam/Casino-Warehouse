import type { RoomState } from './RoomState';

export const compareRoomListOrder = (left: RoomState, right: RoomState): number => {
  const leftActive = left.players.size + left.spectators.size > 0;
  const rightActive = right.players.size + right.spectators.size > 0;
  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }
  if (left.serverManaged !== right.serverManaged) {
    return left.serverManaged ? 1 : -1;
  }
  return left.createdAt - right.createdAt;
};
