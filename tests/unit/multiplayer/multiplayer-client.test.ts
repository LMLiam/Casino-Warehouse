import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { adminTokenStorageKey } from '../../../src/multiplayer/client/adminTokenStorageKey';
import { defaultRealtimeUrl } from '../../../src/multiplayer/client/defaultRealtimeUrl';
import { MultiplayerClient } from '../../../src/multiplayer/client/MultiplayerClient';
import type { MultiplayerClientEvents } from '../../../src/multiplayer/client/MultiplayerClientEvents';
import { profileTokensStorageKey } from '../../../src/multiplayer/client/profileTokensStorageKey';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { ServerMessage } from '../../../src/multiplayer/protocol/ServerMessage';

class FakeWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static instances: FakeWebSocket[] = [];
  public static throwOnConstruct = false;
  public readyState = 0;
  public readonly sent: string[] = [];
  private readonly listeners = new Map<string, Array<(event: { readonly data?: string }) => void>>();

  public constructor(public readonly url: string) {
    if (FakeWebSocket.throwOnConstruct) {
      throw new Error('Blocked socket constructor.');
    }
    FakeWebSocket.instances.push(this);
  }

  public addEventListener(type: string, listener: (event: { readonly data?: string }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  public send(payload: string): void {
    this.sent.push(payload);
  }

  public close(): void {
    this.readyState = 3;
    this.emit('close');
  }

  public open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open');
  }

  public serverMessage(message: ServerMessage): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  public rawMessage(data: string): void {
    this.emit('message', { data });
  }

  public fail(): void {
    this.emit('error');
  }

  private emit(type: string, event: { readonly data?: string } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
  FakeWebSocket.throwOnConstruct = false;
});

