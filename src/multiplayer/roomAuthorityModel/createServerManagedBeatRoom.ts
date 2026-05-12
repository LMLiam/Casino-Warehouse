import { findGame } from '../../game/catalog/findGame';
import { normalizeRoomMaxPlayers } from '../roomLimits/normalizeRoomMaxPlayers';
import { createGameModel } from './createGameModel';
import { createId } from './createId';
import { mainBeatRoomId } from './mainBeatRoomId';
import type { RoomState } from './RoomState';

export const createServerManagedBeatRoom = (): RoomState => {
  const catalogGame = findGame('beat-the-house');
  const now = Date.now();
  return {
    roomId: mainBeatRoomId,
    roomName: 'Beat the House Main Room',
    gameId: 'beat-the-house',
    gameTitle: catalogGame.title,
    hostProfileId: 'server',
    maxPlayers: normalizeRoomMaxPlayers('beat-the-house', undefined),
    allowSpectators: true,
    players: new Map(),
    spectators: new Map(),
    connectionToMember: new Map(),
    seats: new Map(),
    model: createGameModel('beat-the-house', 0),
    createdAt: now,
    updatedAt: now,
    sessionId: createId('session'),
    revision: 0,
    serverManaged: true,
    settledSessionIds: new Set(),
    lastBeatEvents: [],
  };
};
