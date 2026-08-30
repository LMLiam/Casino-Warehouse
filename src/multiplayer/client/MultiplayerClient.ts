import type { ClientMessage } from '../protocol/ClientMessage';
import { authTokenSchema } from '../../schemas/casinoSchemas/authTokenSchema';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import { playerGameSnapshotsSchema } from '../../schemas/casinoSchemas/playerGameSnapshotsSchema';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomRole } from '../protocol/RoomRole';
import type { RoomSeatId } from '../protocol/RoomSeatId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { adminTokenStorageKey } from './adminTokenStorageKey';
import type { MultiplayerClientEvents } from './MultiplayerClientEvents';
import { MultiplayerClientConnection } from './MultiplayerClientConnection';
import { MultiplayerClientStorage } from './MultiplayerClientStorage';

export class MultiplayerClient extends MultiplayerClientConnection {
  public constructor(events: MultiplayerClientEvents) {
    super(events);
  }

  public get hasAdminAccess(): boolean {
    return this.adminAuthorized;
  }

  public createProfile(profileName: string): void {
    this.send({ type: 'create-profile', profileName });
  }

  public renameProfile(profileId: ProfileId, profileName: string): void {
    this.sendOwnedProfileMessage(profileId, { type: 'rename-profile', profileId, profileName });
  }

  public deleteProfile(profileId: ProfileId): void {
    if (this.sendOwnedProfileMessage(profileId, { type: 'delete-profile', profileId })) {
      this.forgetProfileToken(profileId);
    }
  }

  public acceptHouseAdvance(profileId: ProfileId): void {
    this.sendOwnedProfileMessage(profileId, { type: 'house-advance', profileId });
  }

  public saveSession(session: Omit<CasinoSessionState, 'updatedAt'>): void {
    if (!this.ownsProfile(session.profileId)) {
      this.events.onError('This browser does not own this session profile.');
      return;
    }
    this.send({
      type: 'save-session',
      session: {
        ...session,
        gameSnapshot: session.gameSnapshot ? playerGameSnapshotsSchema.parse(session.gameSnapshot) : undefined,
      },
    });
  }

  public adjustBankroll(profileId: ProfileId, action: 'add' | 'subtract' | 'reset', amount?: number): void {
    this.sendAdminMessage({ type: 'admin-bankroll', profileId, action, amount });
  }

  public resetAllBankrolls(): void {
    this.sendAdminMessage({ type: 'admin-reset-all' });
  }

  public clearServerData(): void {
    if (this.sendAdminMessage({ type: 'clear-server-data' })) {
      this.clearProfileTokens();
    }
  }

  public authorizeAdmin(adminToken: string): void {
    const token = adminToken.trim();
    if (!token) {
      this.events.onError('Enter an admin token first.');
      return;
    }
    const parsedToken = authTokenSchema.safeParse(token);
    if (!parsedToken.success) {
      this.events.onError('Admin token is invalid.');
      return;
    }
    MultiplayerClientStorage.writeStorageValue(adminTokenStorageKey, parsedToken.data);
    this.send({ type: 'authorize-admin', adminToken: parsedToken.data });
  }

  public listRooms(gameId: RoomGameId): void {
    this.send({ type: 'list-rooms', gameId });
  }

  public createRoom(gameId: RoomGameId, roomName: string, maxPlayers: number, profileId: ProfileId, profileName: string, bankroll: number): void {
    this.sendOwnedProfileMessage(profileId, {
      type: 'create-room',
      gameId,
      roomName,
      maxPlayers,
      allowSpectators: true,
      profileId,
      profileName,
      bankroll,
    });
  }

  public joinRoom(gameId: RoomGameId, roomId: RoomId, role: RoomRole, profileId: ProfileId, profileName: string, bankroll: number, seatId?: RoomSeatId): void {
    this.sendOwnedProfileMessage(profileId, {
      type: 'join-room',
      gameId,
      roomId,
      role,
      profileId,
      profileName,
      bankroll,
      seatId,
    });
  }

  public leaveRoom(): void {
    this.send({ type: 'leave-room' });
    this.lastRoom = undefined;
  }

  public clearRoomState(): void {
    this.clearRoom();
  }

  private sendOwnedProfileMessage(profileId: ProfileId, message: ClientMessage): boolean {
    if (!this.ownsProfile(profileId)) {
      this.events.onError('This browser does not own that server profile.');
      return false;
    }
    return this.send(message);
  }

  private sendAdminMessage(message: ClientMessage): boolean {
    if (!this.adminAuthorized) {
      this.events.onError('Admin controls are locked for this browser.');
      return false;
    }
    return this.send(message);
  }
}