describe('multiplayer realtime client reconnect reloads', () => {
  it('sends the previous server instance id on reconnect and reloads when the server requires it', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:', reload },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);

    client.connect('ws://casino.test/ws');
    const firstSocket = FakeWebSocket.instances[0];
    expect(firstSocket.url).toBe('ws://casino.test/ws');
    firstSocket.open();
    firstSocket.serverMessage({ version: 1, type: 'server-hello', serverInstanceId: 'server-before-restart' });

    firstSocket.close();
    vi.advanceTimersByTime(1_000);
    const reconnectSocket = FakeWebSocket.instances[1];
    expect(reconnectSocket.url).toBe('ws://casino.test/ws?clientServerInstanceId=server-before-restart');

    reconnectSocket.open();
    reconnectSocket.serverMessage({
      version: 1,
      type: 'reload-required',
      reason: 'server-restarted',
      message: 'The game server restarted. Reload the app to use the latest client.',
    });

    expect(events.onStatus).toHaveBeenCalledWith('The game server restarted. Reload the app to use the latest client.');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('routes server messages, heartbeat replies, and room state through callbacks', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);
    expect(client.send({ version: 1, type: 'request-data' })).toBe(false);
    expect(events.onError).toHaveBeenCalledWith('Connect to the game server first.');

    client.connect('ws://casino.test/ws');
    const socket = FakeWebSocket.instances[0];
    socket.open();
    expect(events.onConnectionState).toHaveBeenCalledWith('connected');
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ type: 'request-data' });

    const profileState = { version: 1 as const, profiles: [] };
    socket.serverMessage({ version: 1, type: 'data-state', database: 'memory', profileState });
    expect(events.onDataState).toHaveBeenCalledWith({ database: 'memory', profileState, session: undefined });

    socket.serverMessage({ version: 1, type: 'heartbeat', sentAt: 123 });
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ version: 1, type: 'heartbeat-ack', sentAt: 123 });

    const room = createRoomSnapshot();
    socket.serverMessage({ version: 1, type: 'room-created', room, invitePath: '/?game=beat-the-house&room=ROOM42' });
    expect(client.room).toMatchObject({ roomId: room.roomId, revision: room.revision });
    expect(events.onRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: room.roomId, revision: room.revision }));
    expect(events.onStatus).toHaveBeenCalledWith('Beat the House room ROOM42 ready. Invite path: /?game=beat-the-house&room=ROOM42');

    socket.serverMessage({ version: 1, type: 'room-list', gameId: 'beat-the-house', rooms: [] });
    expect(events.onRoomList).toHaveBeenCalledWith('beat-the-house', []);

    const revisedRoom = { ...room, revision: 2 };
    socket.serverMessage({ version: 1, type: 'room-state', room: revisedRoom });
    expect(client.room).toMatchObject({ roomId: room.roomId, revision: 2 });
    expect(events.onRoom).toHaveBeenCalledWith(expect.objectContaining({ roomId: room.roomId, revision: 2 }));

    socket.serverMessage({
      version: 1,
      type: 'settlement',
      roomId: room.roomId,
      sessionId: room.sessionId,
      settlements: [{ id: 's1', profileId: 'alice', seatId: 'left', wagered: 25, returned: 50, profit: 25 }],
    });
    expect(events.onSettlement).toHaveBeenCalledWith([{ id: 's1', profileId: 'alice', seatId: 'left', wagered: 25, returned: 50, profit: 25 }], {
      roomId: room.roomId,
      sessionId: room.sessionId,
      settlements: [{ id: 's1', profileId: 'alice', seatId: 'left', wagered: 25, returned: 50, profit: 25 }],
      type: 'settlement',
      version: 1,
    });

    client.clearRoomState();
    expect(events.onRoomCleared).toHaveBeenCalledOnce();
    expect(client.room).toBeUndefined();
  });

  it('handles realtime errors, invalid messages, default URLs, and outbound room commands', () => {
    vi.useFakeTimers();
    const localStorage = {
      getItem: vi.fn((key: string) => (key === 'casino_realtime_url' ? 'wss://saved.example/ws' : null)),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'https://casino.test/play', host: 'casino.test', protocol: 'https:' },
      setInterval,
      setTimeout,
    });
    expect(defaultRealtimeUrl()).toBe('wss://saved.example/ws');
    localStorage.getItem.mockReturnValue(null);
    expect(defaultRealtimeUrl()).toBe('wss://casino.test/ws');

    const events = createEvents();
    const client = new MultiplayerClient(events);
    client.connect('ws://casino.test/ws');
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.serverMessage({ version: 1, type: 'profile-access', ownedProfileIds: ['profile-a'] });
    socket.serverMessage({ version: 1, type: 'admin-access', authorized: true });
    socket.rawMessage('{broken');
    expect(events.onError).toHaveBeenCalledWith('Received an invalid server message.');

    socket.serverMessage({ version: 1, type: 'error', code: 'connected', message: 'Connected.' });
    expect(events.onStatus).toHaveBeenCalledWith('Connected.');
    socket.serverMessage({ version: 1, type: 'error', code: 'rejected', message: 'Room was not found.' });
    expect(events.onError).toHaveBeenCalledWith('Room was not found.');
    socket.fail();
    expect(events.onError).toHaveBeenCalledWith('Game server connection failed.');

    client.requestData();
    client.createProfile('Alice');
    client.renameProfile('profile-a', 'Alicia');
    client.saveSession({
      profileId: 'profile-a',
      activeGame: 'beat-the-house',
      showingGameLobby: true,
      wagerLimit: 0,
      wagered: 0,
    });
    client.adjustBankroll('profile-a', 'add', 100);
    client.resetAllBankrolls();
    client.clearServerData();
    client.listRooms('blackjack');
    socket.serverMessage({ version: 1, type: 'profile-access', ownedProfileIds: ['profile-a'] });
    client.acceptHouseAdvance('profile-a');
    client.createRoom('beat-the-house', 'QA Room', 3, 'profile-a', 'Alice', 1000);
    client.joinRoom('beat-the-house', 'ROOM42', 'player', 'profile-a', 'Alice', 1000);
    client.deleteProfile('profile-a');
    client.leaveRoom();

    expect(socket.sent.map((payload) => JSON.parse(payload).type)).toEqual(
      expect.arrayContaining([
        'request-data',
        'create-profile',
        'rename-profile',
        'house-advance',
        'delete-profile',
        'save-session',
        'admin-bankroll',
        'admin-reset-all',
        'clear-server-data',
        'list-rooms',
        'create-room',
        'join-room',
        'leave-room',
      ]),
    );
  });

  it('clears invalid saved realtime URLs before falling back to the current host', () => {
    const localStorage = createMemoryStorage();
    localStorage.setItem('casino_realtime_url', 'https://saved.example/ws');
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('window', {
      location: { href: 'https://casino.test/play', host: 'casino.test', protocol: 'https:' },
    });

    expect(defaultRealtimeUrl()).toBe('wss://casino.test/ws');
    expect(localStorage.getItem('casino_realtime_url')).toBeNull();

    localStorage.setItem('casino_realtime_url', 'not-a-url');

    expect(defaultRealtimeUrl()).toBe('wss://casino.test/ws');
    expect(localStorage.getItem('casino_realtime_url')).toBeNull();
  });

  it('uses a server-provided runtime realtime URL before saved storage and the current host', () => {
    const localStorage = createMemoryStorage();
    localStorage.setItem('casino_realtime_url', 'wss://saved.example/ws');
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('document', {
      querySelector: vi.fn((selector: string) => (selector === 'meta[name="casino-realtime-url"]' ? { content: 'wss://ws.casino.test/ws' } : null)),
    });
    vi.stubGlobal('window', {
      location: { href: 'https://casino.test/play', host: 'casino.test', protocol: 'https:' },
    });

    expect(defaultRealtimeUrl()).toBe('wss://ws.casino.test/ws');
  });

  it('rejects unsupported realtime URLs without constructing a WebSocket', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);

    client.connect('https://casino.test/ws');

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(events.onConnectionState).toHaveBeenCalledWith('disconnected');
    expect(events.onError).toHaveBeenCalledWith('Game server URL must use ws:// or wss://.');

    client.connect('not-a-url');

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(events.onError).toHaveBeenCalledWith('Game server URL must use ws:// or wss://.');
  });

  it('reports WebSocket constructor failures as recoverable connection errors', () => {
    vi.useFakeTimers();
    FakeWebSocket.throwOnConstruct = true;
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);

    client.connect('ws://casino.test/ws');

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(events.onConnectionState).toHaveBeenCalledWith('connecting');
    expect(events.onConnectionState).toHaveBeenCalledWith('disconnected');
    expect(events.onError).toHaveBeenCalledWith('Game server connection failed. Check the realtime server URL.');
  });

  it('closes stalled WebSocket handshakes so reconnects can continue', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);

    client.connect('ws://casino.test/ws');
    const firstSocket = FakeWebSocket.instances[0];

    vi.advanceTimersByTime(10_000);

    expect(firstSocket.readyState).toBe(3);
    expect(events.onConnectionState).toHaveBeenCalledWith('reconnecting');

    vi.advanceTimersByTime(1_000);

    expect(FakeWebSocket.instances[1].url).toBe('ws://casino.test/ws');
  });

  it('clears active room state when the server closes that room', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);
    client.connect('ws://casino.test/ws');
    const socket = FakeWebSocket.instances[0];
    socket.open();
    const room = createRoomSnapshot();
    socket.serverMessage({ version: 1, type: 'room-created', room, invitePath: '/?game=beat-the-house&room=ROOM42' });

    socket.serverMessage({ version: 1, type: 'room-closed', roomId: room.roomId, gameId: room.gameId, reason: 'profile-deleted' });

    expect(client.room).toBeUndefined();
    expect(events.onRoomCleared).toHaveBeenCalledOnce();
    expect(events.onStatus).toHaveBeenCalledWith('Room ROOM42 closed: profile-deleted.');
  });

  it('stores profile credentials and gates owned-profile and admin commands', () => {
    vi.useFakeTimers();
    const localStorage = createMemoryStorage();
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'https://casino.test/play', host: 'casino.test', protocol: 'https:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);
    client.connect('ws://casino.test/ws');
    const socket = FakeWebSocket.instances[0];
    socket.open();

    expect(socket.sent.map((payload) => JSON.parse(payload).type)).toEqual(['authorize-profiles', 'request-data']);

    client.createRoom('beat-the-house', 'Blocked Room', 3, 'profile-a', 'Alice', 1000);
    client.acceptHouseAdvance('profile-a');
    client.adjustBankroll('profile-a', 'add', 100);
    expect(events.onError).toHaveBeenCalledWith('This browser does not own that server profile.');
    expect(events.onError).toHaveBeenCalledWith('Admin controls are locked for this browser.');

    socket.serverMessage({ version: 1, type: 'profile-credentials', profileId: 'profile-a', profileToken: 'profile-token' });
    expect(JSON.parse(localStorage.getItem(profileTokensStorageKey) ?? '[]')).toEqual([{ profileId: 'profile-a', profileToken: 'profile-token' }]);

    socket.serverMessage({ version: 1, type: 'profile-access', ownedProfileIds: ['profile-a'] });
    expect(client.ownsProfile('profile-a')).toBe(true);
    expect(events.onProfileAccess).toHaveBeenCalledWith(['profile-a']);
    client.createRoom('beat-the-house', 'Allowed Room', 3, 'profile-a', 'Alice', 1000);
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ type: 'create-room', profileId: 'profile-a' });
    client.acceptHouseAdvance('profile-a');
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ type: 'house-advance', profileId: 'profile-a' });

    client.authorizeAdmin(' admin-secret ');
    expect(localStorage.getItem(adminTokenStorageKey)).toBe('admin-secret');
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({ version: 1, type: 'authorize-admin', adminToken: 'admin-secret' });

    socket.serverMessage({ version: 1, type: 'admin-access', authorized: false });
    expect(localStorage.getItem(adminTokenStorageKey)).toBeNull();
    expect(client.hasAdminAccess).toBe(false);

    socket.serverMessage({ version: 1, type: 'admin-access', authorized: true });
    client.adjustBankroll('profile-a', 'add', 100);
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ type: 'admin-bankroll', profileId: 'profile-a' });
  });

  it('covers client-side ownership, admin token, stale socket, and heartbeat edge cases', () => {
    vi.useFakeTimers();
    const localStorage = createMemoryStorage();
    localStorage.setItem(profileTokensStorageKey, JSON.stringify({ 'profile-a': 'token-a' }));
    localStorage.setItem(adminTokenStorageKey, 'stored-admin-token');
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'http://casino.test/', host: 'casino.test', protocol: 'http:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);

    client.saveSession({
      profileId: 'profile-a',
      activeGame: 'beat-the-house',
      showingGameLobby: true,
      wagerLimit: 0,
      wagered: 0,
    });
    client.authorizeAdmin('   ');
    expect(events.onError).toHaveBeenCalledWith('This browser does not own this session profile.');
    expect(events.onError).toHaveBeenCalledWith('Enter an admin token first.');

    client.connect('ws://first.casino.test/ws');
    const staleSocket = FakeWebSocket.instances[0];
    client.connect('ws://second.casino.test/ws');
    staleSocket.open();
    staleSocket.close();
    expect(events.onConnectionState).not.toHaveBeenCalledWith('connected');

    const socket = FakeWebSocket.instances[1];
    socket.open();
    expect(socket.sent.map((payload) => JSON.parse(payload))).toEqual([
      { version: 1, type: 'authorize-profiles', profileTokens: [{ profileId: 'profile-a', profileToken: 'token-a' }] },
      { version: 1, type: 'authorize-admin', adminToken: 'stored-admin-token' },
      { version: 1, type: 'request-data' },
    ]);

    socket.serverMessage({ version: 1, type: 'profile-access', ownedProfileIds: ['profile-a'] });
    const snapshot = new BeatTheHouseGame({ initialBankroll: 1000 }).saveState();
    client.saveSession({
      profileId: 'profile-a',
      activeGame: 'beat-the-house',
      showingGameLobby: true,
      wagerLimit: 0,
      wagered: 0,
      gameSnapshot: { beatTheHouse: snapshot },
    });
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({
      session: { gameSnapshot: { beatTheHouse: expect.objectContaining({ phase: 'betting' }) } },
      type: 'save-session',
    });

    vi.advanceTimersByTime(61_000);

    expect(events.onConnectionState).toHaveBeenCalledWith('reconnecting');
    expect(socket.readyState).toBe(3);
  });

  it('tolerates malformed and unavailable browser credential storage', () => {
    vi.useFakeTimers();
    const malformedStorage = createMemoryStorage();
    malformedStorage.setItem(profileTokensStorageKey, '{bad json');
    vi.stubGlobal('localStorage', malformedStorage);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'https://casino.test/play', host: 'casino.test', protocol: 'https:' },
      setInterval,
      setTimeout,
    });

    const malformedEvents = createEvents();
    const malformedClient = new MultiplayerClient(malformedEvents);
    malformedClient.connect('wss://casino.test/ws');
    FakeWebSocket.instances[0].open();
    expect(JSON.parse(FakeWebSocket.instances[0].sent[0])).toEqual({ version: 1, type: 'authorize-profiles', profileTokens: [] });

    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error('storage unavailable');
      }),
      removeItem: vi.fn(() => {
        throw new Error('storage unavailable');
      }),
      setItem: vi.fn(() => {
        throw new Error('storage unavailable');
      }),
    };
    vi.stubGlobal('localStorage', throwingStorage);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      clearInterval,
      clearTimeout,
      location: { href: 'https://casino.test/play', host: 'casino.test', protocol: 'https:' },
      setInterval,
      setTimeout,
    });

    const events = createEvents();
    const client = new MultiplayerClient(events);
    client.connect('wss://casino.test/ws');
    const socket = FakeWebSocket.instances[0];
    socket.open();

    socket.serverMessage({ version: 1, type: 'profile-credentials', profileId: 'profile-a', profileToken: 'token-a' });
    socket.serverMessage({ version: 1, type: 'admin-access', authorized: false });
    socket.serverMessage({ version: 1, type: 'room-closed', roomId: 'OTHER', gameId: 'beat-the-house', reason: 'profile-deleted' });

    expect(throwingStorage.getItem).toHaveBeenCalled();
    expect(throwingStorage.setItem).toHaveBeenCalled();
    expect(throwingStorage.removeItem).toHaveBeenCalled();
    expect(events.onAdminAccess).toHaveBeenCalledWith(false);
    expect(events.onRoomCleared).not.toHaveBeenCalled();
  });
});

const createEvents = (): MultiplayerClientEvents => ({
  onConnectionState: vi.fn(),
  onProfileAccess: vi.fn(),
  onAdminAccess: vi.fn(),
  onDataState: vi.fn(),
  onError: vi.fn(),
  onRoom: vi.fn(),
  onRoomCleared: vi.fn(),
  onRoomList: vi.fn(),
  onSettlement: vi.fn(),
  onStatus: vi.fn(),
});

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  };
};

const createRoomSnapshot = (): RoomSnapshot => ({
  roomId: 'ROOM42',
  roomName: 'Room 42',
  hostProfileId: 'alice',
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'betting',
  phase: 'betting',
  sessionId: 'session-1',
  revision: 1,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1,
  updatedAt: 2,
  players: [{ connectionId: 'conn-a', profileId: 'alice', profileName: 'Alice', bankroll: 1000, sessionStartBankroll: 1000, role: 'player' }],
  spectators: [],
  seats: [{ seatId: 'left', profileId: 'alice' }],
  game: new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot(),
});
