import type { AddressInfo, Socket } from 'node:net';
import { connect as connectSocket } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WebSocket as NodeWebSocket, type RawData as WebSocketRawData } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { createCasinoServer, type CasinoRoomAuthority, type CasinoServer, type CasinoServerOptions } from '../../../src/multiplayer/serverEntry';
import { mainBeatRoomId } from '../../../src/multiplayer/roomAuthority';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import { decodeServerMessage } from '../../../src/multiplayer/protocol/decodeServerMessage';
import { encodeMessage } from '../../../src/multiplayer/protocol/encodeMessage';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { ServerMessage } from '../../../src/multiplayer/protocol/ServerMessage';
import type { CasinoProfile } from '../../../src/state/profiles/CasinoProfile';
import { SqliteServerDataStore } from '../../../src/state/serverDataStore/SqliteServerDataStore';

class SocketProbe {
  private readonly messages: ServerMessage[] = [];
  private readonly waiters: Array<{
    readonly predicate: (message: ServerMessage) => boolean;
    readonly resolve: (message: ServerMessage) => void;
    readonly reject: (error: Error) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }> = [];

  public constructor(private readonly socket: NodeWebSocket) {
    socket.on('message', (data) => {
      const message = decodeServerMessage(webSocketText(data));
      if (message) {
        this.messages.push(message);
        this.flushWaiters(message);
      }
    });
    socket.on('error', () => {
      this.rejectWaiters(new Error('WebSocket emitted an error.'));
    });
  }

  public send(message: ClientMessage): void {
    this.socket.send(encodeMessage(message));
  }

  public sendRaw(payload: string): void {
    this.socket.send(payload);
  }

  public waitFor(predicate: (message: ServerMessage) => boolean, timeoutMs = 2_000): Promise<ServerMessage> {
    const existing = this.messages.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.removeWaiter(waiter);
          reject(new Error('Timed out waiting for WebSocket message.'));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  public received(predicate: (message: ServerMessage) => boolean): readonly ServerMessage[] {
    return this.messages.filter(predicate);
  }

  public checkpoint(): number {
    return this.messages.length;
  }

  public messagesSince(checkpoint: number): readonly ServerMessage[] {
    return this.messages.slice(checkpoint);
  }

  public close(): void {
    this.socket.close();
  }

  public closeAndWait(): Promise<void> {
    if (this.socket.readyState === NodeWebSocket.CLOSED) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(), 250);
      this.socket.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.close();
    });
  }

  public waitForClose(timeoutMs = 1_000): Promise<void> {
    if (this.socket.readyState === NodeWebSocket.CLOSED) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket close.')), timeoutMs);
      this.socket.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private flushWaiters(message: ServerMessage): void {
    for (const waiter of [...this.waiters]) {
      if (waiter.predicate(message)) {
        clearTimeout(waiter.timer);
        this.removeWaiter(waiter);
        waiter.resolve(message);
      }
    }
  }

  private rejectWaiters(error: Error): void {
    for (const waiter of [...this.waiters]) {
      clearTimeout(waiter.timer);
      this.removeWaiter(waiter);
      waiter.reject(error);
    }
  }

  private removeWaiter(waiter: (typeof this.waiters)[number]): void {
    const index = this.waiters.indexOf(waiter);
    if (index >= 0) {
      this.waiters.splice(index, 1);
    }
  }
}

class RawSocketProbe {
  private readonly messages: ServerMessage[] = [];
  private readonly closeCodes: number[] = [];
  private buffer = Buffer.alloc(0);

