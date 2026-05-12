import type { AddressInfo } from 'node:net';
import { connect as connectSocket } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

  public constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = decodeServerMessage(String(event.data));
      if (message) {
        this.messages.push(message);
        this.flushWaiters(message);
      }
    });
    socket.addEventListener('error', () => {
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
    if (this.socket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(), 250);
      this.socket.addEventListener('close', () => resolve(), { once: true });
      this.socket.addEventListener('close', () => clearTimeout(timer), { once: true });
      this.socket.close();
    });
  }

  public waitForClose(timeoutMs = 1_000): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket close.')), timeoutMs);
      this.socket.addEventListener(
        'close',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
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

let server: CasinoServer | undefined;
const sockets: SocketProbe[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.close());
  await closeCurrentServer();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('multiplayer WebSocket server', () => {
  it('serves health, static assets, and app fallback responses', async () => {
    const distRoot = await createStaticFixture();
    const baseUrl = await startServer(distRoot);

    await expect(fetch(`${baseUrl.http}/health`).then((response) => response.json())).resolves.toEqual({ ok: true, multiplayer: true });
    await expect(fetch(`${baseUrl.http}/client.js`).then((response) => response.text())).resolves.toBe('console.log("casino");');
    await expect(fetch(`${baseUrl.http}/missing-route`).then((response) => response.text())).resolves.toContain('<main>Casino Warehouse</main>');

    await expect(sendUpgradeRequest(baseUrl.port, '/not-ws', 'Sec-WebSocket-Key: bad')).resolves.toBeUndefined();
    await expect(sendUpgradeRequest(baseUrl.port, '/ws')).resolves.toBeUndefined();
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
    await waitForMessageSince(
      mainPlayer,
      mainCheckpoint,
      (message) =>
        (message.type === 'room-closed' && message.roomId === mainBeatRoomId && message.reason === 'server-data-cleared') ||
        (message.type === 'room-state' && message.room.roomId === mainBeatRoomId && message.room.players.length === 0 && message.room.spectators.length === 0),
    );
    await waitForMessageSince(host, hostCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0);
    await waitForMessageSince(mainPlayer, mainCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0);
    await waitForMessageSince(admin, adminCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0);

    expect(messageIndexSince(host, hostCheckpoint, (message) => message.type === 'room-closed' && message.roomId === created.room.roomId)).toBeLessThan(
      messageIndexSince(host, hostCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0),
    );
    expect(
      messageIndexSince(
        mainPlayer,
        mainCheckpoint,
        (message) =>
          (message.type === 'room-closed' && message.roomId === mainBeatRoomId) || (message.type === 'room-state' && message.room.roomId === mainBeatRoomId),
      ),
    ).toBeLessThan(messageIndexSince(mainPlayer, mainCheckpoint, (message) => message.type === 'data-state' && message.profileState.profiles.length === 0));

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

const sendUpgradeRequest = async (port: number, path: string, extraHeader = ''): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = connectSocket(port, '127.0.0.1');
    socket.on('connect', () => {
      socket.write(
        `${[`GET ${path} HTTP/1.1`, 'Host: 127.0.0.1', 'Connection: Upgrade', 'Upgrade: websocket', extraHeader].filter(Boolean).join('\r\n')}\r\n\r\n`,
      );
    });
    socket.on('close', () => resolve());
    socket.on('error', reject);
  });

const connect = async (url: string, options: { readonly waitForConnected?: boolean } = {}): Promise<SocketProbe> => {
  const socket = new WebSocket(url);
  const probe = new SocketProbe(socket);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('WebSocket failed to connect.')), { once: true });
  });
  sockets.push(probe);
  if (options.waitForConnected ?? true) {
    await probe.waitFor((message) => message.type === 'error' && message.code === 'connected');
  }
  return probe;
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

const waitForMessageSince = async (probe: SocketProbe, checkpoint: number, predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> => {
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

const messageIndexSince = (probe: SocketProbe, checkpoint: number, predicate: (message: ServerMessage) => boolean): number => {
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
