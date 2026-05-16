import { describe, expect, it, vi } from 'vitest';
import { mainBeatRoomId, RoomAuthority } from '../../../src/multiplayer/roomAuthority';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import type { Card } from '../../../src/game/cards/Card';
import { rigDeck } from '../../../src/game/cards/rigDeck';
import { decodeServerMessage } from '../../../src/multiplayer/protocol/decodeServerMessage';
import { encodeMessage } from '../../../src/multiplayer/protocol/encodeMessage';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import type { AuthorityResult } from '../../../src/multiplayer/roomAuthorityModel/AuthorityResult';
import type { RoomGameId } from '../../../src/multiplayer/protocol/RoomGameId';
import type { RoomSeatId } from '../../../src/multiplayer/protocol/RoomSeatId';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { RoomState } from '../../../src/multiplayer/roomAuthorityModel/RoomState';
import { serverMessageSchema } from '../../../src/schemas/protocol/serverMessageSchema';
import { createMemoryServerDataStore } from '../../../src/state/serverDataStore/createMemoryServerDataStore';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { BlackjackTableSnapshot } from '../../../src/game/blackjackTable/BlackjackTableSnapshot';
import type { SlotSnapshot } from '../../../src/game/slots/SlotSnapshot';

const create = (gameId: RoomGameId, profileId: string, bankroll = 500, maxPlayers?: number): ClientMessage => ({
  version: 1,
  type: 'create-room',
  gameId,
  roomName: `${gameId} room`,
  maxPlayers,
  profileId,
  profileName: profileId.toUpperCase(),
  bankroll,
});

const join = (gameId: RoomGameId, roomId: string, profileId: string, bankroll = 500, role: 'player' | 'spectator' = 'player'): ClientMessage => ({
  version: 1,
  type: 'join-room',
  gameId,
  roomId,
  role,
  profileId,
  profileName: profileId.toUpperCase(),
  bankroll,
});

const claimSeat = (seatId: RoomSeatId): ClientMessage => ({ version: 1, type: 'assign-seat', seatId });

const beat = (room: RoomSnapshot): GameSnapshot => room.game as GameSnapshot;
const blackjack = (room: RoomSnapshot): BlackjackTableSnapshot => room.game as BlackjackTableSnapshot;
const slots = (room: RoomSnapshot): SlotSnapshot => room.game as SlotSnapshot;
const roomStateForTest = (authority: RoomAuthority, roomId: string): RoomState =>
  (authority as RoomAuthority & { readonly rooms: Map<string, RoomState> }).rooms.get(roomId)!;
const rigImmediateBeatRound = (authority: RoomAuthority, roomId: string): void => {
  const roomState = roomStateForTest(authority, roomId);
  if (roomState.model.kind !== 'beat-the-house') {
    throw new Error('Expected a Beat the House test room.');
  }
  const originalDeal = roomState.model.game.deal.bind(roomState.model.game);
  vi.spyOn(roomState.model.game, 'deal').mockImplementation(() =>
    originalDeal(
      rigDeck([
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'hearts' },
      ] satisfies Card[]),
    ),
  );
};