  public constructor(
    private readonly socket: Socket,
    initialBuffer: Buffer,
  ) {
    socket.on('data', (chunk) => this.read(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    socket.on('error', () => {
      /* Socket errors are asserted through received close frames in the raw protocol tests. */
    });
    if (initialBuffer.length > 0) {
      this.read(initialBuffer);
    }
  }

  public send(frame: Buffer): void {
    this.socket.write(frame);
  }

  public checkpoint(): number {
    return this.messages.length;
  }

  public messagesSince(checkpoint: number): readonly ServerMessage[] {
    return this.messages.slice(checkpoint);
  }

  public closeCodesSince(checkpoint: number): readonly number[] {
    return this.closeCodes.slice(checkpoint);
  }

  public closeCodeCheckpoint(): number {
    return this.closeCodes.length;
  }

  public close(): void {
    this.socket.destroy();
  }

  private read(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.readFrames();
  }

  private readFrames(): void {
    let offset = 0;
    while (offset + 2 <= this.buffer.length) {
      const first = this.buffer[offset];
      const second = this.buffer[offset + 1];
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let headerLength = 2;
      if (length === 126) {
        if (offset + 4 > this.buffer.length) {
          break;
        }
        length = this.buffer.readUInt16BE(offset + 2);
        headerLength = 4;
      } else if (length === 127) {
        if (offset + 10 > this.buffer.length) {
          break;
        }
        const high = this.buffer.readUInt32BE(offset + 2);
        const low = this.buffer.readUInt32BE(offset + 6);
        length = high * 2 ** 32 + low;
        headerLength = 10;
      }
      const maskLength = masked ? 4 : 0;
      const payloadOffset = offset + headerLength + maskLength;
      const frameLength = headerLength + maskLength + length;
      if (offset + frameLength > this.buffer.length) {
        break;
      }
      const payload = Buffer.from(this.buffer.subarray(payloadOffset, payloadOffset + length));
      if (masked) {
        const mask = this.buffer.subarray(offset + headerLength, offset + headerLength + 4);
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }
      this.recordFrame(opcode, payload);
      offset += frameLength;
    }
    this.buffer = this.buffer.subarray(offset);
  }

  private recordFrame(opcode: number, payload: Buffer): void {
    if (opcode === 0x01) {
      const message = decodeServerMessage(payload.toString('utf8'));
      if (message) {
        this.messages.push(message);
      }
    } else if (opcode === 0x08) {
      this.closeCodes.push(payload.length >= 2 ? payload.readUInt16BE(0) : 1005);
    }
  }
}

let server: CasinoServer | undefined;
const sockets: SocketProbe[] = [];
const rawSockets: RawSocketProbe[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.close());
  rawSockets.splice(0).forEach((socket) => socket.close());
  await closeCurrentServer();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('multiplayer WebSocket server', () => {
  it('serves health, static assets, and app fallback responses', async () => {
    const distRoot = await createStaticFixture();
    const baseUrl = await startServer(distRoot);

    const health = await fetch(`${baseUrl.http}/health`);
    expectBaselineSecurityHeaders(health);
    expect(health.headers.get('content-type')).toContain('application/json');
    await expect(health.json()).resolves.toEqual({ ok: true, multiplayer: true });

    const asset = await fetch(`${baseUrl.http}/client.js`);
    expectBaselineSecurityHeaders(asset);
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    await expect(asset.text()).resolves.toBe('console.log("casino");');

    const fallback = await fetch(`${baseUrl.http}/missing-route`);
    expectBaselineSecurityHeaders(fallback);
    expect(fallback.headers.get('cache-control')).toBe('no-store');
    expect(fallback.headers.get('content-type')).toContain('text/html');
    await expect(fallback.text()).resolves.toContain('<main>Casino Warehouse</main>');

    await expect(sendUpgradeRequest(baseUrl.port, '/not-ws', 'Sec-WebSocket-Key: bad')).resolves.toBeUndefined();
    await expect(sendUpgradeRequest(baseUrl.port, '/ws')).resolves.toBeUndefined();
  });

  it('accepts local development WebSocket origins', async () => {
    const baseUrl = await startServer();

    for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173']) {
      const client = await connect(baseUrl.ws, { origin });
      await expect(client.waitFor((message) => message.type === 'server-hello')).resolves.toMatchObject({ type: 'server-hello' });
      await client.closeAndWait();
    }
  });

  it('accepts the configured public WebSocket origin', async () => {
    const baseUrl = await startServer('.', undefined, { publicBaseUrl: 'https://casino-public.example.test/' });

    const publicClient = await connect(baseUrl.ws, { origin: 'https://casino-public.example.test' });

    await expect(publicClient.waitFor((message) => message.type === 'server-hello')).resolves.toMatchObject({ type: 'server-hello' });
  });

  it('rejects missing and unexpected WebSocket origins', async () => {
    const baseUrl = await startServer('.', undefined, { publicBaseUrl: 'https://casino-public.example.test/' });
    const validWebSocketHeaders = ['Sec-WebSocket-Version: 13', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='];

    await expect(sendUpgradeResponse(baseUrl.port, '/ws', validWebSocketHeaders)).resolves.toContain('HTTP/1.1 403 Forbidden');
    await expect(sendUpgradeResponse(baseUrl.port, '/ws', [...validWebSocketHeaders, 'Origin: https://attacker.example'])).resolves.toContain(
      'HTTP/1.1 403 Forbidden',
    );
    await expect(sendUpgradeResponse(baseUrl.port, '/ws', [...validWebSocketHeaders, 'Origin: http://192.168.1.55:5173'])).resolves.toContain(
      'HTTP/1.1 403 Forbidden',
    );
  });

  it('handles raw WebSocket frames split across TCP chunks and coalesced into one chunk', async () => {
    const baseUrl = await startServer();
    const raw = await connectRawWebSocket(baseUrl.port);
    await waitForMessageSince(raw, 0, (message) => message.type === 'error' && message.code === 'connected');
    await waitForMessageSince(raw, 0, (message) => message.type === 'data-state');
    const splitCheckpoint = raw.checkpoint();
    const splitFrame = encodeClientFrame(encodeMessage({ version: 1, type: 'request-data' }));

    raw.send(splitFrame.subarray(0, 3));
    raw.send(splitFrame.subarray(3));

    await waitForMessageSince(raw, splitCheckpoint, (message) => message.type === 'data-state');

    const coalescedCheckpoint = raw.checkpoint();
    raw.send(
      Buffer.concat([
        encodeClientFrame(encodeMessage({ version: 1, type: 'create-profile', profileName: 'Raw Coalesced Player' })),
        encodeClientFrame(encodeMessage({ version: 1, type: 'request-data' })),
      ]),
    );

    await waitForMessageSince(
      raw,
      coalescedCheckpoint,
      (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Raw Coalesced Player'),
    );
  });

  it('closes raw WebSocket clients that send malformed, oversized, unsupported, or fragmented messages', async () => {
    const baseUrl = await startServer();

    const unmasked = await connectRawWebSocket(baseUrl.port);
    const unmaskedCloseCheckpoint = unmasked.closeCodeCheckpoint();
    unmasked.send(encodeClientFrame(encodeMessage({ version: 1, type: 'request-data' }), { masked: false }));
    await waitForCloseCodeSince(unmasked, unmaskedCloseCheckpoint, 1002);

    const invalidOpcode = await connectRawWebSocket(baseUrl.port);
    const invalidOpcodeCloseCheckpoint = invalidOpcode.closeCodeCheckpoint();
    invalidOpcode.send(encodeClientFrame(Buffer.from([0x01]), { opcode: 0x03 }));
    await waitForCloseCodeSince(invalidOpcode, invalidOpcodeCloseCheckpoint, 1002);

    const invalidCloseCode = await connectRawWebSocket(baseUrl.port);
    const invalidCloseCodeCheckpoint = invalidCloseCode.closeCodeCheckpoint();
    invalidCloseCode.send(encodeClientFrame(Buffer.from([0x03, 0xe7]), { opcode: 0x08 }));
    await waitForCloseCodeSince(invalidCloseCode, invalidCloseCodeCheckpoint, 1002);

    const oversized = await connectRawWebSocket(baseUrl.port);
    const oversizedCloseCheckpoint = oversized.closeCodeCheckpoint();
    oversized.send(encodeClientFrame(Buffer.alloc(64 * 1024 + 1, 0x61)));
    await waitForCloseCodeSince(oversized, oversizedCloseCheckpoint, 1009);

    const binary = await connectRawWebSocket(baseUrl.port);
    const binaryCloseCheckpoint = binary.closeCodeCheckpoint();
    binary.send(encodeClientFrame(Buffer.from([0x01, 0x02, 0x03]), { opcode: 0x02 }));
    await waitForCloseCodeSince(binary, binaryCloseCheckpoint, 1003);

    const fragmented = await connectRawWebSocket(baseUrl.port);
    const fragmentedCloseCheckpoint = fragmented.closeCodeCheckpoint();
    fragmented.send(
      Buffer.concat([encodeClientFrame(Buffer.from([0x01]), { fin: false, opcode: 0x02 }), encodeClientFrame(Buffer.from([0x02]), { opcode: 0x00 })]),
    );
    await waitForCloseCodeSince(fragmented, fragmentedCloseCheckpoint, 1003);
  });

  it('syncs two profiles through the actual realtime transport', async () => {
    const baseUrl = await startServer();
    const health = (await fetch(`${baseUrl.http}/health`).then((response) => response.json())) as { ok?: boolean; multiplayer?: boolean };
    expect(health).toEqual({ ok: true, multiplayer: true });

    const alice = await connect(baseUrl.ws);
    const bob = await connect(baseUrl.ws);
    await (await connect(baseUrl.ws)).closeAndWait();

    const initialData = await alice.waitFor((message) => message.type === 'data-state');
    expect(initialData.type === 'data-state' ? initialData.database : '').toBe('memory');
    alice.send({ version: 1, type: 'create-profile', profileName: 'Server Alice' });
    const profileData = await alice.waitFor(
      (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Server Alice'),
    );
    const aliceProfile = profileData.type === 'data-state' ? profileData.profileState.profiles.find((profile) => profile.name === 'Server Alice') : undefined;
    expect(aliceProfile?.bankroll).toBe(1000);
    bob.send({ version: 1, type: 'create-profile', profileName: 'Server Bob' });
    const bobProfileData = await bob.waitFor(
      (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Server Bob'),
    );
    const bobProfile = bobProfileData.type === 'data-state' ? bobProfileData.profileState.profiles.find((profile) => profile.name === 'Server Bob') : undefined;
    if (!aliceProfile || !bobProfile) {
      throw new Error('Expected server-created profiles.');
    }
    const heartbeat = await alice.waitFor((message) => message.type === 'heartbeat', 4_000);
    if (heartbeat.type === 'heartbeat') {
      alice.send({ version: 1, type: 'heartbeat-ack', sentAt: heartbeat.sentAt });
    }

    alice.sendRaw('not-json');
    const badJson = await alice.waitFor((message) => message.type === 'error' && message.code === 'bad-json');
    expect(badJson.type === 'error' ? badJson.message : '').toBe('Message was not valid JSON.');

    alice.sendRaw('{"version":99,"type":"resync"}');
    const badMessage = await alice.waitFor((message) => message.type === 'error' && message.code === 'bad-message');
    expect(badMessage.type === 'error' ? badMessage.message : '').toBe('Message version or type is invalid.');

    alice.send({ version: 1, type: 'create-room', gameId: 'beat-the-house', profileId: 'missing-profile', profileName: 'Missing', bankroll: 500 });
    const unknownProfile = await alice.waitFor(
      (message) => message.type === 'error' && message.code === 'rejected' && message.message === 'Profile was not found.',
    );
    expect(unknownProfile.type === 'error' ? unknownProfile.message : '').toBe('Profile was not found.');

    alice.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: aliceProfile.id,
      profileName: `Spoof ${'Long'.repeat(48)}`,
      bankroll: 1,
    });
    const created = await alice.waitFor((message) => message.type === 'room-created');
    if (created.type !== 'room-created') {
      throw new Error('Expected room-created message.');
    }
    expect(created.invitePath).toBe(`/?game=beat-the-house&room=${created.room.roomId}`);
    expect(created.room.players).toEqual([]);
    expect(created.room.spectators[0]).toMatchObject({ profileId: aliceProfile.id, profileName: 'Server Alice', bankroll: 1000 });
    const roomId = created.room.roomId;

    alice.send({ version: 1, type: 'assign-seat', seatId: 'left' });
    await waitForRoom(alice, (room) => room.seats.some((seat) => seat.seatId === 'left' && seat.profileId === aliceProfile.id));

    bob.send({
      version: 1,
      type: 'join-room',
      gameId: 'beat-the-house',
      roomId,
      role: 'player',
      profileId: bobProfile.id,
      profileName: 'Spoof Bob',
      bankroll: 1,
    });
    await waitForRoom(bob, (room) => room.spectators.some((player) => player.profileId === bobProfile.id));
    bob.send({ version: 1, type: 'assign-seat', seatId: 'centre' });
    await waitForRoom(alice, (room) => room.seats.some((seat) => seat.seatId === 'centre' && seat.profileId === bobProfile.id));

    alice.send({ version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const wagered = await waitForRoom(bob, (room) => beat(room).bets.left.main === 25);
    expect(wagered.players.find((player) => player.profileId === aliceProfile.id)?.bankroll).toBe(975);

    bob.send({ version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const rejected = await bob.waitFor((message) => message.type === 'error' && message.code === 'rejected');
    expect(rejected.type === 'error' ? rejected.message : '').toBe('You can only bet on your own seat.');

    alice.send({ version: 1, type: 'resync' });
    const resynced = await alice.waitFor(
      (message) => message.type === 'room-created' && message.room.roomId === roomId && beat(message.room).bets.left.main === 25,
    );
    expect(resynced.type === 'room-created' ? beat(resynced.room).bets.left.main : 0).toBe(25);

    bob.close();
    const afterDisconnect = await waitForRoom(alice, (room) => room.players.length === 1);
    expect(afterDisconnect.players[0].profileId).toBe(aliceProfile.id);
  });

  it('rejects second-socket profile impersonation and locks admin-only data actions', async () => {
    const baseUrl = await startServer('.', undefined, { adminToken: 'server-admin-secret' });
    const alice = await connect(baseUrl.ws);
    const intruder = await connect(baseUrl.ws);

    alice.send({ version: 1, type: 'create-profile', profileName: 'Protected Alice' });
    const credentials = await alice.waitFor((message) => message.type === 'profile-credentials');
    const profileData = await alice.waitFor(
      (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Protected Alice'),
    );
    const aliceProfile =
      profileData.type === 'data-state' ? profileData.profileState.profiles.find((profile) => profile.name === 'Protected Alice') : undefined;
    if (!aliceProfile || credentials.type !== 'profile-credentials') {
      throw new Error('Expected protected profile and credentials.');
    }
    expect(credentials.profileId).toBe(aliceProfile.id);

    intruder.send({ version: 1, type: 'rename-profile', profileId: aliceProfile.id, profileName: 'Stolen Alice' });
    intruder.send({ version: 1, type: 'delete-profile', profileId: aliceProfile.id });
    intruder.send({
      version: 1,
      type: 'save-session',
      session: {
        profileIds: [aliceProfile.id],
        selectedPlayerIndex: 0,
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshots: {},
      },
    });
    intruder.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: aliceProfile.id,
      profileName: 'Stolen Alice',
      bankroll: 1,
    });
    await waitForReceivedCount(intruder, unauthorizedProfileError, 4);

    alice.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: aliceProfile.id,
      profileName: 'Spoof Alice',
      bankroll: 1,
    });
    const created = await alice.waitFor((message) => message.type === 'room-created');
    if (created.type !== 'room-created') {
      throw new Error('Expected Alice to create a room.');
    }
    intruder.send({
      version: 1,
      type: 'join-room',
      gameId: 'beat-the-house',
      roomId: created.room.roomId,
      role: 'player',
      profileId: aliceProfile.id,
      profileName: 'Stolen Alice',
      bankroll: 1,
    });
    await waitForReceivedCount(intruder, unauthorizedProfileError, 5);

    intruder.send({ version: 1, type: 'admin-bankroll', profileId: aliceProfile.id, action: 'add', amount: 500 });
    intruder.send({ version: 1, type: 'admin-reset-all' });
    intruder.send({ version: 1, type: 'clear-server-data' });
    await waitForReceivedCount(intruder, adminLockedError, 3);

    intruder.send({ version: 1, type: 'authorize-admin', adminToken: 'wrong-secret' });
    await expect(intruder.waitFor((message) => message.type === 'admin-access' && !message.authorized)).resolves.toMatchObject({ authorized: false });

    intruder.send({ version: 1, type: 'authorize-admin', adminToken: 'server-admin-secret' });
    await expect(intruder.waitFor((message) => message.type === 'admin-access' && message.authorized)).resolves.toMatchObject({ authorized: true });
    intruder.send({ version: 1, type: 'admin-bankroll', profileId: aliceProfile.id, action: 'add', amount: 75 });
    const updated = await intruder.waitFor(
      (message) =>
        message.type === 'data-state' &&
        message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.name === 'Protected Alice' && profile.bankroll === 1075),
    );
    expect(updated.type === 'data-state' ? updated.profileState.profiles.find((profile) => profile.id === aliceProfile.id)?.bankroll : 0).toBe(1075);
  });

  it('reconciles active rooms before data-state when an active profile is deleted', async () => {
    const baseUrl = await startServer();
    const alice = await connect(baseUrl.ws);
    const bob = await connect(baseUrl.ws);
    const aliceProfile = await createServerProfile(alice, 'Delete Room Alice');
    const bobProfile = await createServerProfile(bob, 'Delete Room Bob');

    alice.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: aliceProfile.id,
      profileName: aliceProfile.name,
      bankroll: aliceProfile.bankroll,
    });
    const created = await alice.waitFor((message) => message.type === 'room-created');
    if (created.type !== 'room-created') {
      throw new Error('Expected room-created message.');
    }
    alice.send({ version: 1, type: 'assign-seat', seatId: 'left' });
    await waitForRoom(
      alice,
      (room) => room.roomId === created.room.roomId && room.seats.some((seat) => seat.seatId === 'left' && seat.profileId === aliceProfile.id),
    );
    bob.send({
      version: 1,
      type: 'join-room',
      gameId: 'beat-the-house',
      roomId: created.room.roomId,
      role: 'player',
      profileId: bobProfile.id,
      profileName: bobProfile.name,
      bankroll: bobProfile.bankroll,
    });
    await waitForRoom(bob, (room) => room.roomId === created.room.roomId && room.spectators.some((player) => player.profileId === bobProfile.id));
    bob.send({ version: 1, type: 'assign-seat', seatId: 'centre' });
    await waitForRoom(
      alice,
      (room) => room.roomId === created.room.roomId && room.seats.some((seat) => seat.seatId === 'centre' && seat.profileId === bobProfile.id),
    );

    const aliceCheckpoint = alice.checkpoint();
    const bobCheckpoint = bob.checkpoint();
    bob.send({ version: 1, type: 'delete-profile', profileId: bobProfile.id });

    const aliceRoomState = await waitForMessageSince(
      alice,
      aliceCheckpoint,
      (message) =>
        message.type === 'room-state' &&
        message.room.roomId === created.room.roomId &&
        message.room.players.every((player) => player.profileId !== bobProfile.id),
    );
    const bobClosed = await waitForMessageSince(
      bob,
      bobCheckpoint,
      (message) => message.type === 'room-closed' && message.roomId === created.room.roomId && message.reason === 'profile-deleted',
    );
    await waitForMessageSince(
      alice,
      aliceCheckpoint,
      (message) => message.type === 'data-state' && message.profileState.profiles.every((profile) => profile.id !== bobProfile.id),
    );
    await waitForMessageSince(
      bob,
      bobCheckpoint,
      (message) => message.type === 'data-state' && message.profileState.profiles.every((profile) => profile.id !== bobProfile.id),
    );

    if (aliceRoomState.type !== 'room-state' || bobClosed.type !== 'room-closed') {
      throw new Error('Expected room-state and room-closed reconciliation messages.');
    }
    expect(aliceRoomState.room.players.map((player) => player.profileId)).toEqual([aliceProfile.id]);
    expect(aliceRoomState.room.seats.find((seat) => seat.seatId === 'centre')?.profileId).toBeUndefined();
    expect(messageIndexSince(alice, aliceCheckpoint, (message) => message.type === 'room-state' && message.room.roomId === created.room.roomId)).toBeLessThan(
      messageIndexSince(
        alice,
        aliceCheckpoint,
        (message) => message.type === 'data-state' && message.profileState.profiles.every((profile) => profile.id !== bobProfile.id),
      ),
    );
    expect(messageIndexSince(bob, bobCheckpoint, (message) => message.type === 'room-closed' && message.roomId === created.room.roomId)).toBeLessThan(
      messageIndexSince(
        bob,
        bobCheckpoint,
        (message) => message.type === 'data-state' && message.profileState.profiles.every((profile) => profile.id !== bobProfile.id),
      ),
    );
  });

  it('reconciles active room profile names before data-state when a profile is renamed', async () => {
    const baseUrl = await startServer();
    const alice = await connect(baseUrl.ws);
    const aliceProfile = await createServerProfile(alice, 'Rename Room Alice');

    alice.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: aliceProfile.id,
      profileName: aliceProfile.name,
      bankroll: aliceProfile.bankroll,
    });
    const created = await alice.waitFor((message) => message.type === 'room-created');
    if (created.type !== 'room-created') {
      throw new Error('Expected room-created message.');
    }

    const checkpoint = alice.checkpoint();
    alice.send({ version: 1, type: 'rename-profile', profileId: aliceProfile.id, profileName: 'Renamed Room Alice' });
    const renamedRoom = await waitForMessageSince(
      alice,
      checkpoint,
      (message) =>
        message.type === 'room-state' &&
        message.room.roomId === created.room.roomId &&
        roomMembers(message.room).some((player) => player.profileId === aliceProfile.id && player.profileName === 'Renamed Room Alice'),
    );
    await waitForMessageSince(
      alice,
      checkpoint,
      (message) =>
        message.type === 'data-state' &&
        message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.name === 'Renamed Room Alice'),
    );

    if (renamedRoom.type !== 'room-state') {
      throw new Error('Expected rename room-state reconciliation.');
    }
    expect(messageIndexSince(alice, checkpoint, (message) => message.type === 'room-state' && message.room.roomId === created.room.roomId)).toBeLessThan(
      messageIndexSince(
        alice,
        checkpoint,
        (message) =>
          message.type === 'data-state' &&
          message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.name === 'Renamed Room Alice'),
      ),
    );
  });

  it('reconciles active room bankrolls before data-state for admin-bankroll and reset-all', async () => {
    const baseUrl = await startServer('.', undefined, { adminToken: 'server-admin-secret' });
    const alice = await connect(baseUrl.ws);
    const admin = await connect(baseUrl.ws);
    const aliceProfile = await createServerProfile(alice, 'Bankroll Room Alice');
    await authorizeAdmin(admin, 'server-admin-secret');

    alice.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: aliceProfile.id,
      profileName: aliceProfile.name,
      bankroll: aliceProfile.bankroll,
    });
    const created = await alice.waitFor((message) => message.type === 'room-created');
    if (created.type !== 'room-created') {
      throw new Error('Expected room-created message.');
    }
    alice.send({ version: 1, type: 'assign-seat', seatId: 'left' });
    await waitForRoom(alice, (room) => room.roomId === created.room.roomId && room.players.some((player) => player.profileId === aliceProfile.id));

    const bankrollCheckpoint = alice.checkpoint();
    admin.send({ version: 1, type: 'admin-bankroll', profileId: aliceProfile.id, action: 'add', amount: 125 });
    const increasedRoom = await waitForMessageSince(
      alice,
      bankrollCheckpoint,
      (message) =>
        message.type === 'room-state' &&
        message.room.roomId === created.room.roomId &&
        message.room.players.some((player) => player.profileId === aliceProfile.id && player.bankroll === 1125),
    );
    await waitForMessageSince(
      alice,
      bankrollCheckpoint,
      (message) =>
        message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.bankroll === 1125),
    );
    if (increasedRoom.type !== 'room-state') {
      throw new Error('Expected admin-bankroll room-state reconciliation.');
    }
    expect(beat(increasedRoom.room).bankroll).toBe(1125);
    expect(
      messageIndexSince(alice, bankrollCheckpoint, (message) => message.type === 'room-state' && message.room.roomId === created.room.roomId),
    ).toBeLessThan(
      messageIndexSince(
        alice,
        bankrollCheckpoint,
        (message) =>
          message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.bankroll === 1125),
      ),
    );

    const resetCheckpoint = alice.checkpoint();
    admin.send({ version: 1, type: 'admin-reset-all' });
    const resetRoom = await waitForMessageSince(
      alice,
      resetCheckpoint,
      (message) =>
        message.type === 'room-state' &&
        message.room.roomId === created.room.roomId &&
        message.room.players.some((player) => player.profileId === aliceProfile.id && player.bankroll === 1000),
    );
    await waitForMessageSince(
      alice,
      resetCheckpoint,
      (message) =>
        message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.bankroll === 1000),
    );
    if (resetRoom.type !== 'room-state') {
      throw new Error('Expected admin-reset-all room-state reconciliation.');
    }
    expect(beat(resetRoom.room).bankroll).toBe(1000);
    expect(messageIndexSince(alice, resetCheckpoint, (message) => message.type === 'room-state' && message.room.roomId === created.room.roomId)).toBeLessThan(
      messageIndexSince(
        alice,
        resetCheckpoint,
        (message) =>
          message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.id === aliceProfile.id && profile.bankroll === 1000),
      ),
    );
  });

  it('clears user rooms, resets the server-managed room, and broadcasts before data-state on clear-server-data', async () => {
    const baseUrl = await startServer('.', undefined, { adminToken: 'server-admin-secret' });
    const admin = await connect(baseUrl.ws);
    const host = await connect(baseUrl.ws);
    const mainPlayer = await connect(baseUrl.ws);
    await authorizeAdmin(admin, 'server-admin-secret');
    const hostProfile = await createServerProfile(host, 'Clear Host');
    const mainProfile = await createServerProfile(mainPlayer, 'Clear Main Player');

    host.send({
      version: 1,
      type: 'create-room',
      gameId: 'beat-the-house',
      profileId: hostProfile.id,
      profileName: hostProfile.name,
      bankroll: hostProfile.bankroll,
    });
    const created = await host.waitFor((message) => message.type === 'room-created');
    if (created.type !== 'room-created') {
      throw new Error('Expected room-created message.');
    }
    host.send({ version: 1, type: 'assign-seat', seatId: 'left' });
    await waitForRoom(host, (room) => room.roomId === created.room.roomId && room.players.some((player) => player.profileId === hostProfile.id));

    mainPlayer.send({
      version: 1,
      type: 'join-room',
      gameId: 'beat-the-house',
      roomId: mainBeatRoomId,
      role: 'player',
      profileId: mainProfile.id,
      profileName: mainProfile.name,
      bankroll: mainProfile.bankroll,
    });
    await waitForRoom(mainPlayer, (room) => room.roomId === mainBeatRoomId && room.spectators.some((player) => player.profileId === mainProfile.id));
    mainPlayer.send({ version: 1, type: 'assign-seat', seatId: 'centre' });
    await waitForRoom(mainPlayer, (room) => room.roomId === mainBeatRoomId && room.players.some((player) => player.profileId === mainProfile.id));

    const hostCheckpoint = host.checkpoint();
    const mainCheckpoint = mainPlayer.checkpoint();
    const adminCheckpoint = admin.checkpoint();
    admin.send({ version: 1, type: 'clear-server-data' });

    await waitForMessageSince(host, hostCheckpoint, (message) => message.type === 'profile-access' && !message.ownedProfileIds.includes(hostProfile.id));
    await waitForMessageSince(mainPlayer, mainCheckpoint, (message) => message.type === 'profile-access' && !message.ownedProfileIds.includes(mainProfile.id));
    await waitForMessageSince(
      host,
      hostCheckpoint,
      (message) => message.type === 'room-closed' && message.roomId === created.room.roomId && message.reason === 'server-data-cleared',
    );
    const mainReset = await waitForMessageSince(
      mainPlayer,
      mainCheckpoint,
      (message) =>
        message.type === 'room-state' && message.room.roomId === mainBeatRoomId && message.room.players.length === 0 && message.room.spectators.length === 0,
    );
    await waitForMessageSince(host, hostCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0);
    await waitForMessageSince(mainPlayer, mainCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0);
    await waitForMessageSince(admin, adminCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0);

    if (mainReset.type !== 'room-state') {
      throw new Error('Expected server-managed room reset state.');
    }
    expect(mainReset.room.players).toEqual([]);
    expect(mainReset.room.spectators).toEqual([]);
    expect(mainPlayer.messagesSince(mainCheckpoint).some((message) => message.type === 'room-closed' && message.roomId === mainBeatRoomId)).toBe(false);
    expect(messageIndexSince(host, hostCheckpoint, (message) => message.type === 'room-closed' && message.roomId === created.room.roomId)).toBeLessThan(
      messageIndexSince(host, hostCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0),
    );
    expect(messageIndexSince(mainPlayer, mainCheckpoint, (message) => message.type === 'room-state' && message.room.roomId === mainBeatRoomId)).toBeLessThan(
      messageIndexSince(mainPlayer, mainCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0),
    );

    const listCheckpoint = admin.checkpoint();
    admin.send({ version: 1, type: 'list-rooms', gameId: 'beat-the-house' });
    const roomList = await waitForMessageSince(admin, listCheckpoint, (message) => message.type === 'room-list' && message.gameId === 'beat-the-house');
    if (roomList.type !== 'room-list') {
      throw new Error('Expected room-list after clear-server-data.');
    }
    expect(roomList.rooms.map((room) => room.roomId)).toEqual([mainBeatRoomId]);
    expect(roomList.rooms[0]).toMatchObject({ currentPlayers: 0, spectators: 0, status: 'waiting' });
  });

  it('keeps server profiles available after a SQLite-backed server restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-profile-relogin-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');

    let baseUrl = await startServer('.', undefined, { dataStore: new SqliteServerDataStore(dbPath) });
    const alice = await connect(baseUrl.ws);
    alice.send({ version: 1, type: 'create-profile', profileName: 'Returning Alice' });
    const credentials = await alice.waitFor((message) => message.type === 'profile-credentials');
    const profileData = await alice.waitFor(
      (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Returning Alice'),
    );
    const profile = profileData.type === 'data-state' ? profileData.profileState.profiles.find((candidate) => candidate.name === 'Returning Alice') : undefined;
    if (!profile || credentials.type !== 'profile-credentials') {
      throw new Error('Expected Returning Alice profile and credentials.');
    }

    await closeCurrentServer();

    baseUrl = await startServer('.', undefined, { dataStore: new SqliteServerDataStore(dbPath) });
    const returning = await connect(baseUrl.ws);
    const restored = await returning.waitFor(
      (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Returning Alice'),
    );

    expect(restored.type === 'data-state' ? restored.profileState.profiles.map((profile) => profile.name) : []).toContain('Returning Alice');
    returning.send({ version: 1, type: 'authorize-profiles', profileTokens: [{ profileId: profile.id, profileToken: credentials.profileToken }] });
    await expect(returning.waitFor((message) => message.type === 'profile-access' && message.ownedProfileIds.includes(profile.id))).resolves.toMatchObject({
      type: 'profile-access',
      ownedProfileIds: [profile.id],
    });
    returning.send({ version: 1, type: 'create-room', gameId: 'beat-the-house', profileId: profile.id, profileName: 'Spoofed', bankroll: 1 });
    await expect(returning.waitFor((message) => message.type === 'room-created')).resolves.toMatchObject({ type: 'room-created' });
  });

  it('tells clients from a previous server instance to reload on reconnect', async () => {
    const baseUrl = await startServer('.', undefined, { serverInstanceId: 'server-after-restart' });

    const current = await connect(`${baseUrl.ws}?clientServerInstanceId=server-after-restart`);
    await expect(current.waitFor((message) => message.type === 'server-hello')).resolves.toMatchObject({
      type: 'server-hello',
      serverInstanceId: 'server-after-restart',
    });

    const stale = await connect(`${baseUrl.ws}?clientServerInstanceId=server-before-restart`, { waitForConnected: false });
    await expect(stale.waitFor((message) => message.type === 'reload-required')).resolves.toMatchObject({
      type: 'reload-required',
      reason: 'server-restarted',
    });
    await expect(stale.waitForClose()).resolves.toBeUndefined();
  });

  it('drops realtime peers that stop acknowledging server heartbeats', async () => {
    const baseUrl = await startServer('.', undefined, { heartbeatIntervalMs: 10, heartbeatTimeoutMs: 25 });
    const alice = await connect(baseUrl.ws);

    await expect(alice.waitFor((message) => message.type === 'heartbeat', 500)).resolves.toMatchObject({ type: 'heartbeat' });
    await expect(alice.waitForClose()).resolves.toBeUndefined();
  });

  it('uses the public base URL in room invites when the integrated ngrok flow provides one', async () => {
    const originalPublicBaseUrl = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://casino-public.example.test/';
    try {
      const baseUrl = await startServer();
      const alice = await connect(baseUrl.ws);
      alice.send({ version: 1, type: 'create-profile', profileName: 'Alice' });
      const profileData = await alice.waitFor(
        (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === 'Alice'),
      );
      const profile = profileData.type === 'data-state' ? profileData.profileState.profiles.find((candidate) => candidate.name === 'Alice') : undefined;
      if (!profile) {
        throw new Error('Expected Alice profile.');
      }
      alice.send({ version: 1, type: 'create-room', gameId: 'blackjack', profileId: profile.id, profileName: 'Spoof Alice', bankroll: 1 });
      const created = await alice.waitFor((message) => message.type === 'room-created');
      if (created.type !== 'room-created') {
        throw new Error('Expected room-created message.');
      }
      expect(created.invitePath).toBe(
        `https://casino-public.example.test/?game=blackjack&room=${created.room.roomId}&server=wss%3A%2F%2Fcasino-public.example.test%2Fws`,
      );
      await alice.closeAndWait();
    } finally {
      if (originalPublicBaseUrl === undefined) {
        delete process.env.PUBLIC_BASE_URL;
      } else {
        process.env.PUBLIC_BASE_URL = originalPublicBaseUrl;
      }
    }
  });

  it('broadcasts authoritative settlement events returned by the room layer', async () => {
    const authority: CasinoRoomAuthority = {
      handle: (connectionId: string) => {
        const room = createRoomSnapshot(connectionId);
        return {
          broadcasts: [room],
          settlements: [{ id: 'settlement-1', profileId: 'alice', seatId: 'left', wagered: 25, returned: 50, profit: 25 }],
        };
      },
      disconnect: () => ({ broadcasts: [], settlements: [] }),
      removeProfile: () => ({ broadcasts: [], settlements: [] }),
      reconcileProfiles: () => ({ broadcasts: [], settlements: [] }),
      clearRooms: () => ({ broadcasts: [], settlements: [] }),
      listRoomSummaries: () => [],
    };
    const baseUrl = await startServer('.', authority);
    const alice = await connect(baseUrl.ws);

    alice.send({ version: 1, type: 'resync' });
    const settlement = await alice.waitFor((message) => message.type === 'settlement');

    expect(settlement.type === 'settlement' ? settlement.settlements[0].profit : 0).toBe(25);
  });
});

