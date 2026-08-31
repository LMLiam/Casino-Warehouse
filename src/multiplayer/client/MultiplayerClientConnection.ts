import type { ClientMessage } from '../protocol/ClientMessage';
import { authTokenSchema } from '../../schemas/casinoSchemas/authTokenSchema';
import { decodeServerMessage } from '../protocol/decodeServerMessage';
import { encodeMessage } from '../protocol/encodeMessage';
import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { ServerInstanceId } from '../../schemas/casinoSchemas/ServerInstanceId';
import { adminTokenStorageKey } from './adminTokenStorageKey';
import { defaultRealtimeUrl } from './defaultRealtimeUrl';
import { normalizeRealtimeUrl } from './normalizeRealtimeUrl';
import type { RealtimeConnectionState } from './RealtimeConnectionState';
import { MultiplayerClientStorage } from './MultiplayerClientStorage';

export abstract class MultiplayerClientConnection extends MultiplayerClientStorage {
  private static readonly webSocketConnectTimeoutMs = 10_000;
  private static readonly reconnectDelayMs = 1_000;
  private static readonly heartbeatTimeoutMs = 60_000;
  private static readonly heartbeatIntervalMs = 1_000;

  protected socket?: WebSocket | undefined;
  protected lastRoom?: RoomSnapshot | undefined;
  private reconnectTimer: number | undefined;
  private heartbeatTimer: number | undefined;
  private lastHeartbeatAt = 0;
  protected serverInstanceId: ServerInstanceId | undefined;
  private reconnectUrl = '';

  public get room(): RoomSnapshot | undefined {
    return this.lastRoom;
  }

  public get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public connect(url = defaultRealtimeUrl()): void {
    const normalizedUrl = normalizeRealtimeUrl(url);
    window.clearTimeout(this.reconnectTimer);
    const previousSocket = this.socket;
    this.socket = undefined;
    previousSocket?.close();
    if (!normalizedUrl) {
      this.reconnectUrl = '';
      this.events.onConnectionState('disconnected');
      this.events.onError('Game server URL must use ws:// or wss://.');
      return;
    }
    this.reconnectUrl = normalizedUrl;
    this.openSocket(normalizedUrl, 'connecting');
  }

  public requestData(): void {
    this.send({ type: 'request-data' });
  }

