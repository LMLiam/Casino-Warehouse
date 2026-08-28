import type { ClientMessage } from '../protocol/ClientMessage';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import { playerGameSnapshotsSchema } from '../../schemas/casinoSchemas/playerGameSnapshotsSchema';
import { profileTokenStorageSchema } from '../../schemas/casinoSchemas/profileTokenStorageSchema';
import { decodeServerMessage } from '../protocol/decodeServerMessage';
import { encodeMessage } from '../protocol/encodeMessage';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { RoomRole } from '../protocol/RoomRole';
import type { RoomSeatId } from '../protocol/RoomSeatId';
import type { RoomSnapshot } from '../protocol/RoomSnapshot';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import { adminTokenStorageKey } from './adminTokenStorageKey';
import { defaultRealtimeUrl } from './defaultRealtimeUrl';
import type { MultiplayerClientEvents } from './MultiplayerClientEvents';
import { normalizeRealtimeUrl } from './normalizeRealtimeUrl';
import { profileTokensStorageKey } from './profileTokensStorageKey';
import type { RealtimeConnectionState } from './RealtimeConnectionState';

export class MultiplayerClient {
  private static readonly webSocketConnectTimeoutMs = 10_000;
  private static readonly reconnectDelayMs = 1_000;
  private static readonly heartbeatTimeoutMs = 60_000;
  private static readonly heartbeatIntervalMs = 1_000;

  private socket?: WebSocket;
  private lastRoom?: RoomSnapshot;
  private readonly ownedProfileIds = new Set<string>();
  private reconnectUrl = '';
  private reconnectTimer: number | undefined;
  private heartbeatTimer: number | undefined;
  private lastHeartbeatAt = 0;
  private serverInstanceId = '';
  private adminAuthorized = false;

  public constructor(private readonly events: MultiplayerClientEvents) {}

  public get room(): RoomSnapshot | undefined {
    return this.lastRoom;
  }

  public get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public get hasAdminAccess(): boolean {
    return this.adminAuthorized;
  }

  public ownsProfile(profileId: string): boolean {
    return this.ownedProfileIds.has(profileId);
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

  public createProfile(profileName: string): void {
    this.send({ type: 'create-profile', profileName });
  }

  public renameProfile(profileId: string, profileName: string): void {
    this.sendOwnedProfileMessage(profileId, { type: 'rename-profile', profileId, profileName });
  }

  public deleteProfile(profileId: string): void {
    if (this.sendOwnedProfileMessage(profileId, { type: 'delete-profile', profileId })) {
      this.forgetProfileToken(profileId);
    }
  }

  public acceptHouseAdvance(profileId: string): void {
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

  public adjustBankroll(profileId: string, action: 'add' | 'subtract' | 'reset', amount?: number): void {
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
    MultiplayerClient.writeStorageValue(adminTokenStorageKey, token);
    this.send({ type: 'authorize-admin', adminToken: token });
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
    }, MultiplayerClient.webSocketConnectTimeoutMs);
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

  public listRooms(gameId: RoomGameId): void {
    this.send({ type: 'list-rooms', gameId });
  }

  public createRoom(gameId: RoomGameId, roomName: string, maxPlayers: number, profileId: string, profileName: string, bankroll: number): void {
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

  public joinRoom(gameId: RoomGameId, roomId: string, role: RoomRole, profileId: string, profileName: string, bankroll: number, seatId?: RoomSeatId): void {
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

  public send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.events.onError('Connect to the game server first.');
      return false;
    }
    this.socket.send(encodeMessage(message));
    return true;
  }

  private sendOwnedProfileMessage(profileId: string, message: ClientMessage): boolean {
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

  private scheduleReconnect(): void {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(
      () => this.openSocket(this.reconnectUrl || defaultRealtimeUrl(), 'reconnecting'),
      MultiplayerClient.reconnectDelayMs,
    );
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
      if (Date.now() - this.lastHeartbeatAt > MultiplayerClient.heartbeatTimeoutMs) {
        this.events.onConnectionState('reconnecting');
        this.socket?.close();
      }
    }, MultiplayerClient.heartbeatIntervalMs);
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
        MultiplayerClient.removeStorageValue(adminTokenStorageKey);
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
      profileTokens: MultiplayerClient.profileTokenEntries(MultiplayerClient.readProfileTokens()),
    });
  }

  private authorizeStoredAdminToken(): void {
    const adminToken = MultiplayerClient.readStorageValue(adminTokenStorageKey);
    if (adminToken) {
      this.send({ type: 'authorize-admin', adminToken });
    }
  }

  private storeProfileToken(profileId: string, profileToken: string): void {
    const profileTokens = MultiplayerClient.readProfileTokens();
    profileTokens.set(profileId, profileToken);
    MultiplayerClient.writeProfileTokens(profileTokens);
  }

  private forgetProfileToken(profileId: string): void {
    const profileTokens = MultiplayerClient.readProfileTokens();
    profileTokens.delete(profileId);
    MultiplayerClient.writeProfileTokens(profileTokens);
    this.ownedProfileIds.delete(profileId);
  }

  private clearProfileTokens(): void {
    MultiplayerClient.removeStorageValue(profileTokensStorageKey);
    this.ownedProfileIds.clear();
    this.events.onProfileAccess([]);
  }

  private pruneStoredProfileTokens(ownedProfileIds: readonly string[]): void {
    const owned = new Set(ownedProfileIds);
    const profileTokens = MultiplayerClient.readProfileTokens();
    for (const profileId of profileTokens.keys()) {
      if (!owned.has(profileId)) {
        profileTokens.delete(profileId);
      }
    }
    MultiplayerClient.writeProfileTokens(profileTokens);
  }

  private static readProfileTokens(): Map<string, string> {
    const value = MultiplayerClient.readStorageValue(profileTokensStorageKey);
    if (!value) {
      return new Map();
    }
    try {
      const parsed = profileTokenStorageSchema.parse(parseJsonText(value));
      return new Map(parsed.map((entry) => [entry.profileId, entry.profileToken]));
    } catch {
      return new Map();
    }
  }

  private static writeProfileTokens(profileTokens: ReadonlyMap<string, string>): void {
    MultiplayerClient.writeStorageValue(profileTokensStorageKey, JSON.stringify(MultiplayerClient.profileTokenEntries(profileTokens)));
  }

  private static profileTokenEntries(profileTokens: ReadonlyMap<string, string>): { readonly profileId: string; readonly profileToken: string }[] {
    return [...profileTokens.entries()].map(([profileId, profileToken]) => ({ profileId, profileToken }));
  }

  private static readStorageValue(key: string): string {
    try {
      return globalThis.localStorage?.getItem(key) ?? '';
    } catch {
      return '';
    }
  }

  private static writeStorageValue(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Browser storage can be unavailable in private contexts; the server remains authoritative.
    }
  }

  private static removeStorageValue(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Browser storage can be unavailable in private contexts; the server remains authoritative.
    }
  }
}