const createStaticFixture = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'casino-server-'));
  tempDirs.push(dir);
  await writeFile(join(dir, 'index.html'), '<!doctype html><main>Casino Warehouse</main>');
  await writeFile(join(dir, 'client.js'), 'console.log("casino");');
  return dir;
};

const startServer = async (
  distRoot = '.',
  authority?: CasinoRoomAuthority,
  options: CasinoServerOptions = {},
): Promise<{ readonly http: string; readonly ws: string; readonly port: number }> => {
  server = createCasinoServer({ distRoot, authority, ...options });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    http: `http://127.0.0.1:${address.port}`,
    ws: `ws://127.0.0.1:${address.port}/ws`,
    port: address.port,
  };
};

const closeCurrentServer = async (): Promise<void> => {
  if (!server) {
    return;
  }
  server.closePeers();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
};

const sendUpgradeRequest = async (port: number, path: string, extraHeader = ''): Promise<void> => {
  await sendUpgradeResponse(port, path, extraHeader ? [extraHeader] : []);
};

const sendUpgradeResponse = async (port: number, path: string, extraHeaders: readonly string[] = []): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = connectSocket(port, '127.0.0.1');
    let buffer = Buffer.alloc(0);
    socket.on('connect', () => {
      socket.write(
        `${[`GET ${path} HTTP/1.1`, 'Host: 127.0.0.1', 'Connection: Upgrade', 'Upgrade: websocket', ...extraHeaders].filter(Boolean).join('\r\n')}\r\n\r\n`,
      );
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      if (buffer.includes('\r\n\r\n')) {
        socket.destroy();
      }
    });
    socket.on('close', () => resolve(buffer.toString('utf8')));
    socket.on('error', reject);
  });