  public send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.events.onError('Connect to the game server first.');
      return false;
    }
    this.socket.send(encodeMessage(message));
    return true;
  }

  protected clearRoom(): void {
    if (!this.lastRoom) {
      return;
    }
    this.lastRoom = undefined;
    this.events.onRoomCleared();
  }

  private openSocket(url: string, state: RealtimeConnectionState): void {
    this.events.onConnectionState(state);
    this.events.onStatus(`Connecting to ${url}`);
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.socketUrl(url, state));
    } catch {
      this.socket = undefined;
      this.reconnectUrl = '';
      this.events.onConnectionState('disconnected');
      this.events.onError('Game server connection failed. Check the realtime server URL.');
      return;
    }
    this.socket = socket;
    const connectTimeout = window.setTimeout(() => {
      if (this.socket === socket && socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }, MultiplayerClientConnection.webSocketConnectTimeoutMs);
    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }
      window.clearTimeout(connectTimeout);
      this.lastHeartbeatAt = Date.now();
      this.events.onConnectionState('connected');
      this.events.onStatus('Connected to the game server.');
      this.startHeartbeatMonitor();
      this.authorizeStoredProfiles();
      this.authorizeStoredAdminToken();
      this.requestData();
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }
      window.clearTimeout(connectTimeout);
      this.events.onConnectionState('reconnecting');
      this.events.onStatus('Connection lost. Reconnecting... Actions are paused.');
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      window.clearTimeout(connectTimeout);
      this.events.onError('Game server connection failed.');
    });
    socket.addEventListener('message', (event) => this.receive(String(event.data)));
  }

  private scheduleReconnect(): void {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(
      () => this.openSocket(this.reconnectUrl || defaultRealtimeUrl(), 'reconnecting'),
      MultiplayerClientConnection.reconnectDelayMs,
    );
  }

  private startHeartbeatMonitor(): void {
    window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.connected) {
        return;
      }
      if (Date.now() - this.lastHeartbeatAt > MultiplayerClientConnection.heartbeatTimeoutMs) {
        this.events.onConnectionState('reconnecting');
        this.socket?.close();
      }
    }, MultiplayerClientConnection.heartbeatIntervalMs);
  }

  private receive(data: string): void {
    const message = decodeServerMessage(data);
    if (!message) {
      this.events.onError('Received an invalid server message.');
      return;
    }
    if (this.connected) {
      this.lastHeartbeatAt = Date.now();
      this.events.onConnectionState('connected');
    }
    if (message.type === 'error') {
      if (message.code === 'connected') {
        this.events.onStatus(message.message);
      } else {
        this.events.onError(message.message);
      }
      return;
    }
    if (message.type === 'heartbeat') {
      this.lastHeartbeatAt = Date.now();
      this.send({ type: 'heartbeat-ack', sentAt: message.sentAt });
      return;
    }
    if (message.type === 'server-hello') {
      this.serverInstanceId = message.serverInstanceId;
      return;
    }
    if (message.type === 'profile-credentials') {
      this.storeProfileToken(message.profileId, message.profileToken);
      return;
    }
    if (message.type === 'profile-access') {
      this.ownedProfileIds.clear();
      message.ownedProfileIds.forEach((profileId) => this.ownedProfileIds.add(profileId));
      this.pruneStoredProfileTokens(message.ownedProfileIds);
      this.events.onProfileAccess(message.ownedProfileIds);
      return;
    }
    if (message.type === 'admin-access') {
      this.adminAuthorized = message.authorized;
      if (!message.authorized) {
        MultiplayerClientStorage.removeStorageValue(adminTokenStorageKey);
      }
      this.events.onAdminAccess(message.authorized);
      return;
    }
    if (message.type === 'reload-required') {
      this.events.onStatus(message.message);
      window.location.reload();
      return;
    }
    if (message.type === 'data-state') {
      this.events.onDataState({ database: message.database, profileState: message.profileState, session: message.session });
      return;
    }
    if (message.type === 'room-created') {
      this.lastRoom = message.room;
      this.events.onRoom(message.room);
      this.events.onStatus(`${message.room.gameTitle} room ${message.room.roomId} ready. Invite path: ${message.invitePath}`);
      return;
    }
    if (message.type === 'room-closed') {
      if (this.lastRoom?.roomId === message.roomId) {
        this.clearRoom();
        this.events.onStatus(`Room ${message.roomId} closed: ${message.reason}.`);
      }
      return;
    }
    if (message.type === 'room-list') {
      this.events.onRoomList(message.gameId, message.rooms);
      return;
    }
    if (message.type === 'room-state') {
      this.lastRoom = message.room;
      this.events.onRoom(message.room);
      return;
    }
    if (message.type === 'settlement') {
      this.events.onSettlement(message.settlements, message);
    }
  }

  private socketUrl(url: string, state: RealtimeConnectionState): string {
    if (state !== 'reconnecting' || !this.serverInstanceId) {
      return url;
    }
    try {
      const socketUrl = new URL(url, window.location.href);
      socketUrl.searchParams.set('clientServerInstanceId', this.serverInstanceId);
      return socketUrl.toString();
    } catch {
      return url;
    }
  }

  private authorizeStoredProfiles(): void {
    this.send({
      type: 'authorize-profiles',
      profileTokens: MultiplayerClientStorage.profileTokenEntries(MultiplayerClientStorage.readProfileTokens()),
    });
  }

  private authorizeStoredAdminToken(): void {
    const adminToken = MultiplayerClientStorage.readStorageValue(adminTokenStorageKey);
    const parsedToken = authTokenSchema.safeParse(adminToken);
    if (parsedToken.success) {
      this.send({ type: 'authorize-admin', adminToken: parsedToken.data });
    }
  }
}
