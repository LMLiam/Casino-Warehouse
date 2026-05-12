import type { ClientMessage } from '../protocol/ClientMessage';
import { decodeServerMessage } from '../protocol/decodeServerMessage';
import { encodeMessage } from '../protocol/encodeMessage';
import { protocolVersion } from '../protocol/protocolVersion';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomRole } from '../protocol/RoomRole';
import type { RoomSeatId } from '../protocol/RoomSeatId';
import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import { defaultRealtimeUrl } from './defaultRealtimeUrl';
import type { MultiplayerClientEvents } from './MultiplayerClientEvents';
import type { RealtimeConnectionState } from './RealtimeConnectionState';

export class MultiplayerClient {
  private socket?: WebSocket;
  private lastRoom?: RoomSnapshot;
  private reconnectUrl = '';
  private reconnectTimer: number | undefined;
  private heartbeatTimer: number | undefined;
  private lastHeartbeatAt = 0;
  private serverInstanceId = '';

  public constructor(private readonly events: MultiplayerClientEvents) {}

  public get room(): RoomSnapshot | undefined {
    return this.lastRoom;
  }

  public get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public connect(url = defaultRealtimeUrl()): void {
    this.reconnectUrl = url;
    window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.openSocket(url, 'connecting');
  }

  public requestData(): void {
    this.send({ version: protocolVersion, type: 'request-data' });
  }

  public createProfile(profileName: string): void {
    this.send({ version: protocolVersion, type: 'create-profile', profileName });
  }

  public renameProfile(profileId: string, profileName: string): void {
    this.send({ version: protocolVersion, type: 'rename-profile', profileId, profileName });
  }

  public deleteProfile(profileId: string): void {
    this.send({ version: protocolVersion, type: 'delete-profile', profileId });
  }

  public saveSession(session: Omit<CasinoSessionState, 'version' | 'updatedAt'>): void {
    this.send({
      version: protocolVersion,
      type: 'save-session',
      session: {
        ...session,
        profileIds: [...session.profileIds],
        gameSnapshots: Object.fromEntries(Object.entries(session.gameSnapshots).map(([profileId, snapshots]) => [profileId, { ...snapshots }])),
      },
    });
  }

  public adjustBankroll(profileId: string, action: 'add' | 'subtract' | 'reset', amount?: number): void {
    this.send({ version: protocolVersion, type: 'admin-bankroll', profileId, action, amount });
  }

  public resetAllBankrolls(): void {
    this.send({ version: protocolVersion, type: 'admin-reset-all' });
  }

  public clearServerData(): void {
    this.send({ version: protocolVersion, type: 'clear-server-data' });
  }

  private openSocket(url: string, state: RealtimeConnectionState): void {
    this.events.onConnectionState(state);
    this.events.onStatus(`Connecting to ${url}`);
    const socket = new WebSocket(this.socketUrl(url, state));
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }
      this.lastHeartbeatAt = Date.now();
      this.events.onConnectionState('connected');
      this.events.onStatus('Connected to the game server.');
      this.startHeartbeatMonitor();
      this.requestData();
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }
      this.events.onConnectionState('reconnecting');
      this.events.onStatus('Connection lost. Reconnecting... Actions are paused.');
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => this.events.onError('Game server connection failed.'));
    socket.addEventListener('message', (event) => this.receive(String(event.data)));
  }

  public listRooms(gameId: RoomGameId): void {
    this.send({ version: protocolVersion, type: 'list-rooms', gameId });
  }

  public createRoom(gameId: RoomGameId, roomName: string, maxPlayers: number, profileId: string, profileName: string, bankroll: number): void {
    this.send({ version: protocolVersion, type: 'create-room', gameId, roomName, maxPlayers, allowSpectators: true, profileId, profileName, bankroll });
  }

  public joinRoom(gameId: RoomGameId, roomId: string, role: RoomRole, profileId: string, profileName: string, bankroll: number, seatId?: RoomSeatId): void {
    this.send({ version: protocolVersion, type: 'join-room', gameId, roomId, role, profileId, profileName, bankroll, seatId });
  }

  public leaveRoom(): void {
    this.send({ version: protocolVersion, type: 'leave-room' });
    this.lastRoom = undefined;
  }

  public clearRoomState(): void {
    this.clearRoom();
  }

  public send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.events.onError('Connect to the game server first.');
      return false;
    }
    this.socket.send(encodeMessage(message));
    return true;
  }

  private scheduleReconnect(): void {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.openSocket(this.reconnectUrl || defaultRealtimeUrl(), 'reconnecting'), 1_000);
  }

  private clearRoom(): void {
    if (!this.lastRoom) {
      return;
    }
    this.lastRoom = undefined;
    this.events.onRoomCleared();
  }

  private startHeartbeatMonitor(): void {
    window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.connected) {
        return;
      }
      if (Date.now() - this.lastHeartbeatAt > 60_000) {
        this.events.onConnectionState('reconnecting');
        this.socket?.close();
      }
    }, 1_000);
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
      this.send({ version: protocolVersion, type: 'heartbeat-ack', sentAt: message.sentAt });
      return;
    }
    if (message.type === 'server-hello') {
      this.serverInstanceId = message.serverInstanceId;
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
}