const expectBaselineSecurityHeaders = (response: Response): void => {
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  expect(response.headers.get('origin-agent-cluster')).toBe('?1');
  expect(response.headers.get('permissions-policy')).toBe('camera=(), geolocation=(), microphone=(), payment=(), usb=()');
  expect(response.headers.get('strict-transport-security')).toBeNull();
  expect(response.headers.get('x-dns-prefetch-control')).toBe('off');
  expect(response.headers.get('x-download-options')).toBe('noopen');
  expect(response.headers.get('x-permitted-cross-domain-policies')).toBe('none');
  expect(response.headers.get('x-xss-protection')).toBe('0');
  expect(response.headers.get('content-security-policy')).toBe(
    [
      "default-src 'self'",
      "base-uri 'none'",
      "connect-src 'self' ws: wss:",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
    ].join(';'),
  );
};

const connectRawWebSocket = async (port: number, origin = `http://127.0.0.1:${port}`): Promise<RawSocketProbe> =>
  new Promise((resolve, reject) => {
    const socket = connectSocket(port, '127.0.0.1');
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timed out waiting for raw WebSocket handshake.'));
    }, 1_000);
    const fail = (error: Error) => {
      clearTimeout(timer);
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) {
        return;
      }
      const header = buffer.subarray(0, headerEnd).toString('utf8');
      const remaining = buffer.subarray(headerEnd + 4);
      socket.off('data', onData);
      socket.off('error', fail);
      clearTimeout(timer);
      if (!header.startsWith('HTTP/1.1 101 Switching Protocols')) {
        socket.destroy();
        reject(new Error(`Expected WebSocket upgrade response, received: ${header.split('\r\n')[0]}`));
        return;
      }
      const probe = new RawSocketProbe(socket, remaining);
      rawSockets.push(probe);
      resolve(probe);
    };
    socket.on('connect', () => {
      socket.write(
        [
          'GET /ws HTTP/1.1',
          'Host: 127.0.0.1',
          'Connection: Upgrade',
          'Upgrade: websocket',
          `Origin: ${origin}`,
          'Sec-WebSocket-Version: 13',
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
          '',
          '',
        ].join('\r\n'),
      );
    });
    socket.on('data', onData);
    socket.on('error', fail);
  });

