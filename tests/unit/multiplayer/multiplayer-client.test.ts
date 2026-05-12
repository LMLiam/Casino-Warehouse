import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { defaultRealtimeUrl } from '../../../src/multiplayer/client/defaultRealtimeUrl';
import { MultiplayerClient } from '../../../src/multiplayer/client/MultiplayerClient';
import type { MultiplayerClientEvents } from '../../../src/multiplayer/client/MultiplayerClientEvents';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { ServerMessage } from '../../../src/multiplayer/protocol/ServerMessage';

class FakeWebSocket {
  public static readonly OPEN = 1;
  public static instances: FakeWebSocket[] = [];
  public readyState = 0;
  public readonly sent: string[] = [];
  private readonly listeners = new Map<string, Array<(event: { readonly data?: string }) => void>>();

  public constructor(public readonly url: string) {
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
    client.deleteProfile('profile-a');
    client.saveSession({
      profileIds: ['profile-a'],
      selectedPlayerIndex: 0,
      activeGame: 'beat-the-house',
      showingGameLobby: true,
      wagerLimit: 0,
      wagered: 0,
      gameSnapshots: {},
    });
    client.adjustBankroll('profile-a', 'add', 100);
    client.resetAllBankrolls();
    client.clearServerData();
    client.listRooms('blackjack');
    client.createRoom('beat-the-house', 'QA Room', 3, 'profile-a', 'Alice', 1000);
    client.joinRoom('beat-the-house', 'ROOM42', 'player', 'profile-a', 'Alice', 1000);
    client.leaveRoom();

    expect(socket.sent.map((payload) => JSON.parse(payload).type)).toEqual(
      expect.arrayContaining([
        'request-data',
        'create-profile',
        'rename-profile',
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
});

const createEvents = (): MultiplayerClientEvents => ({
  onConnectionState: vi.fn(),
  onDataState: vi.fn(),
  onError: vi.fn(),
  onRoom: vi.fn(),
  onRoomCleared: vi.fn(),
  onRoomList: vi.fn(),
  onSettlement: vi.fn(),
  onStatus: vi.fn(),
});

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