describe('per-game multiplayer protocol', () => {
  it('requires game-scoped create, list, and join messages', () => {
    expect(parseClientMessage({ version: 1, type: 'request-data' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'heartbeat-ack', sentAt: Date.now() })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'authorize-profiles', profileTokens: [{ profileId: 'a', profileToken: 'profile-token' }] })).toMatchObject({
      ok: true,
    });
    expect(parseClientMessage({ version: 1, type: 'authorize-admin', adminToken: 'admin-token' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'create-profile', profileName: 'Ada' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'house-advance', profileId: 'a' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'admin-bankroll', profileId: 'a', action: 'add', amount: 50 })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'list-rooms', gameId: 'blackjack' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'create-room', profileId: 'a', profileName: 'A', bankroll: 50 })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'join-room', gameId: 'blackjack', profileId: 'b', profileName: 'B', bankroll: 50 })).toMatchObject({
      ok: false,
    });
    expect(parseClientMessage({ version: 1, type: 'select-game', gameId: 'beat-the-house' })).toMatchObject({ ok: false });
    expect(parseClientMessage(join('blackjack', 'abc123', 'b')).message).toMatchObject({ roomId: 'ABC123', gameId: 'blackjack', role: 'player' });
    expect(parseClientMessage({ version: 1, type: 'blackjack-action', action: 'stand' }).ok).toBe(true);
    expect(parseClientMessage({ version: 1, type: 'slots-ready', ready: true }).ok).toBe(true);
  });

  it('rejects malformed room and game action payloads without legacy fallbacks', () => {
    expect(parseClientMessage(null)).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'list-rooms', gameId: 'missing' })).toMatchObject({ ok: false, error: 'Game id is invalid.' });
    expect(parseClientMessage({ version: 1, type: 'list-rooms', gameId: 'slots:house-of-sevens' })).toMatchObject({ ok: false, error: 'Game id is invalid.' });
    expect(parseClientMessage({ version: 1, type: 'create-room', gameId: 'blackjack', profileId: 'a', profileName: 'A', bankroll: '50' })).toMatchObject({
      ok: false,
    });
    expect(parseClientMessage({ version: 1, type: 'create-room', gameId: 'blackjack', profileId: 'a', profileName: 'A', bankroll: 50 })).toMatchObject({
      ok: true,
      message: { roomName: undefined, maxPlayers: undefined, allowSpectators: undefined },
    });
    expect(
      parseClientMessage({
        version: 1,
        type: 'create-room',
        gameId: 'slots:thai-princess',
        roomName: 'A very long room name that should be trimmed to the protocol limit',
        maxPlayers: 6,
        allowSpectators: false,
        profileId: 'a',
        profileName: 'A',
        bankroll: 50,
      }).message,
    ).toMatchObject({ roomName: 'A very long room name that should be trimmed to ', maxPlayers: 6, allowSpectators: false });
    expect(parseClientMessage({ version: 1, type: 'join-room', gameId: 'blackjack', profileId: 'a', profileName: 'A', bankroll: 50 })).toMatchObject({
      ok: false,
      error: 'Room id is required.',
    });
    expect(parseClientMessage({ version: 1, type: 'assign-seat', seatId: 'middle' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'assign-seat', seatId: 'seat-2' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'place-chip', seatId: 'left', betType: 'bad', amount: 25 })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'player-action', action: 'fold' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'blackjack-deal', wager: '25' })).toMatchObject({ ok: false });
    for (const action of ['hit', 'stand', 'double', 'split', 'insurance', 'new-hand']) {
      expect(parseClientMessage({ version: 1, type: 'blackjack-action', action })).toMatchObject({ ok: true });
    }
    expect(parseClientMessage({ version: 1, type: 'blackjack-action', action: 'fold' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'slots-wager', wager: '10' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'slots-ready', ready: 'yes' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'slots-spin' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'slots-pick-bonus' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'admin-debug', action: 'force-settle', reason: 'test' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ version: 1, type: 'admin-debug', action: 'cheat' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ version: 1, type: 'not-real' })).toMatchObject({ ok: false });
    expect(decodeServerMessage('{bad')).toBeUndefined();
  });

  it('round-trips protocol messages without accepting wrong versions', () => {
    const message = join('slots:thai-princess', 'ROOM01', 'alice', 300, 'spectator');
    const room = new RoomAuthority().handle('a', create('beat-the-house', 'alice')).direct;
    expect(parseClientMessage(JSON.parse(encodeMessage(message))).message).toEqual(message);
    expect(decodeServerMessage('{"version":1,"type":"profile-credentials","profileId":"alice","profileToken":"token"}')).toMatchObject({
      type: 'profile-credentials',
      profileId: 'alice',
    });
    expect(decodeServerMessage('{"version":1,"type":"profile-access","ownedProfileIds":["alice"]}')).toMatchObject({
      type: 'profile-access',
      ownedProfileIds: ['alice'],
    });
    expect(decodeServerMessage('{"version":1,"type":"admin-access","authorized":true}')).toMatchObject({ type: 'admin-access', authorized: true });
    expect(
      decodeServerMessage(JSON.stringify({ version: 1, type: 'room-closed', roomId: 'ROOM42', gameId: 'beat-the-house', reason: 'profile-deleted' })),
    ).toMatchObject({ type: 'room-closed', roomId: 'ROOM42', gameId: 'beat-the-house', reason: 'profile-deleted' });
    expect(decodeServerMessage('{"version":1,"type":"room-closed","roomId":"ROOM42","gameId":"missing","reason":"profile-deleted"}')).toBeUndefined();
    expect(decodeServerMessage(JSON.stringify({ version: 1, type: 'room-state', room }))?.type).toBe('room-state');
    expect(decodeServerMessage('{"version":1,"type":"room-state"}')).toBeUndefined();
    expect(decodeServerMessage('{"version":2,"type":"room-state"}')).toBeUndefined();
    expect(serverMessageSchema.safeParse({ version: 1, type: 'room-state', room: { ...room, beat: { rebetSeatIds: ['seat-1'] } } }).success).toBe(false);

    const invalidSettlement = {
      version: 1,
      type: 'settlement',
      roomId: 'ROOM42',
      sessionId: 'SESSION42',
      settlements: [{ id: 'settlement-1', profileId: 'alice', seatId: 'middle', wagered: 25, returned: 0, profit: -25 }],
    };
    expect(serverMessageSchema.safeParse(invalidSettlement).success).toBe(false);
    expect(decodeServerMessage(JSON.stringify(invalidSettlement))).toBeUndefined();
  });
});