const connect = async (url: string, options: { readonly waitForConnected?: boolean; readonly origin?: string } = {}): Promise<SocketProbe> => {
  const socket = new NodeWebSocket(url, { headers: { Origin: options.origin ?? webSocketOrigin(url) } });
  const probe = new SocketProbe(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', () => reject(new Error('WebSocket failed to connect.')));
  });
  sockets.push(probe);
  if (options.waitForConnected ?? true) {
    await probe.waitFor((message) => message.type === 'error' && message.code === 'connected');
  }
  return probe;
};

const webSocketOrigin = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.protocol === 'wss:' ? 'https:' : 'http:'}//${parsed.host}`;
};

const webSocketText = (data: WebSocketRawData): string => {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString('utf8');
  }
  return data.toString('utf8');
};

const waitForRoom = async (probe: SocketProbe, predicate: (room: RoomSnapshot) => boolean): Promise<RoomSnapshot> => {
  const message = await probe.waitFor((candidate) => candidate.type === 'room-state' && predicate(candidate.room));
  if (message.type !== 'room-state') {
    throw new Error('Expected a room-state message.');
  }
  return message.room;
};

const waitForReceivedCount = async (probe: SocketProbe, predicate: (message: ServerMessage) => boolean, count: number): Promise<void> => {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (probe.received(predicate).length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${count} matching WebSocket messages.`);
};

const roomMembers = (room: RoomSnapshot) => [...room.players, ...room.spectators];

interface MessageProbe {
  messagesSince(checkpoint: number): readonly ServerMessage[];
}

const waitForMessageSince = async (probe: MessageProbe, checkpoint: number, predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> => {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const message = probe.messagesSince(checkpoint).find(predicate);
    if (message) {
      return message;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for matching WebSocket message.');
};

const waitForCloseCodeSince = async (probe: RawSocketProbe, checkpoint: number, code: number): Promise<void> => {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (probe.closeCodesSince(checkpoint).includes(code)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for WebSocket close code ${code}.`);
};

