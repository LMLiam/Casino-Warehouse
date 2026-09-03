import { WebSocket } from 'ws';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { ServerDataStore } from '../../state/serverDataStore/ServerDataStore';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { ServerMessage } from '../protocol/ServerMessage';
import type { AuthorityResult } from '../roomAuthorityModel/AuthorityResult';
import type { CasinoRoomAuthority } from './CasinoRoomAuthority';
import type { Peer } from './Peer';

export class CasinoServerState {
  public readonly peers = new Map<ConnectionId, Peer>();

  public constructor(
    private readonly authority: CasinoRoomAuthority,
    private readonly dataStore: ServerDataStore,
    private readonly publicBaseUrl: () => string,
  ) {}

  public send(peer: Peer, message: ServerMessage): void {
    if (peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(JSON.stringify(message));
    }
  }

  public broadcast(message: ServerMessage | undefined, recipients?: readonly ConnectionId[]): void {
    if (!message) {
      return;
    }
    const allowed = recipients ? new Set(recipients) : undefined;
    for (const peer of this.peers.values()) {
      if (allowed && !allowed.has(peer.id)) {
        continue;
      }
      this.send(peer, message);
    }
  }

  public broadcastRoomLists(gameIds: Iterable<RoomGameId>): void {
    const uniqueGameIds = new Set(gameIds);
    for (const gameId of uniqueGameIds) {
      const recipients = [...this.peers.values()].filter((candidate) => candidate.browsingGameId === gameId).map((candidate) => candidate.id);
      if (recipients.length > 0) {
        this.broadcast({ type: 'room-list', gameId, rooms: this.authority.listRoomSummaries(gameId) }, recipients);
      }
    }
  }

  public sendDataState(peer: Peer): void {
    const snapshot = this.dataStore.snapshot();
    const session = snapshot.session && peer.ownedProfileIds.has(snapshot.session.profileId) ? snapshot.session : undefined;
    this.send(peer, {
      type: 'data-state',
      database: snapshot.database,
      profileState: snapshot.profileState,
      session,
    });
  }

  public sendProfileAccess(peer: Peer): void {
    this.send(peer, { type: 'profile-access', ownedProfileIds: [...peer.ownedProfileIds] });
  }

  public sendAdminAccess(peer: Peer): void {
    this.send(peer, { type: 'admin-access', authorized: peer.isAdmin });
  }

  public broadcastDataState(): void {
    for (const peer of this.peers.values()) {
      this.sendDataState(peer);
    }
  }

  public emitAuthorityResult(peer: Peer, result: AuthorityResult, options: { readonly forceDataState?: boolean } = {}): void {
    if (result.error) {
      this.send(peer, { type: 'error', code: 'rejected', message: result.error });
    }
    if (result.roomList) {
      this.send(peer, { type: 'room-list', gameId: result.roomList.gameId, rooms: result.roomList.rooms });
    }
    if (result.direct) {
      this.send(peer, {
        type: 'room-created',
        room: result.direct,
        invitePath: this.createInvitePath(result.direct.gameId, result.direct.roomId),
      });
    }
    for (const closure of result.roomClosures ?? []) {
      this.broadcast({ type: 'room-closed', roomId: closure.roomId, gameId: closure.gameId, reason: closure.reason }, closure.connectionIds);
    }
    const broadcastRecipients = new Map((result.broadcastRecipients ?? []).map((entry) => [entry.roomId, entry.connectionIds]));
    for (const snapshot of result.broadcasts) {
      this.broadcast({ type: 'room-state', room: snapshot }, broadcastRecipients.get(snapshot.roomId) ?? this.connectionIds(snapshot));
    }
    this.broadcastRoomLists(this.roomListGameIds(result));
    if (result.settlements.length > 0) {
      const room = result.broadcasts.at(-1);
      if (room) {
        this.broadcast({ type: 'settlement', roomId: room.roomId, sessionId: room.sessionId, settlements: result.settlements }, this.connectionIds(room));
      }
    }
    if (options.forceDataState || result.broadcasts.length > 0 || result.settlements.length > 0 || (result.roomClosures?.length ?? 0) > 0) {
      this.broadcastDataState();
    }
  }

  public connectionIds(room: {
    readonly players: readonly { readonly connectionId: ConnectionId }[];
    readonly spectators: readonly { readonly connectionId: ConnectionId }[];
  }): readonly ConnectionId[] {
    return [...room.players.map((player) => player.connectionId), ...room.spectators.map((player) => player.connectionId)];
  }

  public roomListGameIds(result: AuthorityResult): readonly RoomGameId[] {
    return [
      ...(result.roomList ? [result.roomList.gameId] : []),
      ...(result.direct ? [result.direct.gameId] : []),
      ...result.broadcasts.map((room) => room.gameId),
      ...(result.roomClosures ?? []).map((closure) => closure.gameId),
    ];
  }

  private createInvitePath(gameId: RoomGameId, roomId: RoomId): string {
    const query = `?game=${encodeURIComponent(gameId)}&room=${encodeURIComponent(roomId)}`;
    const currentPublicBaseUrl = this.publicBaseUrl();
    if (!currentPublicBaseUrl) {
      return `/${query}`;
    }
    return `${currentPublicBaseUrl}/${query}`;
  }
}