describe('per-game room authority', () => {
  it('lists rooms by selected game and prevents cross-game room leakage', () => {
    const authority = new RoomAuthority();
    const beatRoom = authority.handle('a', create('beat-the-house', 'alice')).direct!;
    const blackjackRoom = authority.handle('b', create('blackjack', 'bob')).direct!;

    expect(authority.handle('viewer', { version: 1, type: 'list-rooms', gameId: 'beat-the-house' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      beatRoom.roomId,
      mainBeatRoomId,
    ]);
    authority.handle('main', join('beat-the-house', mainBeatRoomId, 'main-player'));
    expect(authority.handle('viewer', { version: 1, type: 'list-rooms', gameId: 'beat-the-house' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      beatRoom.roomId,
      mainBeatRoomId,
    ]);
    expect(authority.handle('viewer', { version: 1, type: 'list-rooms', gameId: 'blackjack' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      blackjackRoom.roomId,
    ]);
    expect(authority.handle('c', join('blackjack', beatRoom.roomId, 'charlie')).error).toBe('Room belongs to a different game.');
  });

  it('keeps the server-managed Beat the House main room open and resets it when empty', () => {
    const authority = new RoomAuthority();
    const mainRoom = authority.listRooms('beat-the-house').find((room) => room.roomId === mainBeatRoomId);

    expect(mainRoom).toMatchObject({
      roomId: mainBeatRoomId,
      roomName: 'Beat the House Main Room',
      hostProfileId: 'server',
      players: [],
      status: 'waiting',
    });
    expect(authority.handle('viewer', { version: 1, type: 'list-rooms', gameId: 'beat-the-house' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      mainBeatRoomId,
    ]);

    const joined = authority.handle('a', join('beat-the-house', mainBeatRoomId, 'alice', 500)).broadcasts[0];
    expect(joined.players).toEqual([]);
    expect(joined.spectators.map((player) => player.profileId)).toEqual(['alice']);
    const seated = authority.handle('a', claimSeat('left')).broadcasts[0];
    expect(seated.players.map((player) => player.profileId)).toEqual(['alice']);
    expect(seated.seats.find((seat) => seat.seatId === 'left')?.profileId).toBe('alice');

    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const afterLeave = authority.handle('a', { version: 1, type: 'leave-room' }).broadcasts[0];

    expect(afterLeave.roomId).toBe(mainBeatRoomId);
    expect(afterLeave.players).toEqual([]);
    expect(afterLeave.spectators).toEqual([]);
    expect(afterLeave.status).toBe('waiting');
    expect(afterLeave.seats.every((seat) => !seat.profileId)).toBe(true);
    expect(beat(afterLeave).bets.left.main).toBe(0);
    expect(authority.listRooms('beat-the-house').map((room) => room.roomId)).toContain(mainBeatRoomId);

    authority.handle('b', join('beat-the-house', mainBeatRoomId, 'bob', 500));
    const rejoined = authority.handle('b', claimSeat('left')).broadcasts[0];
    expect(rejoined.seats.find((seat) => seat.seatId === 'left')?.profileId).toBe('bob');
  });

  it('keeps Beat the House rooms at three seats with ownership, spectator, leave, and settlement protections', () => {
    const authority = new RoomAuthority();
    const created = authority.handle('a', create('beat-the-house', 'alice', 500, 99)).direct!;
    expect(created.maxPlayers).toBe(3);
    const roomId = created.roomId;
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
    authority.handle('s', join('beat-the-house', roomId, 'sue', 500, 'spectator'));
    authority.handle('a', claimSeat('left'));
    authority.handle('b', claimSeat('centre'));

    expect(authority.handle('s', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 }).error).toBe('Spectators cannot wager.');
    expect(authority.handle('b', claimSeat('left')).error).toBe('Release your current seat before claiming another one.');
    expect(authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'aceFlash', amount: 5 }).error).toBe(
      'Side bets need a main bet on the same hand.',
    );

    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'aceFlash', amount: 5 });
    const wagered = authority.handle('a', { version: 1, type: 'resync' }).direct!;
    expect(beat(wagered).bets.left.main).toBe(25);
    expect(beat(wagered).bets.left.aceFlash).toBe(5);

    const afterLeave = authority.handle('b', { version: 1, type: 'leave-room' }).broadcasts[0];
    expect(afterLeave.players.map((player) => player.profileId)).toEqual(['alice']);
    expect(authority.handle('b', { version: 1, type: 'place-chip', seatId: 'right', betType: 'main', amount: 25 }).error).toBe('Join a game room first.');
  });

  it('keeps profile bankroll central on the server instead of trusting stale client balances', () => {
    const authority = new RoomAuthority();
    authority.handle('a', create('beat-the-house', 'alice', 467));
    const room = authority.handle('a', claimSeat('left')).broadcasts[0];

    expect(room.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(467);
    expect(beat(room).bankroll).toBe(467);

    const wagered = authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 }).broadcasts[0];
    expect(wagered.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(442);

    const rejoined = authority.handle('fresh-a', join('beat-the-house', room.roomId, 'alice', 2169)).broadcasts[0];
    expect(rejoined.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(442);
    expect(beat(rejoined).bankroll).toBe(442);

    authority.handle('fresh-a', { version: 1, type: 'leave-room' });
    const recreated = authority.handle('again-a', create('beat-the-house', 'alice', 2169)).direct!;
    expect(recreated.spectators.find((player) => player.profileId === 'alice')?.bankroll).toBe(442);
    expect(beat(recreated).bankroll).toBe(0);
  });

  it('rejects racing seat claims and duplicate/stale Beat the House settlement attempts', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('beat-the-house', 'alice', 500)).direct!.roomId;
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));

    const aliceSeat = authority.handle('a', claimSeat('left'));
    authority.handle('b', claimSeat('centre'));
    const bobSeat = authority.handle('b', claimSeat('left'));
    expect(aliceSeat.broadcasts[0].seats.find((seat) => seat.seatId === 'left')?.profileId).toBe('alice');
    expect(bobSeat.error).toBe('Release your current seat before claiming another one.');

    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { version: 1, type: 'start-round' });
    let result = authority.handle('b', { version: 1, type: 'start-round' });
    for (let attempts = 0; result.settlements.length === 0 && attempts < 8; attempts += 1) {
      result = authority.handle('a', { version: 1, type: 'player-action', action: 'stick' });
    }
    expect(result.settlements.length).toBeLessThanOrEqual(1);
    expect(authority.handle('a', { version: 1, type: 'player-action', action: 'stick' }).settlements).toEqual([]);
  });

  it('supports Blackjack rooms with five seats, spectators, reconnect, and game-specific actions', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('blackjack', 'alice', 500)).direct!.roomId;
    authority.handle('a', claimSeat('seat-1'));
    ['bob', 'cory', 'dana', 'erin'].forEach((name, index) => authority.handle(`p${index}`, join('blackjack', roomId, name, 500)));
    ['seat-2', 'seat-3', 'seat-4', 'seat-5'].forEach((seatId, index) => authority.handle(`p${index}`, claimSeat(seatId as RoomSeatId)));
    authority.handle('extra', join('blackjack', roomId, 'frank', 500));
    expect(authority.handle('extra', claimSeat('seat-1')).error).toBe('Seat is already occupied.');
    expect(
      authority.handle('watch', join('blackjack', roomId, 'frank', 500, 'spectator')).broadcasts[0].spectators.map((player) => player.profileId),
    ).toContain('frank');
    expect(authority.handle('watch', { version: 1, type: 'blackjack-deal', wager: 25 }).error).toBe('Spectators cannot deal Blackjack.');

    const dealt = authority.handle('a', { version: 1, type: 'blackjack-deal', wager: 25 }).broadcasts[0];
    expect(blackjack(dealt).seats.find((seat) => seat.profileId === 'alice')?.wager).toBe(25);
    expect(authority.handle('p0', { version: 1, type: 'blackjack-action', action: 'hit' }).error).toBe('It is not your Blackjack turn.');

    const rejoined = authority.handle('fresh-a', join('blackjack', roomId, 'alice', 500));
    expect(rejoined.broadcasts[0].players.find((player) => player.profileId === 'alice')?.connectionId).toBe('fresh-a');
    expect(authority.handle('a', { version: 1, type: 'blackjack-action', action: 'stand' }).error).toBe('Join a game room first.');
  });

  it('runs a true five-seat Blackjack table with shared dealer state and independent seat wagers', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('blackjack', 'alice', 500)).direct!.roomId;
    authority.handle('a', claimSeat('seat-1'));
    const joins = [
      ['b', 'bob', 20],
      ['c', 'cory', 30],
      ['d', 'dana', 40],
      ['e', 'erin', 50],
    ] as const;
    joins.forEach(([connectionId, profileId]) => authority.handle(connectionId, join('blackjack', roomId, profileId, 500)));
    ['seat-2', 'seat-3', 'seat-4', 'seat-5'].forEach((seatId, index) => authority.handle(joins[index]?.[0] ?? 'b', claimSeat(seatId as RoomSeatId)));
    const wagers = new Map([
      ['a', 10],
      ['b', 20],
      ['c', 30],
      ['d', 40],
      ['e', 50],
    ]);
    const settlements = [];
    for (const [connectionId, wager] of wagers) {
      const result = authority.handle(connectionId, { version: 1, type: 'blackjack-deal', wager });
      settlements.push(...result.settlements);
    }

    let room = authority.handle('a', { version: 1, type: 'resync' }).direct!;
    const table = blackjack(room);
    expect(table.dealerCards.length).toBe(2);
    expect(table.seats).toHaveLength(5);
    expect(table.seats.map((seat) => seat.wager)).toEqual([10, 20, 30, 40, 50]);
    expect(table.seats.every((seat) => seat.playerCards.length === 2 || seat.phase === 'settled')).toBe(true);
    expect(new Set(table.seats.map((seat) => seat.playerCards.map((card) => `${card.rank}-${card.suit}`).join(','))).size).toBeGreaterThan(1);

    const activeSeatId = table.activeSeatId;
    if (activeSeatId) {
      const wrongConnection = activeSeatId === 'seat-1' ? 'b' : 'a';
      expect(authority.handle(wrongConnection, { version: 1, type: 'blackjack-action', action: 'hit' }).error).toBe('It is not your Blackjack turn.');
    }
    expect(authority.handle('watch', join('blackjack', roomId, 'watcher', 500, 'spectator')).broadcasts[0].spectators).toHaveLength(1);
    expect(authority.handle('watch', { version: 1, type: 'blackjack-action', action: 'stand' }).error).toBe('Spectators cannot act.');

    const connectionBySeat = new Map([
      ['seat-1', 'a'],
      ['seat-2', 'b'],
      ['seat-3', 'c'],
      ['seat-4', 'd'],
      ['seat-5', 'e'],
    ]);
    for (let attempts = 0; attempts < 12 && blackjack(room).phase !== 'settled'; attempts += 1) {
      const seatId = blackjack(room).activeSeatId;
      if (!seatId) {
        break;
      }
      const result = authority.handle(connectionBySeat.get(seatId) ?? 'a', { version: 1, type: 'blackjack-action', action: 'stand' });
      settlements.push(...result.settlements);
      room = result.broadcasts[0] ?? authority.handle('a', { version: 1, type: 'resync' }).direct!;
    }

    expect(blackjack(room).phase).toBe('settled');
    expect(new Set(settlements.map((settlement) => settlement.profileId))).toEqual(new Set(['alice', 'bob', 'cory', 'dana', 'erin']));
    expect(settlements.map((settlement) => settlement.wagered).sort((left, right) => left - right)).toEqual([10, 20, 30, 40, 50]);
    expect(room.players.map((player) => player.bankroll).every((bankroll) => bankroll <= 600)).toBe(true);
  });

  it('supports Thai Princess shared Slots rooms with ready/wager/spin state and room-scoped isolation', () => {
    const authority = new RoomAuthority();
    const firstRoom = authority.handle('a', create('slots:thai-princess', 'alice', 500, 4)).direct!;
    const secondRoom = authority.handle('b', create('slots:thai-princess', 'bob', 500, 4)).direct!;
    authority.handle('c', join('slots:thai-princess', firstRoom.roomId, 'cory', 500));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-1'));
    authority.handle('c', claimSeat('seat-2'));

    expect(authority.handle('a', { version: 1, type: 'slots-wager', wager: 15 }).broadcasts[0].slots?.wagersByProfileId.alice).toBe(15);
    authority.handle('c', { version: 1, type: 'slots-wager', wager: 30 });
    expect(authority.handle('a', { version: 1, type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
    authority.handle('a', { version: 1, type: 'slots-ready', ready: true });
    authority.handle('c', { version: 1, type: 'slots-ready', ready: true });
    const spun = authority.handle('a', { version: 1, type: 'slots-spin' }).broadcasts[0];

    expect(slots(spun).themeId).toBe('thai-princess');
    expect(authority.handle('viewer', { version: 1, type: 'list-rooms', gameId: 'slots:thai-princess' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      firstRoom.roomId,
      secondRoom.roomId,
    ]);
    expect(authority.handle('b', { version: 1, type: 'resync' }).direct?.players.map((player) => player.profileId)).toEqual(['bob']);
    expect(authority.handle('c', { version: 1, type: 'blackjack-deal', wager: 10 }).error).toBe('This action only applies to Blackjack rooms.');
  });

  it('settles Slots shared spins from one outcome with independent per-player wagers and duplicate protection', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('slots:thai-princess', 'alice', 500, 3)).direct!.roomId;
    authority.handle('b', join('slots:thai-princess', roomId, 'bob', 500));
    authority.handle('c', join('slots:thai-princess', roomId, 'cory', 500));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-2'));
    authority.handle('c', claimSeat('seat-3'));

    authority.handle('a', { version: 1, type: 'slots-wager', wager: 5 });
    authority.handle('b', { version: 1, type: 'slots-wager', wager: 10 });
    const wagered = authority.handle('c', { version: 1, type: 'slots-wager', wager: 25 }).broadcasts[0];
    expect(wagered.slots?.wagersByProfileId).toEqual({ alice: 5, bob: 10, cory: 25 });
    expect(authority.handle('a', { version: 1, type: 'slots-ready', ready: true }).broadcasts[0].slots?.readyProfileIds).toEqual(['alice']);
    authority.handle('b', { version: 1, type: 'slots-ready', ready: true });
    expect(authority.handle('a', { version: 1, type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
    authority.handle('c', { version: 1, type: 'slots-ready', ready: true });

    const spun = authority.handle('b', { version: 1, type: 'slots-spin' });
    let settled = spun;
    for (let picks = 0; settled.broadcasts[0] && slots(settled.broadcasts[0]).phase === 'bonus' && picks < 4; picks += 1) {
      settled = authority.handle('b', { version: 1, type: 'slots-pick-bonus' });
    }
    const room = settled.broadcasts[0];
    expect(slots(room).themeId).toBe('thai-princess');
    expect(settled.settlements.map((settlement) => settlement.wagered).sort((left, right) => left - right)).toEqual([5, 10, 25]);
    expect(new Set(settled.settlements.map((settlement) => settlement.profileId))).toEqual(new Set(['alice', 'bob', 'cory']));
    expect(room.slots?.readyProfileIds).toEqual([]);
    expect(room.slots?.returnedByProfileId).toBeDefined();
    expect(authority.handle('b', { version: 1, type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
  });

  it('gates Beat the House deal and next round on all current players while ignoring spectators', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('beat-the-house', 'alice', 500)).direct!.roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
    authority.handle('b', claimSeat('centre'));
    authority.handle('watch', join('beat-the-house', roomId, 'watcher', 500, 'spectator'));
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    rigImmediateBeatRound(authority, roomId);

    const aliceReady = authority.handle('a', { version: 1, type: 'start-round' }).broadcasts[0];
    expect(beat(aliceReady).phase).toBe('betting');
    expect(aliceReady.beat?.readyProfileIds).toEqual(['alice']);
    expect(aliceReady.beat?.readyCount).toBe(1);
    expect(aliceReady.beat?.playerCount).toBe(2);
    expect(authority.handle('watch', { version: 1, type: 'start-round' }).error).toBe('Spectators cannot start rounds.');

    const bobReady = authority.handle('b', { version: 1, type: 'start-round' });
    expect(beat(bobReady.broadcasts[0]).phase).toBe('roundOver');
    expect(bobReady.broadcasts[0].beat?.readyProfileIds).toEqual([]);
    expect(bobReady.broadcasts[0].beat?.nextRoundDeadlineAt).toEqual(expect.any(Number));

    const aliceNextReady = authority.handle('a', { version: 1, type: 'next-round' }).broadcasts[0];
    expect(beat(aliceNextReady).phase).toBe('roundOver');
    expect(aliceNextReady.beat?.readyProfileIds).toEqual(['alice']);
    expect(authority.handle('watch', { version: 1, type: 'next-round' }).error).toBe('Spectators cannot advance rounds.');

    const bobNextReady = authority.handle('b', { version: 1, type: 'next-round' }).broadcasts[0];
    expect(beat(bobNextReady).phase).toBe('betting');
    expect(bobNextReady.beat?.readyProfileIds).toEqual([]);
    expect(bobNextReady.beat?.nextRoundDeadlineAt).toBeUndefined();
  });

  it('clears stale Beat the House readiness when wagers or player membership change', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('beat-the-house', 'alice', 500)).direct!.roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
    authority.handle('b', claimSeat('centre'));
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });

    expect(authority.handle('a', { version: 1, type: 'start-round' }).broadcasts[0].beat?.readyProfileIds).toEqual(['alice']);
    expect(authority.handle('a', { version: 1, type: 'place-tip', seatId: 'left', amount: 5 }).broadcasts[0].beat?.readyProfileIds).toEqual([]);

    authority.handle('a', { version: 1, type: 'start-round' });
    authority.handle('c', join('beat-the-house', roomId, 'cory', 500));
    const corySeated = authority.handle('c', claimSeat('right')).broadcasts[0];
    expect(corySeated.beat?.readyProfileIds).toEqual([]);
  });

  it('advances Beat the House next round after the server-side deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const authority = new RoomAuthority();
    const timeoutResults: AuthorityResult[] = [];
    authority.setAsyncResultHandler((result) => timeoutResults.push(result));
    try {
      const roomId = authority.handle('a', create('beat-the-house', 'alice', 500)).direct!.roomId;
      authority.handle('a', claimSeat('left'));
      authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
      authority.handle('b', claimSeat('centre'));
      authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
      rigImmediateBeatRound(authority, roomId);

      authority.handle('a', { version: 1, type: 'start-round' });
      const settled = authority.handle('b', { version: 1, type: 'start-round' }).broadcasts[0];
      expect(beat(settled).phase).toBe('roundOver');
      expect(settled.beat?.nextRoundRemainingMs).toBe(20_000);

      vi.advanceTimersByTime(20_000);

      expect(timeoutResults).toHaveLength(1);
      expect(beat(timeoutResults[0].broadcasts[0]).phase).toBe('betting');
      expect(timeoutResults[0].broadcasts[0].beat?.readyProfileIds).toEqual([]);
      expect(timeoutResults[0].broadcasts[0].beat?.nextRoundDeadlineAt).toBeUndefined();
    } finally {
      authority.dispose();
      vi.useRealTimers();
    }
  });

  it('covers room lifecycle edges, explicit seats, disabled spectators, admin reset, and closed-room cleanup', () => {
    const authority = new RoomAuthority();
    const privateRoom = authority.handle('a', {
      version: 1,
      type: 'create-room',
      gameId: 'blackjack',
      profileId: 'alice',
      profileName: 'ALICE',
      bankroll: 500,
      allowSpectators: false,
    }).direct!;
    expect(authority.handle('watch', join('blackjack', privateRoom.roomId, 'watcher', 500, 'spectator')).error).toBe(
      'Spectators are not allowed in this room.',
    );
    expect(authority.handle('missing', join('blackjack', 'MISSING', 'ghost')).error).toBe('Room was not found.');

    const explicitSeatRoom = authority.handle('b', create('blackjack', 'bob', 500)).direct!;
    const joined = authority.handle('c', {
      version: 1,
      type: 'join-room',
      gameId: 'blackjack',
      roomId: explicitSeatRoom.roomId,
      profileId: 'cory',
      profileName: 'CORY',
      bankroll: 500,
      role: 'player',
      seatId: 'seat-3',
    });
    expect(joined.broadcasts[0].seats.find((seat) => seat.seatId === 'seat-3')?.profileId).toBe('cory');
    expect(authority.handle('c', { version: 1, type: 'assign-seat', seatId: 'left' }).error).toBe('Seat does not belong to this game room.');

    expect(authority.handle('c', { version: 1, type: 'admin-debug', action: 'reset-room' }).error).toBe('Only the room host can use room admin controls.');
    expect(authority.handle('b', { version: 1, type: 'admin-debug', action: 'reset-room' }).broadcasts[0].revision).toBeGreaterThan(0);

    authority.handle('b', { version: 1, type: 'leave-room' });
    authority.handle('c', { version: 1, type: 'leave-room' });
    expect(authority.listRooms('blackjack').map((room) => room.roomId)).toEqual([privateRoom.roomId]);
    expect(authority.disconnect('nobody')).toEqual({ broadcasts: [], settlements: [] });

    const watchedRoom = authority.handle('host', create('beat-the-house', 'host', 500)).direct!;
    authority.handle('spectator', join('beat-the-house', watchedRoom.roomId, 'spectator', 500, 'spectator'));
    expect(authority.handle('host', { version: 1, type: 'leave-room' }).broadcasts[0].status).toBe('waiting');
  });

  it('covers Beat the House clear, rebet, turn, next-round, and wrong-game action branches', () => {
    const authority = new RoomAuthority();
    authority.handle('a', create('beat-the-house', 'alice', 500));
    authority.handle('a', claimSeat('left'));
    expect(authority.handle('a', { version: 1, type: 'next-round' }).error).toBe('Room phase does not allow advancing rounds.');
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const cleared = authority.handle('a', { version: 1, type: 'clear-bets' }).broadcasts[0];
    expect(beat(cleared).bets.left.main).toBe(0);

    expect(authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'matchPush', amount: 999 }).error).toBe(
      'Insufficient profile bankroll for that wager.',
    );
    expect(authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'invalid' as never, amount: 10 }).error).toBe('Bet is invalid.');
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { version: 1, type: 'start-round' });
    expect(authority.handle('a', { version: 1, type: 'clear-bets' }).error).toBe('Bets can only be cleared before the round starts.');
    expect(authority.handle('a', { version: 1, type: 'rebet' }).error).toBe('Rebet is only available before the round starts.');
    expect(authority.handle('a', { version: 1, type: 'start-round' }).error).toBe('Round is already in progress.');
    expect(authority.handle('ghost', { version: 1, type: 'next-round' }).error).toBe('Join a game room first.');

    let settled = authority.handle('a', { version: 1, type: 'player-action', action: 'stick' });
    for (let attempts = 0; settled.broadcasts[0] && beat(settled.broadcasts[0]).phase !== 'roundOver' && attempts < 8; attempts += 1) {
      settled = authority.handle('a', { version: 1, type: 'player-action', action: 'stick' });
    }
    expect(authority.handle('a', { version: 1, type: 'next-round' }).broadcasts[0].phase).toBe('betting');

    const blackjackRoom = authority.handle('b', create('blackjack', 'bob', 500)).direct!;
    expect(authority.handle('b', { version: 1, type: 'clear-bets' }).error).toBe('This action only applies to Beat the House rooms.');
    expect(authority.handle('b', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 10 }).error).toBe(
      'Beat the House wagers are not valid in this room.',
    );
    expect(blackjackRoom.gameId).toBe('blackjack');
  });

  it('authorizes Beat the House dealer tips by seat and records tip ledger entries when the round starts', () => {
    const store = createMemoryServerDataStore();
    const authority = new RoomAuthority(store);
    const roomId = authority.handle('a', create('beat-the-house', 'alice', 100)).direct!.roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('watch', join('beat-the-house', roomId, 'watcher', 100, 'spectator'));

    expect(authority.handle('watch', { version: 1, type: 'place-tip', seatId: 'left', amount: 5 }).error).toBe('Spectators cannot tip the dealer.');
    expect(authority.handle('a', { version: 1, type: 'place-tip', seatId: 'right', amount: 5 }).error).toBe('You can only tip from your own seat.');
    expect(authority.handle('a', { version: 1, type: 'place-tip', seatId: 'left', amount: 999 }).error).toBe(
      'Insufficient profile bankroll for that dealer tip.',
    );

    const tipped = authority.handle('a', { version: 1, type: 'place-tip', seatId: 'left', amount: 10 }).broadcasts[0];
    expect(beat(tipped).dealerTips.left).toBe(10);
    expect(tipped.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(90);

    const cleared = authority.handle('a', { version: 1, type: 'clear-bets' }).broadcasts[0];
    expect(beat(cleared).dealerTips.left).toBe(0);
    expect(cleared.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(100);
    expect(store.snapshot().profileState.profiles.find((profile) => profile.id === 'alice')?.transactions).toEqual([]);

    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { version: 1, type: 'place-tip', seatId: 'left', amount: 10 });
    authority.handle('a', { version: 1, type: 'start-round' });

    const transactions = store.snapshot().profileState.profiles.find((profile) => profile.id === 'alice')?.transactions ?? [];
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'dealer_tip',
          amount: -10,
          description: 'Dealer tip taken.',
          metadata: { handId: 'left', dealerTip: 10 },
        }),
      ]),
    );
    expect(authority.handle('a', { version: 1, type: 'start-round' }).error).toBe('Round is already in progress.');
    expect(
      store
        .snapshot()
        .profileState.profiles.find((profile) => profile.id === 'alice')
        ?.transactions.filter((transaction) => transaction.type === 'dealer_tip'),
    ).toHaveLength(1);
  });

  it('records Beat dealer tip debits before immediate start-round settlement side effects', () => {
    const store = createMemoryServerDataStore();
    const authority = new RoomAuthority(store);
    const roomId = authority.handle('a', create('beat-the-house', 'alice', 100)).direct!.roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { version: 1, type: 'place-tip', seatId: 'left', amount: 10 });
    const roomState = roomStateForTest(authority, roomId);
    if (roomState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House test room.');
    }
    const originalDeal = roomState.model.game.deal.bind(roomState.model.game);
    vi.spyOn(roomState.model.game, 'deal').mockImplementation(() =>
      originalDeal(
        rigDeck([
          { rank: 'A', suit: 'spades' },
          { rank: 'K', suit: 'hearts' },
        ] satisfies Card[]),
      ),
    );

    const started = authority.handle('a', { version: 1, type: 'start-round' });

    expect(beat(started.broadcasts[0]).phase).toBe('roundOver');
    expect(started.settlements).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'gameplay', returned: 50, profit: 25 })]));
    const transactions = store.snapshot().profileState.profiles.find((profile) => profile.id === 'alice')?.transactions ?? [];
    expect(transactions).toContainEqual(
      expect.objectContaining({
        type: 'dealer_tip',
        amount: -10,
        balanceBefore: 75,
        balanceAfter: 65,
        metadata: { handId: 'left', dealerTip: 10 },
      }),
    );
    expect(store.snapshot().profileState.profiles.find((profile) => profile.id === 'alice')?.bankroll).toBeGreaterThanOrEqual(115);
  });

  it('covers additional room authority validation edges without trusting malformed client state', () => {
    const authority = new RoomAuthority();
    const blackjackRoom = authority.handle('host', create('blackjack', 'host', 500, 1)).direct!;

    expect(
      authority.handle('joiner', {
        version: 1,
        type: 'join-room',
        gameId: 'blackjack',
        roomId: blackjackRoom.roomId,
        profileId: 'joiner',
        profileName: 'JOINER',
        bankroll: 500,
        role: 'player',
        seatId: 'left',
      }).error,
    ).toBe('Seat does not belong to this game room.');
    authority.handle('host', claimSeat('seat-1'));
    const roomState = roomStateForTest(authority, blackjackRoom.roomId);
    roomState.seats.clear();
    expect(authority.handle('host', { version: 1, type: 'blackjack-deal', wager: 25 }).error).toBe('Claim a Blackjack seat before dealing.');
    expect(authority.handle('host', { version: 1, type: 'blackjack-action', action: 'stand' }).error).toBe('Claim a Blackjack seat before acting.');
    expect(authority.handle('host', { version: 1, type: 'slots-pick-bonus' }).error).toBe('This action only applies to Slots rooms.');

    const beatRoom = authority.handle('beat-host', create('beat-the-house', 'beat-host', 500)).direct!;
    authority.handle('beat-host', claimSeat('left'));
    authority.handle('beat-watch', join('beat-the-house', beatRoom.roomId, 'beat-watch', 500, 'spectator'));
    expect(authority.handle('beat-watch', { version: 1, type: 'start-round' }).error).toBe('Spectators cannot start rounds.');
    expect(authority.handle('beat-watch', { version: 1, type: 'next-round' }).error).toBe('Spectators cannot advance rounds.');
    expect(authority.handle('beat-host', { version: 1, type: 'unsupported-room-action' } as never).error).toBe('Unsupported room action.');

    authority.handle('beat-host', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 10 });
    const beatState = roomStateForTest(authority, beatRoom.roomId);
    if (beatState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House test room.');
    }
    const deterministicRound = beatState.model.game.deal(
      rigDeck([
        { rank: '7', suit: 'spades' },
        { rank: '9', suit: 'hearts' },
        { rank: 'K', suit: 'clubs' },
      ] satisfies Card[]),
    );
    expect(deterministicRound.activeHand).toBe('left');
    expect(authority.handle('beat-watch', { version: 1, type: 'player-action', action: 'hit' }).error).toBe('Spectators cannot act.');
    expect(authority.handle('beat-host', { version: 1, type: 'player-action', action: 'hit' }).broadcasts[0].gameId).toBe('beat-the-house');

    const slotsRoom = authority.handle('slots-host', create('slots:thai-princess', 'slots-host', 100, 2)).direct!;
    authority.handle('slots-host', claimSeat('seat-1'));
    expect(authority.handle('slots-host', { version: 1, type: 'slots-ready', ready: true }).error).toBe('Set your Slots wager before readying.');
    expect(authority.handle('slots-host', { version: 1, type: 'clear-bets' }).error).toBe('This action only applies to Beat the House rooms.');
    expect(slotsRoom.gameId).toBe('slots:thai-princess');
  });

  it('scopes Beat the House clear and rebet to the acting player seat', () => {
    const store = createMemoryServerDataStore();
    const authority = new RoomAuthority(store);
    const roomId = authority.handle('a', create('beat-the-house', 'alice', 1000)).direct!.roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('b', join('beat-the-house', roomId, 'bob', 1000));
    authority.handle('b', claimSeat('right'));
    authority.handle('watch', join('beat-the-house', roomId, 'watcher', 1000, 'spectator'));
    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const wagered = authority.handle('b', { version: 1, type: 'place-chip', seatId: 'right', betType: 'main', amount: 40 }).broadcasts[0];
    expect(wagered.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(975);
    expect(wagered.players.find((player) => player.profileId === 'bob')?.bankroll).toBe(960);
    expect(authority.handle('watch', { version: 1, type: 'clear-bets' }).error).toBe('Spectators cannot clear bets.');

    const cleared = authority.handle('a', { version: 1, type: 'clear-bets' }).broadcasts[0];

    expect(beat(cleared).bets.left.main).toBe(0);
    expect(beat(cleared).bets.right.main).toBe(40);
    expect(cleared.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(1000);
    expect(cleared.players.find((player) => player.profileId === 'bob')?.bankroll).toBe(960);
    expect(authority.handle('a', { version: 1, type: 'clear-bets' }).error).toBe('You do not have bets to clear.');
    expect(authority.handle('watch', { version: 1, type: 'rebet' }).error).toBe('Spectators cannot rebet.');

    authority.handle('a', { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { version: 1, type: 'start-round' });
    let room = authority.handle('b', { version: 1, type: 'start-round' }).broadcasts[0];
    for (let attempts = 0; beat(room).phase !== 'roundOver' && attempts < 8; attempts += 1) {
      const activeHand = beat(room).activeHand;
      const connectionId = activeHand === 'right' ? 'b' : 'a';
      const acted = authority.handle(connectionId, { version: 1, type: 'player-action', action: 'stick' });
      if (acted.error) {
        throw new Error(acted.error);
      }
      room = acted.broadcasts[0];
    }
    expect(beat(room).phase).toBe('roundOver');
    authority.handle('a', { version: 1, type: 'next-round' });
    const nextRound = authority.handle('b', { version: 1, type: 'next-round' }).broadcasts[0];
    expect(beat(nextRound).rebetAmounts).toMatchObject({ left: 25, right: 40 });
    expect(nextRound.beat?.rebetSeatIds).toEqual(['left', 'right']);
    store.setProfileBankroll('bob', 1);
    const lowBobBankroll = authority.reconcileProfiles('test bankroll update').broadcasts[0];
    expect(lowBobBankroll.players.find((player) => player.profileId === 'bob')?.bankroll).toBe(1);
    expect(authority.handle('b', { version: 1, type: 'rebet' }).error).toBe('Need £40 to rebet.');
    authority.handle('b', { version: 1, type: 'leave-room' });
    authority.handle('c', join('beat-the-house', roomId, 'cory', 1));
    const reseated = authority.handle('c', claimSeat('right')).broadcasts[0];
    const aliceBeforeRebet = reseated.players.find((player) => player.profileId === 'alice')!.bankroll;
    expect(reseated.players.find((player) => player.profileId === 'cory')?.bankroll).toBe(1);
    expect(reseated.beat?.rebetSeatIds).toEqual(['left']);

    const aliceRebet = authority.handle('a', { version: 1, type: 'rebet' }).broadcasts[0];

    expect(beat(aliceRebet).bets.left.main).toBe(25);
    expect(beat(aliceRebet).bets.right.main).toBe(0);
    expect(aliceRebet.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(aliceBeforeRebet - 25);
    expect(aliceRebet.players.find((player) => player.profileId === 'cory')?.bankroll).toBe(1);
    expect(authority.handle('a', { version: 1, type: 'rebet' }).error).toBe('Clear your current bets before rebetting.');
    expect(authority.handle('c', { version: 1, type: 'rebet' }).error).toBe('No previous bet saved for your seat.');
    const afterBobError = authority.handle('a', { version: 1, type: 'resync' }).direct!;
    expect(beat(afterBobError).bets.left.main).toBe(25);
    expect(beat(afterBobError).bets.right.main).toBe(0);
  });

  it('covers Blackjack action branches, settlement, and reset behaviour', () => {
    const authority = new RoomAuthority();
    const roomId = authority.handle('a', create('blackjack', 'alice', 500)).direct!.roomId;
    authority.handle('b', join('blackjack', roomId, 'bob', 500));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-2'));

    expect(authority.handle('a', { version: 1, type: 'blackjack-deal', wager: 999 }).error).toBe('Insufficient profile bankroll for that wager.');
    const dealt = authority.handle('a', { version: 1, type: 'blackjack-deal', wager: 25 }).broadcasts[0];
    expect(blackjack(dealt).phase).toBe('betting');
    authority.handle('b', { version: 1, type: 'blackjack-deal', wager: 30 });
    const table = authority.handle('a', { version: 1, type: 'resync' }).direct!;
    expect(blackjack(table).phase === 'playing' || blackjack(table).phase === 'settled').toBe(true);
    const duplicateDeal = authority.handle('a', { version: 1, type: 'blackjack-deal', wager: 25 });
    expect(Boolean(duplicateDeal.error) || duplicateDeal.broadcasts.length > 0).toBe(true);

    const activeAfterDeal = blackjack(authority.handle('a', { version: 1, type: 'resync' }).direct!).activeSeatId;
    const hit = activeAfterDeal
      ? authority.handle(activeAfterDeal === 'seat-2' ? 'b' : 'a', { version: 1, type: 'blackjack-action', action: 'hit' })
      : undefined;
    expect(hit ? hit.broadcasts.length + hit.settlements.length : 1).toBeGreaterThan(0);
    const activeBeforeStand = blackjack(authority.handle('a', { version: 1, type: 'resync' }).direct!).activeSeatId;
    const stand = activeBeforeStand
      ? authority.handle(activeBeforeStand === 'seat-2' ? 'b' : 'a', { version: 1, type: 'blackjack-action', action: 'stand' })
      : undefined;
    expect(stand ? stand.broadcasts.length : 1).toBeGreaterThan(0);
    for (let attempts = 0; attempts < 6 && blackjack(authority.handle('a', { version: 1, type: 'resync' }).direct!).phase !== 'settled'; attempts += 1) {
      const activeSeat = blackjack(authority.handle('a', { version: 1, type: 'resync' }).direct!).activeSeatId;
      authority.handle(activeSeat === 'seat-2' ? 'b' : 'a', { version: 1, type: 'blackjack-action', action: 'stand' });
    }
    const reset = authority.handle('a', { version: 1, type: 'blackjack-action', action: 'new-hand' }).broadcasts[0];
    expect(blackjack(reset).phase).toBe('betting');

    const lowBankrollRoom = authority.handle('low', create('blackjack', 'low', 25)).direct!;
    authority.handle('low', claimSeat('seat-1'));
    authority.handle('low', { version: 1, type: 'blackjack-deal', wager: 25 });
    const lowDouble = authority.handle('low', { version: 1, type: 'blackjack-action', action: 'double' });
    expect(Boolean(lowDouble.error) || lowDouble.broadcasts.length > 0).toBe(true);
    expect(lowBankrollRoom.gameId).toBe('blackjack');
  });

  it('covers Slots spectator, affordability, unready, bonus-pick, free-spin, and reset branches', () => {
    const authority = new RoomAuthority();
    expect(authority.handle('cap', create('slots:thai-princess', 'cap', 20, 99)).direct!.maxPlayers).toBe(4);
    const roomId = authority.handle('a', create('slots:thai-princess', 'alice', 20, 2)).direct!.roomId;
    authority.handle('b', join('slots:thai-princess', roomId, 'bob', 20));
    authority.handle('s', join('slots:thai-princess', roomId, 'sue', 20, 'spectator'));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-2'));

    expect(authority.handle('s', { version: 1, type: 'slots-wager', wager: 5 }).error).toBe('Spectators cannot wager.');
    expect(authority.handle('s', { version: 1, type: 'slots-ready', ready: true }).error).toBe('Spectators cannot ready spins.');
    expect(authority.handle('s', { version: 1, type: 'slots-spin' }).error).toBe('Spectators cannot spin.');
    expect(authority.handle('s', { version: 1, type: 'slots-pick-bonus' }).error).toBe('Spectators cannot pick bonus prizes.');
    expect(authority.handle('a', { version: 1, type: 'slots-wager', wager: 50 }).error).toBe('Insufficient profile bankroll for that wager.');

    authority.handle('a', { version: 1, type: 'slots-wager', wager: 5 });
    authority.handle('b', { version: 1, type: 'slots-wager', wager: 10 });
    authority.handle('a', { version: 1, type: 'slots-ready', ready: true });
    authority.handle('a', { version: 1, type: 'slots-ready', ready: false });
    expect(authority.handle('a', { version: 1, type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
    authority.handle('a', { version: 1, type: 'slots-ready', ready: true });
    authority.handle('b', { version: 1, type: 'slots-ready', ready: true });
    const spun = authority.handle('a', { version: 1, type: 'slots-spin' }).broadcasts[0];
    expect(slots(spun).themeId).toBe('thai-princess');
    expect(authority.handle('a', { version: 1, type: 'slots-pick-bonus' }).broadcasts[0].gameId).toBe('slots:thai-princess');
    expect(authority.handle('a', { version: 1, type: 'admin-debug', action: 'reset-room' }).broadcasts[0].slots?.readyProfileIds).toEqual([]);
  });
});