const messageIndexSince = (probe: MessageProbe, checkpoint: number, predicate: (message: ServerMessage) => boolean): number => {
  const index = probe.messagesSince(checkpoint).findIndex(predicate);
  if (index < 0) {
    throw new Error('Expected message was not received.');
  }
  return index;
};

const createServerProfile = async (probe: SocketProbe, profileName: string): Promise<CasinoProfile> => {
  probe.send({ version: 1, type: 'create-profile', profileName });
  const profileData = await probe.waitFor(
    (message) => message.type === 'data-state' && message.profileState.profiles.some((profile) => profile.name === profileName),
  );
  const profile = profileData.type === 'data-state' ? profileData.profileState.profiles.find((candidate) => candidate.name === profileName) : undefined;
  if (!profile) {
    throw new Error(`Expected profile ${profileName}.`);
  }
  return profile;
};

const authorizeAdmin = async (probe: SocketProbe, adminToken: string): Promise<void> => {
  probe.send({ version: 1, type: 'authorize-admin', adminToken });
  await expect(probe.waitFor((message) => message.type === 'admin-access' && message.authorized)).resolves.toMatchObject({ authorized: true });
};

const unauthorizedProfileError = (message: ServerMessage): boolean =>
  message.type === 'error' && message.code === 'rejected' && message.message === 'This browser is not authorized to use that profile.';

