import { findGame } from '../../game/catalog/findGame';
import { profileIdSchema } from '../../schemas/casinoSchemas/profileIdSchema';
import { normalizeRoomMaxPlayers } from '../roomLimits/normalizeRoomMaxPlayers';
import { createGameModel } from './createGameModel';
import { createSessionId } from './createSessionId';
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
    hostProfileId: profileIdSchema.parse('server'),
    maxPlayers: normalizeRoomMaxPlayers('beat-the-house', undefined),
    allowSpectators: true,
    players: new Map(),
    spectators: new Map(),
    connectionToMember: new Map(),
    seats: new Map(),
    model: createGameModel('beat-the-house', 0),
    createdAt: now,
    updatedAt: now,
    sessionId: createSessionId(),
    revision: 0,
    serverManaged: true,
    settledSessionIds: new Set(),
    lastBeatEvents: [],
    lastBeatBetOwners: {},
  };
};