const adminLockedError = (message: ServerMessage): boolean =>
  message.type === 'error' && message.code === 'rejected' && message.message === 'Admin controls are locked for this browser.';

const encodeClientFrame = (payload: string | Buffer, options: { readonly fin?: boolean; readonly masked?: boolean; readonly opcode?: number } = {}): Buffer => {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const masked = options.masked ?? true;
  const headerLength = data.length < 126 ? 2 : data.length < 65536 ? 4 : 10;
  const maskLength = masked ? 4 : 0;
  const frame = Buffer.alloc(headerLength + maskLength + data.length);
  frame[0] = ((options.fin ?? true) ? 0x80 : 0) | (options.opcode ?? 0x01);
  if (data.length < 126) {
    frame[1] = data.length;
  } else if (data.length < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(data.length, 2);
  } else {
    frame[1] = 127;
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(data.length, 6);
  }
  if (!masked) {
    data.copy(frame, headerLength);
    return frame;
  }
  frame[1] |= 0x80;
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  mask.copy(frame, headerLength);
  for (let index = 0; index < data.length; index += 1) {
    frame[headerLength + maskLength + index] = data[index] ^ mask[index % 4];
  }
  return frame;
};

const beat = (room: RoomSnapshot) => room.game as ReturnType<BeatTheHouseGame['snapshot']>;

const createRoomSnapshot = (connectionId: string): RoomSnapshot => ({
  roomId: 'ROOM42',
  roomName: 'Room 42',
  hostProfileId: 'alice',
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'complete',
  phase: 'settled',
  sessionId: 'session-1',
  revision: 1,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1,
  updatedAt: 2,
  players: [{ connectionId, profileId: 'alice', profileName: 'Alice', bankroll: 525, sessionStartBankroll: 500, role: 'player' }],
  spectators: [],
  seats: [{ seatId: 'left', profileId: 'alice' }, { seatId: 'centre' }, { seatId: 'right' }],
  game: new BeatTheHouseGame({ initialBankroll: 0 }).snapshot(),
});
