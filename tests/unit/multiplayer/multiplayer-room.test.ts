import { describe, expect, it, vi } from 'vitest';
import { mainBeatRoomId, RoomAuthority as ProductionRoomAuthority } from '../../../src/multiplayer/roomAuthority';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import { decodeServerMessage } from '../../../src/multiplayer/protocol/decodeServerMessage';
import { encodeMessage } from '../../../src/multiplayer/protocol/encodeMessage';
import { parseClientMessage } from '../../../src/multiplayer/protocol/parseClientMessage';
import type { AuthorityResult } from '../../../src/multiplayer/roomAuthorityModel/AuthorityResult';
import type { RoomGameId } from '../../../src/multiplayer/protocol/RoomGameId';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { RoomState } from '../../../src/multiplayer/roomAuthorityModel/RoomState';
import { serverMessageSchema } from '../../../src/schemas/protocol/serverMessageSchema';
import { createMemoryServerDataStore } from '../../../src/state/serverDataStore/createMemoryServerDataStore';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { BlackjackTableSnapshot } from '../../../src/game/blackjackTable/BlackjackTableSnapshot';
import type { SlotSnapshot } from '../../../src/game/slots/SlotSnapshot';
import { createDeterministicBeatTheHouseShoe } from '../game/createDeterministicBeatTheHouseShoe';
import { testConnectionId, testProfileId, testRoomId, testRoomSeatId } from '../schemas/testIds';

class RoomAuthority extends ProductionRoomAuthority {
  public override handle(connectionId: string, message: ClientMessage): AuthorityResult {
    return super.handle(testConnectionId(connectionId), message);
  }

  public override disconnect(connectionId: string): AuthorityResult {
    return super.disconnect(testConnectionId(connectionId));
  }
}

const requireDirect = (result: AuthorityResult): RoomSnapshot => {
  const direct = result.direct;
  if (!direct) {
    throw new Error('Missing direct snapshot.');
  }
  return direct;
};

const requireBroadcast = (result: AuthorityResult | undefined): RoomSnapshot => {
  if (!result) {
    throw new Error('Missing authority result.');
  }
  const broadcasts = result.broadcasts;
  if (!broadcasts || broadcasts.length === 0) {
    throw new Error('Missing broadcasts.');
  }
  const first = broadcasts[0];
  if (!first) {
    throw new Error('Missing broadcast.');
  }
  return first;
};

const requireRoomState = (authority: RoomAuthority, roomId: string): RoomState => {
  const room = (authority as RoomAuthority & { readonly rooms: Map<ReturnType<typeof testRoomId>, RoomState> }).rooms.get(testRoomId(roomId));
  if (!room) {
    throw new Error(`Missing room ${roomId}.`);
  }
  return room;
};

const create = (gameId: RoomGameId, profileId: string, bankroll = 500, maxPlayers?: number): ClientMessage => ({
  type: 'create-room',
  gameId,
  roomName: `${gameId} room`,
  maxPlayers,
  profileId: testProfileId(profileId),
  profileName: profileId.toUpperCase(),
  bankroll,
});

const join = (gameId: RoomGameId, roomId: string, profileId: string, bankroll = 500, role: 'player' | 'spectator' = 'player'): ClientMessage => ({
  type: 'join-room',
  gameId,
  roomId: testRoomId(roomId),
  role,
  profileId: testProfileId(profileId),
  profileName: profileId.toUpperCase(),
  bankroll,
});

const claimSeat = (seatId: string): ClientMessage => ({ type: 'assign-seat', seatId: testRoomSeatId(seatId) });

const beat = (room: RoomSnapshot): GameSnapshot => room.game as GameSnapshot;
const blackjack = (room: RoomSnapshot): BlackjackTableSnapshot => room.game as BlackjackTableSnapshot;
const slots = (room: RoomSnapshot): SlotSnapshot => room.game as SlotSnapshot;
const roomStateForTest = (authority: RoomAuthority, roomId: string): RoomState => requireRoomState(authority, roomId);
const rigImmediateBeatRound = (authority: RoomAuthority, roomId: string): void => {
  const roomState = roomStateForTest(authority, roomId);
  if (roomState.model.kind !== 'beat-the-house') {
    throw new Error('Expected a Beat the House test room.');
  }
  roomState.model.game.restoreState({
    ...roomState.model.game.saveState(),
    shoe: createDeterministicBeatTheHouseShoe({
      dealOrder: [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'hearts' },
      ],
    }).saveState(),
  });
};

describe('per-game multiplayer protocol', () => {
  it('requires game-scoped create, list, and join messages', () => {
    expect(parseClientMessage({ type: 'request-data' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'heartbeat-ack', sentAt: Date.now() })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'authorize-profiles', profileTokens: [{ profileId: 'a', profileToken: 'profile-token' }] })).toMatchObject({
      ok: true,
    });
    expect(parseClientMessage({ type: 'authorize-admin', adminToken: 'admin-token' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'create-profile', profileName: 'Ada' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'house-advance', profileId: 'a' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'admin-bankroll', profileId: 'a', action: 'add', amount: 50 })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'list-rooms', gameId: 'blackjack' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'create-room', profileId: 'a', profileName: 'A', bankroll: 50 })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'join-room', gameId: 'blackjack', profileId: 'b', profileName: 'B', bankroll: 50 })).toMatchObject({
      ok: false,
    });
    expect(parseClientMessage({ type: 'select-game', gameId: 'beat-the-house' })).toMatchObject({ ok: false });
    expect(parseClientMessage(join('blackjack', 'abc123', 'b')).message).toMatchObject({ roomId: 'ABC123', gameId: 'blackjack', role: 'player' });
    expect(parseClientMessage({ type: 'blackjack-action', action: 'stand' }).ok).toBe(true);
    expect(parseClientMessage({ type: 'slots-ready', ready: true }).ok).toBe(true);
  });

  it('rejects malformed room and game action payloads without legacy fallbacks', () => {
    expect(parseClientMessage(null)).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'list-rooms', gameId: 'missing' })).toMatchObject({ ok: false, error: 'Game id is invalid.' });
    expect(parseClientMessage({ type: 'list-rooms', gameId: 'slots:house-of-sevens' })).toMatchObject({ ok: false, error: 'Game id is invalid.' });
    expect(parseClientMessage({ type: 'create-room', gameId: 'blackjack', profileId: 'a', profileName: 'A', bankroll: '50' })).toMatchObject({
      ok: false,
    });
    expect(parseClientMessage({ type: 'create-room', gameId: 'blackjack', profileId: 'a', profileName: 'A', bankroll: 50 })).toMatchObject({
      ok: true,
      message: { roomName: undefined, maxPlayers: undefined, allowSpectators: undefined },
    });
    expect(
      parseClientMessage({
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
    expect(parseClientMessage({ type: 'join-room', gameId: 'blackjack', profileId: 'a', profileName: 'A', bankroll: 50 })).toMatchObject({
      ok: false,
    });
    expect(parseClientMessage({ type: 'assign-seat', seatId: 'middle' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'assign-seat', seatId: 'seat-2' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'place-chip', seatId: 'left', betType: 'bad', amount: 25 })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'player-action', action: 'fold' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'blackjack-deal', wager: '25' })).toMatchObject({ ok: false });
    for (const action of ['hit', 'stand', 'double', 'split', 'insurance', 'new-hand']) {
      expect(parseClientMessage({ type: 'blackjack-action', action })).toMatchObject({ ok: true });
    }
    expect(parseClientMessage({ type: 'blackjack-action', action: 'fold' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'slots-wager', wager: '10' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'slots-ready', ready: 'yes' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'slots-spin' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'slots-pick-bonus' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'admin-debug', action: 'force-settle', reason: 'test' })).toMatchObject({ ok: true });
    expect(parseClientMessage({ type: 'admin-debug', action: 'cheat' })).toMatchObject({ ok: false });
    expect(parseClientMessage({ type: 'not-real' })).toMatchObject({ ok: false });
    expect(decodeServerMessage('{bad')).toBeUndefined();
  });

  it('round-trips unversioned protocol messages and rejects obsolete version fields', () => {
    const message = join('slots:thai-princess', 'ROOM01', 'alice', 300, 'spectator');
    const room = new RoomAuthority().handle('a', create('beat-the-house', 'alice')).direct;
    expect(parseClientMessage(JSON.parse(encodeMessage(message))).message).toEqual(message);
    expect(decodeServerMessage('{"type":"profile-credentials","profileId":"alice","profileToken":"token"}')).toMatchObject({
      type: 'profile-credentials',
      profileId: 'alice',
    });
    expect(decodeServerMessage('{"type":"profile-access","ownedProfileIds":["alice"]}')).toMatchObject({
      type: 'profile-access',
      ownedProfileIds: ['alice'],
    });
    expect(decodeServerMessage('{"type":"admin-access","authorized":true}')).toMatchObject({ type: 'admin-access', authorized: true });
    expect(decodeServerMessage(JSON.stringify({ type: 'room-closed', roomId: 'ROOM42', gameId: 'beat-the-house', reason: 'profile-deleted' }))).toMatchObject({
      type: 'room-closed',
      roomId: 'ROOM42',
      gameId: 'beat-the-house',
      reason: 'profile-deleted',
    });
    expect(decodeServerMessage('{"type":"room-closed","roomId":"ROOM42","gameId":"missing","reason":"profile-deleted"}')).toBeUndefined();
    expect(decodeServerMessage(JSON.stringify({ type: 'room-state', room }))?.type).toBe('room-state');
    expect(JSON.stringify(room)).toContain('cardsRemaining');
    expect(JSON.stringify(room)).not.toContain('remainingCards');
    expect(JSON.stringify(room)).not.toContain('cutThresholdCardsDealt');
    expect(JSON.stringify(room)).not.toContain('shufflePending');
    expect(JSON.stringify(room)).not.toContain('holeCard');
    expect(decodeServerMessage('{"type":"room-state"}')).toBeUndefined();
    expect(decodeServerMessage('{"version":2,"type":"room-state"}')).toBeUndefined();
    expect(serverMessageSchema.safeParse({ type: 'room-state', room: { ...room, beat: { rebetSeatIds: ['seat-1'] } } }).success).toBe(false);

    const invalidSettlement = {
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
    const beatRoom = requireDirect(authority.handle('a', create('beat-the-house', 'alice')));
    const blackjackRoom = requireDirect(authority.handle('b', create('blackjack', 'bob')));

    expect(authority.handle('viewer', { type: 'list-rooms', gameId: 'beat-the-house' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      beatRoom.roomId,
      mainBeatRoomId,
    ]);
    authority.handle('main', join('beat-the-house', mainBeatRoomId, 'main-player'));
    expect(authority.handle('viewer', { type: 'list-rooms', gameId: 'beat-the-house' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      beatRoom.roomId,
      mainBeatRoomId,
    ]);
    expect(authority.handle('viewer', { type: 'list-rooms', gameId: 'blackjack' }).roomList?.rooms.map((room) => room.roomId)).toEqual([blackjackRoom.roomId]);
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
    expect(authority.handle('viewer', { type: 'list-rooms', gameId: 'beat-the-house' }).roomList?.rooms.map((room) => room.roomId)).toEqual([mainBeatRoomId]);

    const joined = requireBroadcast(authority.handle('a', join('beat-the-house', mainBeatRoomId, 'alice', 500)));
    expect(joined.players).toEqual([]);
    expect(joined.spectators.map((player) => player.profileId)).toEqual(['alice']);
    const seated = requireBroadcast(authority.handle('a', claimSeat('left')));
    expect(seated.players.map((player) => player.profileId)).toEqual(['alice']);
    expect(seated.seats.find((seat) => seat.seatId === 'left')?.profileId).toBe('alice');

    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'start-round' });
    const consumedState = roomStateForTest(authority, mainBeatRoomId);
    if (consumedState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House main room.');
    }
    expect(consumedState.model.game.saveState().shoe.remainingCards.length).toBeLessThan(312);
    const afterLeave = requireBroadcast(authority.handle('a', { type: 'leave-room' }));

    expect(afterLeave.roomId).toBe(mainBeatRoomId);
    expect(afterLeave.players).toEqual([]);
    expect(afterLeave.spectators).toEqual([]);
    expect(afterLeave.status).toBe('waiting');
    expect(afterLeave.seats.every((seat) => !seat.profileId)).toBe(true);
    expect(beat(afterLeave).bets.left.main).toBe(0);
    const resetState = roomStateForTest(authority, mainBeatRoomId);
    if (resetState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House main room.');
    }
    expect(resetState.model.game.saveState().shoe.remainingCards).toHaveLength(312);
    expect(resetState.model.game.saveState().shoe.shufflePending).toBe(false);
    expect(authority.listRooms('beat-the-house').map((room) => room.roomId)).toContain(mainBeatRoomId);

    authority.handle('b', join('beat-the-house', mainBeatRoomId, 'bob', 500));
    const rejoined = requireBroadcast(authority.handle('b', claimSeat('left')));
    expect(rejoined.seats.find((seat) => seat.seatId === 'left')?.profileId).toBe('bob');
  });

  it('keeps Beat the House rooms at three seats with ownership, spectator, leave, and settlement protections', () => {
    const authority = new RoomAuthority();
    const created = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500, 99)));
    expect(created.maxPlayers).toBe(3);
    const roomId = created.roomId;
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
    authority.handle('s', join('beat-the-house', roomId, 'sue', 500, 'spectator'));
    authority.handle('a', claimSeat('left'));
    authority.handle('b', claimSeat('centre'));

    expect(authority.handle('s', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 }).error).toBe('Spectators cannot wager.');
    expect(authority.handle('b', claimSeat('left')).error).toBe('Release your current seat before claiming another one.');
    expect(authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'aceFlash', amount: 5 }).error).toBe(
      'Side bets need a main bet on the same hand.',
    );

    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'aceFlash', amount: 5 });
    const wagered = requireDirect(authority.handle('a', { type: 'resync' }));
    expect(beat(wagered).bets.left.main).toBe(25);
    expect(beat(wagered).bets.left.aceFlash).toBe(5);

    const afterLeave = requireBroadcast(authority.handle('b', { type: 'leave-room' }));
    expect(afterLeave.players.map((player) => player.profileId)).toEqual(['alice']);
    expect(authority.handle('b', { type: 'place-chip', seatId: 'right', betType: 'main', amount: 25 }).error).toBe('Join a game room first.');
  });

  it('keeps profile bankroll central on the server instead of trusting stale client balances', () => {
    const authority = new RoomAuthority();
    authority.handle('a', create('beat-the-house', 'alice', 467));
    const room = requireBroadcast(authority.handle('a', claimSeat('left')));

    expect(room.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(467);
    expect(beat(room).bankroll).toBe(467);
    expect(beat(room).shoe).toEqual({ cardsRemaining: 312, cardsDealt: 0, totalCards: 312, cutCardReached: false });
    expect(Object.keys(beat(room).dealer)).not.toContain('holeCard');
    expect(JSON.stringify(room)).not.toContain('remainingCards');
    expect(JSON.stringify(room)).not.toContain('deck');
    expect(JSON.stringify(room)).not.toContain('cutThresholdCardsDealt');
    expect(JSON.stringify(room)).not.toContain('shufflePending');

    const wagered = requireBroadcast(authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 }));
    expect(wagered.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(442);

    const rejoined = requireBroadcast(authority.handle('fresh-a', join('beat-the-house', room.roomId, 'alice', 2169)));
    expect(rejoined.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(442);
    expect(beat(rejoined).bankroll).toBe(442);

    authority.handle('fresh-a', { type: 'leave-room' });
    const recreated = requireDirect(authority.handle('again-a', create('beat-the-house', 'alice', 2169)));
    expect(recreated.spectators.find((player) => player.profileId === 'alice')?.bankroll).toBe(442);
    expect(beat(recreated).bankroll).toBe(0);
  });

  it('rejects cumulative side wagers without changing profile bankroll, readiness, or room state', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 1000))).roomId;
    authority.handle('b', join('beat-the-house', roomId, 'bob', 1000));
    authority.handle('a', claimSeat('left'));
    authority.handle('b', claimSeat('centre'));
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 5 });
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'aceFlash', amount: 5 });
    const ready = requireBroadcast(authority.handle('a', { type: 'start-round' }));
    const before = requireDirect(authority.handle('a', { type: 'resync' }));

    expect(ready.beat?.readyProfileIds).toEqual([testProfileId('alice')]);
    const rejected = authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'aceFlash', amount: 1 });

    expect(rejected.error).toBe('Side bets cannot exceed the main bet on the same hand.');
    expect(rejected.broadcasts).toEqual([]);
    expect(rejected.settlements).toEqual([]);
    const after = requireDirect(authority.handle('a', { type: 'resync' }));
    expect(beat(after).bets).toEqual(beat(before).bets);
    expect(beat(after).bankroll).toBe(beat(before).bankroll);
    expect(after.beat?.readyProfileIds).toEqual(before.beat?.readyProfileIds);
    expect(after.players.find((player) => player.profileId === testProfileId('alice'))?.bankroll).toBe(
      before.players.find((player) => player.profileId === testProfileId('alice'))?.bankroll,
    );
  });

  it('rejects racing seat claims and duplicate/stale Beat the House settlement attempts', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500))).roomId;
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));

    const aliceSeat = authority.handle('a', claimSeat('left'));
    authority.handle('b', claimSeat('centre'));
    const bobSeat = authority.handle('b', claimSeat('left'));
    expect(requireBroadcast(aliceSeat).seats.find((seat) => seat.seatId === 'left')?.profileId).toBe('alice');
    expect(bobSeat.error).toBe('Release your current seat before claiming another one.');

    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'start-round' });
    let result = authority.handle('b', { type: 'start-round' });
    for (let attempts = 0; result.settlements.length === 0 && attempts < 8; attempts += 1) {
      result = authority.handle('a', { type: 'player-action', action: 'stick' });
    }
    expect(result.settlements.length).toBeLessThanOrEqual(1);
    expect(authority.handle('a', { type: 'player-action', action: 'stick' }).settlements).toEqual([]);
  });

  it('supports Blackjack rooms with five seats, spectators, reconnect, and game-specific actions', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('blackjack', 'alice', 500))).roomId;
    authority.handle('a', claimSeat('seat-1'));
    ['bob', 'cory', 'dana', 'erin'].forEach((name, index) => authority.handle(`p${index}`, join('blackjack', roomId, name, 500)));
    ['seat-2', 'seat-3', 'seat-4', 'seat-5'].forEach((seatId, index) => authority.handle(`p${index}`, claimSeat(seatId)));
    authority.handle('extra', join('blackjack', roomId, 'frank', 500));
    expect(authority.handle('extra', claimSeat('seat-1')).error).toBe('Seat is already occupied.');
    expect(
      requireBroadcast(authority.handle('watch', join('blackjack', roomId, 'frank', 500, 'spectator'))).spectators.map((player) => player.profileId),
    ).toContain('frank');
    expect(authority.handle('watch', { type: 'blackjack-deal', wager: 25 }).error).toBe('Spectators cannot deal Blackjack.');

    const dealt = requireBroadcast(authority.handle('a', { type: 'blackjack-deal', wager: 25 }));
    expect(blackjack(dealt).seats.find((seat) => seat.profileId === 'alice')?.wager).toBe(25);
    expect(authority.handle('p0', { type: 'blackjack-action', action: 'hit' }).error).toBe('It is not your Blackjack turn.');

    const rejoined = authority.handle('fresh-a', join('blackjack', roomId, 'alice', 500));
    expect(requireBroadcast(rejoined).players.find((player) => player.profileId === 'alice')?.connectionId).toBe('fresh-a');
    expect(authority.handle('a', { type: 'blackjack-action', action: 'stand' }).error).toBe('Join a game room first.');
  });

  it('runs a true five-seat Blackjack table with shared dealer state and independent seat wagers', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('blackjack', 'alice', 500))).roomId;
    authority.handle('a', claimSeat('seat-1'));
    const joins = [
      ['b', 'bob', 20],
      ['c', 'cory', 30],
      ['d', 'dana', 40],
      ['e', 'erin', 50],
    ] as const;
    joins.forEach(([connectionId, profileId]) => authority.handle(connectionId, join('blackjack', roomId, profileId, 500)));
    ['seat-2', 'seat-3', 'seat-4', 'seat-5'].forEach((seatId, index) => authority.handle(joins[index]?.[0] ?? 'b', claimSeat(seatId)));
    const wagers = new Map([
      ['a', 10],
      ['b', 20],
      ['c', 30],
      ['d', 40],
      ['e', 50],
    ]);
    const settlements = [];
    for (const [connectionId, wager] of wagers) {
      const result = authority.handle(connectionId, { type: 'blackjack-deal', wager });
      settlements.push(...result.settlements);
    }

    let room = requireDirect(authority.handle('a', { type: 'resync' }));
    const table = blackjack(room);
    expect(table.dealerCards.length).toBe(2);
    expect(table.seats).toHaveLength(5);
    expect(table.seats.map((seat) => seat.wager)).toEqual([10, 20, 30, 40, 50]);
    expect(table.seats.every((seat) => seat.playerCards.length === 2 || seat.phase === 'settled')).toBe(true);
    expect(new Set(table.seats.map((seat) => seat.playerCards.map((card) => `${card.rank}-${card.suit}`).join(','))).size).toBeGreaterThan(1);

    const activeSeatId = table.activeSeatId;
    if (activeSeatId) {
      const wrongConnection = activeSeatId === 'seat-1' ? 'b' : 'a';
      expect(authority.handle(wrongConnection, { type: 'blackjack-action', action: 'hit' }).error).toBe('It is not your Blackjack turn.');
    }
    expect(requireBroadcast(authority.handle('watch', join('blackjack', roomId, 'watcher', 500, 'spectator'))).spectators).toHaveLength(1);
    expect(authority.handle('watch', { type: 'blackjack-action', action: 'stand' }).error).toBe('Spectators cannot act.');

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
      const result = authority.handle(connectionBySeat.get(seatId) ?? 'a', { type: 'blackjack-action', action: 'stand' });
      settlements.push(...result.settlements);
      const resultBroadcast = result.broadcasts?.[0];
      room = resultBroadcast ?? requireDirect(authority.handle('a', { type: 'resync' }));
    }

    expect(blackjack(room).phase).toBe('settled');
    expect(new Set(settlements.map((settlement) => settlement.profileId))).toEqual(new Set(['alice', 'bob', 'cory', 'dana', 'erin']));
    expect(settlements.map((settlement) => settlement.wagered).sort((left, right) => left - right)).toEqual([10, 20, 30, 40, 50]);
    expect(room.players.map((player) => player.bankroll).every((bankroll) => bankroll <= 600)).toBe(true);
  });

  it('supports Thai Princess shared Slots rooms with ready/wager/spin state and room-scoped isolation', () => {
    const authority = new RoomAuthority();
    const firstRoom = requireDirect(authority.handle('a', create('slots:thai-princess', 'alice', 500, 4)));
    const secondRoom = requireDirect(authority.handle('b', create('slots:thai-princess', 'bob', 500, 4)));
    authority.handle('c', join('slots:thai-princess', firstRoom.roomId, 'cory', 500));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-1'));
    authority.handle('c', claimSeat('seat-2'));

    expect(requireBroadcast(authority.handle('a', { type: 'slots-wager', wager: 15 })).slots?.wagersByProfileId[testProfileId('alice')]).toBe(15);
    authority.handle('c', { type: 'slots-wager', wager: 30 });
    expect(authority.handle('a', { type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
    authority.handle('a', { type: 'slots-ready', ready: true });
    authority.handle('c', { type: 'slots-ready', ready: true });
    const spun = requireBroadcast(authority.handle('a', { type: 'slots-spin' }));

    expect(slots(spun).themeId).toBe('thai-princess');
    expect(authority.handle('viewer', { type: 'list-rooms', gameId: 'slots:thai-princess' }).roomList?.rooms.map((room) => room.roomId)).toEqual([
      firstRoom.roomId,
      secondRoom.roomId,
    ]);
    expect(authority.handle('b', { type: 'resync' }).direct?.players.map((player) => player.profileId)).toEqual(['bob']);
    expect(authority.handle('c', { type: 'blackjack-deal', wager: 10 }).error).toBe('This action only applies to Blackjack rooms.');
  });

  it('settles Slots shared spins from one outcome with independent per-player wagers and duplicate protection', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('slots:thai-princess', 'alice', 500, 3))).roomId;
    authority.handle('b', join('slots:thai-princess', roomId, 'bob', 500));
    authority.handle('c', join('slots:thai-princess', roomId, 'cory', 500));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-2'));
    authority.handle('c', claimSeat('seat-3'));

    authority.handle('a', { type: 'slots-wager', wager: 5 });
    authority.handle('b', { type: 'slots-wager', wager: 10 });
    const wagered = requireBroadcast(authority.handle('c', { type: 'slots-wager', wager: 25 }));
    expect(wagered.slots?.wagersByProfileId).toEqual({ alice: 5, bob: 10, cory: 25 });
    expect(requireBroadcast(authority.handle('a', { type: 'slots-ready', ready: true })).slots?.readyProfileIds).toEqual(['alice']);
    authority.handle('b', { type: 'slots-ready', ready: true });
    expect(authority.handle('a', { type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
    authority.handle('c', { type: 'slots-ready', ready: true });

    const spun = authority.handle('b', { type: 'slots-spin' });
    let settled = spun;
    for (let picks = 0; picks < 4; picks += 1) {
      const settledBroadcast = settled.broadcasts?.[0];
      if (!settledBroadcast || slots(settledBroadcast).phase !== 'bonus') {
        break;
      }
      settled = authority.handle('b', { type: 'slots-pick-bonus' });
    }
    const room = requireBroadcast(settled);
    expect(slots(room).themeId).toBe('thai-princess');
    expect(settled.settlements.map((settlement) => settlement.wagered).sort((left, right) => left - right)).toEqual([5, 10, 25]);
    expect(new Set(settled.settlements.map((settlement) => settlement.profileId))).toEqual(new Set(['alice', 'bob', 'cory']));
    expect(room.slots?.readyProfileIds).toEqual([]);
    expect(room.slots?.returnedByProfileId).toBeDefined();
    expect(authority.handle('b', { type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
  });

  it('gates Beat the House deal and next round on all current players while ignoring spectators', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500))).roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
    authority.handle('b', claimSeat('centre'));
    authority.handle('watch', join('beat-the-house', roomId, 'watcher', 500, 'spectator'));
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    rigImmediateBeatRound(authority, roomId);

    const aliceReady = requireBroadcast(authority.handle('a', { type: 'start-round' }));
    expect(beat(aliceReady).phase).toBe('betting');
    expect(aliceReady.beat?.readyProfileIds).toEqual(['alice']);
    expect(aliceReady.beat?.readyCount).toBe(1);
    expect(aliceReady.beat?.playerCount).toBe(2);
    expect(authority.handle('watch', { type: 'start-round' }).error).toBe('Spectators cannot start rounds.');

    const bobReady = authority.handle('b', { type: 'start-round' });
    expect(beat(requireBroadcast(bobReady)).phase).toBe('roundOver');
    expect(requireBroadcast(bobReady).beat?.readyProfileIds).toEqual([]);
    expect(requireBroadcast(bobReady).beat?.nextRoundDeadlineAt).toEqual(expect.any(Number));

    const aliceNextReady = requireBroadcast(authority.handle('a', { type: 'next-round' }));
    expect(beat(aliceNextReady).phase).toBe('roundOver');
    expect(aliceNextReady.beat?.readyProfileIds).toEqual(['alice']);
    expect(authority.handle('watch', { type: 'next-round' }).error).toBe('Spectators cannot advance rounds.');

    const bobNextReady = requireBroadcast(authority.handle('b', { type: 'next-round' }));
    expect(beat(bobNextReady).phase).toBe('betting');
    expect(bobNextReady.beat?.readyProfileIds).toEqual([]);
    expect(bobNextReady.beat?.nextRoundDeadlineAt).toBeUndefined();
  });

  it('clears stale Beat the House readiness when wagers or player membership change', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500))).roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
    authority.handle('b', claimSeat('centre'));
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });

    expect(requireBroadcast(authority.handle('a', { type: 'start-round' })).beat?.readyProfileIds).toEqual(['alice']);
    expect(requireBroadcast(authority.handle('a', { type: 'place-tip', seatId: 'left', amount: 5 })).beat?.readyProfileIds).toEqual([]);

    authority.handle('a', { type: 'start-round' });
    authority.handle('c', join('beat-the-house', roomId, 'cory', 500));
    const corySeated = requireBroadcast(authority.handle('c', claimSeat('right')));
    expect(corySeated.beat?.readyProfileIds).toEqual([]);
  });

  it('advances Beat the House next round after the server-side deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const authority = new RoomAuthority();
    const timeoutResults: AuthorityResult[] = [];
    authority.setAsyncResultHandler((result) => timeoutResults.push(result));
    try {
      const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500))).roomId;
      authority.handle('a', claimSeat('left'));
      authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
      authority.handle('b', claimSeat('centre'));
      authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
      rigImmediateBeatRound(authority, roomId);

      authority.handle('a', { type: 'start-round' });
      const settled = requireBroadcast(authority.handle('b', { type: 'start-round' }));
      expect(beat(settled).phase).toBe('roundOver');
      expect(settled.beat?.nextRoundRemainingMs).toBe(20_000);
      const scheduledRoom = roomStateForTest(authority, roomId);
      if (scheduledRoom.model.kind !== 'beat-the-house' || !scheduledRoom.model.nextRoundTimer) {
        throw new Error('Expected an unrefed Beat the House next-round timer.');
      }
      expect(scheduledRoom.model.nextRoundTimer.hasRef()).toBe(false);

      vi.advanceTimersByTime(20_000);

      expect(timeoutResults).toHaveLength(1);
      expect(beat(requireBroadcast(timeoutResults[0])).phase).toBe('betting');
      expect(requireBroadcast(timeoutResults[0]).beat?.readyProfileIds).toEqual([]);
      expect(requireBroadcast(timeoutResults[0]).beat?.nextRoundDeadlineAt).toBeUndefined();
    } finally {
      authority.dispose();
      vi.useRealTimers();
    }
  });

  it('honors a configured Beat the House auto-advance window override', () => {
    vi.stubEnv('CASINO_BEAT_NEXT_ROUND_TIMEOUT_MS', '4000');
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const authority = new RoomAuthority();
    const timeoutResults: AuthorityResult[] = [];
    authority.setAsyncResultHandler((result) => timeoutResults.push(result));
    try {
      const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500))).roomId;
      authority.handle('a', claimSeat('left'));
      authority.handle('b', join('beat-the-house', roomId, 'bob', 500));
      authority.handle('b', claimSeat('centre'));
      authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
      rigImmediateBeatRound(authority, roomId);

      authority.handle('a', { type: 'start-round' });
      const settled = requireBroadcast(authority.handle('b', { type: 'start-round' }));
      expect(beat(settled).phase).toBe('roundOver');
      expect(settled.beat?.nextRoundRemainingMs).toBe(4_000);

      vi.advanceTimersByTime(4_000);

      expect(timeoutResults).toHaveLength(1);
      expect(beat(requireBroadcast(timeoutResults[0])).phase).toBe('betting');
      expect(requireBroadcast(timeoutResults[0]).beat?.nextRoundDeadlineAt).toBeUndefined();
    } finally {
      authority.dispose();
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it('covers room lifecycle edges, explicit seats, disabled spectators, admin reset, and closed-room cleanup', () => {
    const authority = new RoomAuthority();
    const privateRoom = requireDirect(
      authority.handle('a', {
        type: 'create-room',
        gameId: 'blackjack',
        profileId: testProfileId('alice'),
        profileName: 'ALICE',
        bankroll: 500,
        allowSpectators: false,
      }),
    );
    expect(authority.handle('watch', join('blackjack', privateRoom.roomId, 'watcher', 500, 'spectator')).error).toBe(
      'Spectators are not allowed in this room.',
    );
    expect(authority.handle('missing', join('blackjack', 'MISSING', 'ghost')).error).toBe('Room was not found.');

    const explicitSeatRoom = requireDirect(authority.handle('b', create('blackjack', 'bob', 500)));
    const joined = authority.handle('c', {
      type: 'join-room',
      gameId: 'blackjack',
      roomId: explicitSeatRoom.roomId,
      profileId: testProfileId('cory'),
      profileName: 'CORY',
      bankroll: 500,
      role: 'player',
      seatId: testRoomSeatId('seat-3'),
    });
    expect(requireBroadcast(joined).seats.find((seat) => seat.seatId === 'seat-3')?.profileId).toBe('cory');
    expect(authority.handle('c', { type: 'assign-seat', seatId: 'left' }).error).toBe('Seat does not belong to this game room.');

    expect(authority.handle('c', { type: 'admin-debug', action: 'reset-room' }).error).toBe('Only the room host can use room admin controls.');
    expect(requireBroadcast(authority.handle('b', { type: 'admin-debug', action: 'reset-room' })).revision).toBeGreaterThan(0);

    authority.handle('b', { type: 'leave-room' });
    authority.handle('c', { type: 'leave-room' });
    expect(authority.listRooms('blackjack').map((room) => room.roomId)).toEqual([privateRoom.roomId]);
    expect(authority.disconnect('nobody')).toEqual({ broadcasts: [], settlements: [] });

    const watchedRoom = requireDirect(authority.handle('host', create('beat-the-house', 'host', 500)));
    authority.handle('spectator', join('beat-the-house', watchedRoom.roomId, 'spectator', 500, 'spectator'));
    expect(requireBroadcast(authority.handle('host', { type: 'leave-room' })).status).toBe('waiting');
  });

  it('creates a fresh Beat the House shoe on a host room reset', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 500))).roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'start-round' });

    const consumedState = roomStateForTest(authority, roomId);
    if (consumedState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House room.');
    }
    expect(consumedState.model.game.saveState().shoe.remainingCards.length).toBeLessThan(312);

    const reset = requireBroadcast(authority.handle('a', { type: 'admin-debug', action: 'reset-room' }));
    const resetState = roomStateForTest(authority, roomId);
    if (resetState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House room.');
    }
    expect(reset.phase).toBe('betting');
    expect(beat(reset).shoe).toEqual({ cardsRemaining: 312, cardsDealt: 0, totalCards: 312, cutCardReached: false });
    expect(resetState.model.game.saveState().shoe.remainingCards).toHaveLength(312);
    expect(resetState.model.game.saveState().shoe.shufflePending).toBe(false);
  });

  it('covers Beat the House clear, rebet, turn, next-round, and wrong-game action branches', () => {
    const authority = new RoomAuthority();
    authority.handle('a', create('beat-the-house', 'alice', 500));
    authority.handle('a', claimSeat('left'));
    expect(authority.handle('a', { type: 'next-round' }).error).toBe('Room phase does not allow advancing rounds.');
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const cleared = requireBroadcast(authority.handle('a', { type: 'clear-bets' }));
    expect(beat(cleared).bets.left.main).toBe(0);

    expect(authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'matchPush', amount: 999 }).error).toBe(
      'Insufficient profile bankroll for that wager.',
    );
    expect(authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'invalid' as never, amount: 10 }).error).toBe('Bet is invalid.');
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'start-round' });
    expect(authority.handle('a', { type: 'clear-bets' }).error).toBe('Bets can only be cleared before the round starts.');
    expect(authority.handle('a', { type: 'rebet' }).error).toBe('Rebet is only available before the round starts.');
    expect(authority.handle('a', { type: 'start-round' }).error).toBe('Round is already in progress.');
    expect(authority.handle('ghost', { type: 'next-round' }).error).toBe('Join a game room first.');

    let settled = authority.handle('a', { type: 'player-action', action: 'stick' });
    for (let attempts = 0; attempts < 8; attempts += 1) {
      const broadcast = settled.broadcasts?.[0];
      if (!broadcast || beat(broadcast).phase === 'roundOver') {
        break;
      }
      settled = authority.handle('a', { type: 'player-action', action: 'stick' });
    }
    expect(requireBroadcast(authority.handle('a', { type: 'next-round' })).phase).toBe('betting');

    const blackjackRoom = requireDirect(authority.handle('b', create('blackjack', 'bob', 500)));
    expect(authority.handle('b', { type: 'clear-bets' }).error).toBe('This action only applies to Beat the House rooms.');
    expect(authority.handle('b', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 10 }).error).toBe(
      'Beat the House wagers are not valid in this room.',
    );
    expect(blackjackRoom.gameId).toBe('blackjack');
  });

  it('authorizes Beat the House dealer tips by seat and records tip ledger entries when the round starts', () => {
    const store = createMemoryServerDataStore();
    const authority = new RoomAuthority(store);
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 100))).roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('watch', join('beat-the-house', roomId, 'watcher', 100, 'spectator'));

    expect(authority.handle('watch', { type: 'place-tip', seatId: 'left', amount: 5 }).error).toBe('Spectators cannot tip the dealer.');
    expect(authority.handle('a', { type: 'place-tip', seatId: 'right', amount: 5 }).error).toBe('You can only tip from your own seat.');
    expect(authority.handle('a', { type: 'place-tip', seatId: 'left', amount: 999 }).error).toBe('Insufficient profile bankroll for that dealer tip.');

    const tipped = requireBroadcast(authority.handle('a', { type: 'place-tip', seatId: 'left', amount: 10 }));
    expect(beat(tipped).dealerTips.left).toBe(10);
    expect(tipped.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(90);

    const cleared = requireBroadcast(authority.handle('a', { type: 'clear-bets' }));
    expect(beat(cleared).dealerTips.left).toBe(0);
    expect(cleared.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(100);
    expect(store.snapshot().profileState.profiles.find((profile) => profile.id === 'alice')?.transactions).toEqual([]);

    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'place-tip', seatId: 'left', amount: 10 });
    authority.handle('a', { type: 'start-round' });

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
    expect(authority.handle('a', { type: 'start-round' }).error).toBe('Round is already in progress.');
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
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 100))).roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'place-tip', seatId: 'left', amount: 10 });
    const roomState = roomStateForTest(authority, roomId);
    if (roomState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House test room.');
    }
    roomState.model.game.restoreState({
      ...roomState.model.game.saveState(),
      shoe: createDeterministicBeatTheHouseShoe({
        dealOrder: [
          { rank: 'A', suit: 'spades' },
          { rank: 'K', suit: 'hearts' },
        ],
      }).saveState(),
    });

    const started = authority.handle('a', { type: 'start-round' });

    expect(beat(requireBroadcast(started)).phase).toBe('roundOver');
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
    const blackjackRoom = requireDirect(authority.handle('host', create('blackjack', 'host', 500, 1)));

    expect(
      authority.handle('joiner', {
        type: 'join-room',
        gameId: 'blackjack',
        roomId: blackjackRoom.roomId,
        profileId: testProfileId('joiner'),
        profileName: 'JOINER',
        bankroll: 500,
        role: 'player',
        seatId: 'left',
      }).error,
    ).toBe('Seat does not belong to this game room.');
    authority.handle('host', claimSeat('seat-1'));
    const roomState = roomStateForTest(authority, blackjackRoom.roomId);
    roomState.seats.clear();
    expect(authority.handle('host', { type: 'blackjack-deal', wager: 25 }).error).toBe('Claim a Blackjack seat before dealing.');
    expect(authority.handle('host', { type: 'blackjack-action', action: 'stand' }).error).toBe('Claim a Blackjack seat before acting.');
    expect(authority.handle('host', { type: 'slots-pick-bonus' }).error).toBe('This action only applies to Slots rooms.');

    const beatRoom = requireDirect(authority.handle('beat-host', create('beat-the-house', 'beat-host', 500)));
    authority.handle('beat-host', claimSeat('left'));
    authority.handle('beat-watch', join('beat-the-house', beatRoom.roomId, 'beat-watch', 500, 'spectator'));
    expect(authority.handle('beat-watch', { type: 'start-round' }).error).toBe('Spectators cannot start rounds.');
    expect(authority.handle('beat-watch', { type: 'next-round' }).error).toBe('Spectators cannot advance rounds.');
    expect(authority.handle('beat-host', { type: 'unsupported-room-action' } as never).error).toBe('Unsupported room action.');

    authority.handle('beat-host', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 10 });
    const beatState = roomStateForTest(authority, beatRoom.roomId);
    if (beatState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House test room.');
    }
    beatState.model.game.restoreState({
      ...beatState.model.game.saveState(),
      shoe: createDeterministicBeatTheHouseShoe({
        dealOrder: [
          { rank: '7', suit: 'spades' },
          { rank: '9', suit: 'hearts' },
          { rank: 'K', suit: 'clubs' },
        ],
      }).saveState(),
    });
    const deterministicRound = beatState.model.game.deal();
    expect(deterministicRound.activeHand).toBe('left');
    expect(authority.handle('beat-watch', { type: 'player-action', action: 'hit' }).error).toBe('Spectators cannot act.');
    expect(requireBroadcast(authority.handle('beat-host', { type: 'player-action', action: 'hit' })).gameId).toBe('beat-the-house');

    const slotsRoom = requireDirect(authority.handle('slots-host', create('slots:thai-princess', 'slots-host', 100, 2)));
    authority.handle('slots-host', claimSeat('seat-1'));
    expect(authority.handle('slots-host', { type: 'slots-ready', ready: true }).error).toBe('Set your Slots wager before readying.');
    expect(authority.handle('slots-host', { type: 'clear-bets' }).error).toBe('This action only applies to Beat the House rooms.');
    expect(slotsRoom.gameId).toBe('slots:thai-princess');
  });

  it('scopes Beat the House clear and rebet to the acting player seat', () => {
    const store = createMemoryServerDataStore();
    const authority = new RoomAuthority(store);
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 1000))).roomId;
    authority.handle('a', claimSeat('left'));
    authority.handle('b', join('beat-the-house', roomId, 'bob', 1000));
    authority.handle('b', claimSeat('right'));
    authority.handle('watch', join('beat-the-house', roomId, 'watcher', 1000, 'spectator'));
    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    const wagered = requireBroadcast(authority.handle('b', { type: 'place-chip', seatId: 'right', betType: 'main', amount: 40 }));
    expect(wagered.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(975);
    expect(wagered.players.find((player) => player.profileId === 'bob')?.bankroll).toBe(960);
    expect(authority.handle('watch', { type: 'clear-bets' }).error).toBe('Spectators cannot clear bets.');

    const cleared = requireBroadcast(authority.handle('a', { type: 'clear-bets' }));

    expect(beat(cleared).bets.left.main).toBe(0);
    expect(beat(cleared).bets.right.main).toBe(40);
    expect(cleared.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(1000);
    expect(cleared.players.find((player) => player.profileId === 'bob')?.bankroll).toBe(960);
    expect(authority.handle('a', { type: 'clear-bets' }).error).toBe('You do not have bets to clear.');
    expect(authority.handle('watch', { type: 'rebet' }).error).toBe('Spectators cannot rebet.');

    authority.handle('a', { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 });
    authority.handle('a', { type: 'start-round' });
    let room = requireBroadcast(authority.handle('b', { type: 'start-round' }));
    for (let attempts = 0; beat(room).phase !== 'roundOver' && attempts < 8; attempts += 1) {
      const activeHand = beat(room).activeHand;
      const connectionId = activeHand === 'right' ? 'b' : 'a';
      const acted = authority.handle(connectionId, { type: 'player-action', action: 'stick' });
      if (acted.error) {
        throw new Error(acted.error);
      }
      room = requireBroadcast(acted);
    }
    expect(beat(room).phase).toBe('roundOver');
    authority.handle('a', { type: 'next-round' });
    const nextRound = requireBroadcast(authority.handle('b', { type: 'next-round' }));
    expect(beat(nextRound).rebetAmounts).toMatchObject({ left: 25, right: 40 });
    expect(nextRound.beat?.rebetSeatIds).toEqual(['left', 'right']);
    store.setProfileBankroll(testProfileId('bob'), 1);
    const lowBobBankroll = requireBroadcast(authority.reconcileProfiles('test bankroll update'));
    expect(lowBobBankroll.players.find((player) => player.profileId === 'bob')?.bankroll).toBe(1);
    expect(authority.handle('b', { type: 'rebet' }).error).toBe('Need £40 to rebet.');
    authority.handle('b', { type: 'leave-room' });
    authority.handle('c', join('beat-the-house', roomId, 'cory', 1));
    const reseated = requireBroadcast(authority.handle('c', claimSeat('right')));
    const aliceBeforeRebetPlayer = reseated.players.find((player) => player.profileId === 'alice');
    if (!aliceBeforeRebetPlayer) {
      throw new Error('Missing alice player.');
    }
    const aliceBeforeRebet = aliceBeforeRebetPlayer.bankroll;
    expect(reseated.players.find((player) => player.profileId === 'cory')?.bankroll).toBe(1);
    expect(reseated.beat?.rebetSeatIds).toEqual(['left']);

    const aliceRebet = requireBroadcast(authority.handle('a', { type: 'rebet' }));

    expect(beat(aliceRebet).bets.left.main).toBe(25);
    expect(beat(aliceRebet).bets.right.main).toBe(0);
    expect(aliceRebet.players.find((player) => player.profileId === 'alice')?.bankroll).toBe(aliceBeforeRebet - 25);
    expect(aliceRebet.players.find((player) => player.profileId === 'cory')?.bankroll).toBe(1);
    expect(authority.handle('a', { type: 'rebet' }).error).toBe('Clear your current bets before rebetting.');
    expect(authority.handle('c', { type: 'rebet' }).error).toBe('No previous bet saved for your seat.');
    const afterBobError = requireDirect(authority.handle('a', { type: 'resync' }));
    expect(beat(afterBobError).bets.left.main).toBe(25);
    expect(beat(afterBobError).bets.right.main).toBe(0);
  });

  it('does not advertise or execute an invalid saved side-bet rebet', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('beat-the-house', 'alice', 1000))).roomId;
    authority.handle('a', claimSeat('left'));
    const roomState = roomStateForTest(authority, roomId);
    if (roomState.model.kind !== 'beat-the-house') {
      throw new Error('Expected a Beat the House room.');
    }
    const saved = roomState.model.game.saveState();
    roomState.model.game.restoreState({
      ...saved,
      lastBets: {
        ...saved.bets,
        left: { ...saved.bets.left, main: 5, aceFlash: 6 },
      },
    });
    roomState.lastBeatBetOwners = { left: testProfileId('alice') };
    roomState.model.readyPhase = 'betting';
    roomState.model.readyProfileIds.add(testProfileId('alice'));
    const before = requireDirect(authority.handle('a', { type: 'resync' }));

    expect(before.beat?.rebetSeatIds).toEqual([]);
    const rejected = authority.handle('a', { type: 'rebet' });

    expect(rejected.error).toBe('No previous bet saved for your seat.');
    expect(rejected.broadcasts).toEqual([]);
    expect(rejected.settlements).toEqual([]);
    const after = requireDirect(authority.handle('a', { type: 'resync' }));
    expect(beat(after).bets).toEqual(beat(before).bets);
    expect(beat(after).bankroll).toBe(beat(before).bankroll);
    expect(after.beat?.readyProfileIds).toEqual(before.beat?.readyProfileIds);
    expect(after.players.find((player) => player.profileId === testProfileId('alice'))?.bankroll).toBe(
      before.players.find((player) => player.profileId === testProfileId('alice'))?.bankroll,
    );
  });

  it('covers Blackjack action branches, settlement, and reset behaviour', () => {
    const authority = new RoomAuthority();
    const roomId = requireDirect(authority.handle('a', create('blackjack', 'alice', 500))).roomId;
    authority.handle('b', join('blackjack', roomId, 'bob', 500));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-2'));

    expect(authority.handle('a', { type: 'blackjack-deal', wager: 999 }).error).toBe('Insufficient profile bankroll for that wager.');
    const dealt = requireBroadcast(authority.handle('a', { type: 'blackjack-deal', wager: 25 }));
    expect(blackjack(dealt).phase).toBe('betting');
    authority.handle('b', { type: 'blackjack-deal', wager: 30 });
    const table = requireDirect(authority.handle('a', { type: 'resync' }));
    expect(blackjack(table).phase === 'playing' || blackjack(table).phase === 'settled').toBe(true);
    const duplicateDeal = authority.handle('a', { type: 'blackjack-deal', wager: 25 });
    expect(Boolean(duplicateDeal.error) || duplicateDeal.broadcasts.length > 0).toBe(true);

    const activeAfterDeal = blackjack(requireDirect(authority.handle('a', { type: 'resync' }))).activeSeatId;
    const hit = activeAfterDeal ? authority.handle(activeAfterDeal === 'seat-2' ? 'b' : 'a', { type: 'blackjack-action', action: 'hit' }) : undefined;
    expect(hit ? hit.broadcasts.length + hit.settlements.length : 1).toBeGreaterThan(0);
    const activeBeforeStand = blackjack(requireDirect(authority.handle('a', { type: 'resync' }))).activeSeatId;
    const stand = activeBeforeStand ? authority.handle(activeBeforeStand === 'seat-2' ? 'b' : 'a', { type: 'blackjack-action', action: 'stand' }) : undefined;
    expect(stand ? stand.broadcasts.length : 1).toBeGreaterThan(0);
    for (let attempts = 0; attempts < 6 && blackjack(requireDirect(authority.handle('a', { type: 'resync' }))).phase !== 'settled'; attempts += 1) {
      const activeSeat = blackjack(requireDirect(authority.handle('a', { type: 'resync' }))).activeSeatId;
      authority.handle(activeSeat === 'seat-2' ? 'b' : 'a', { type: 'blackjack-action', action: 'stand' });
    }
    const reset = requireBroadcast(authority.handle('a', { type: 'blackjack-action', action: 'new-hand' }));
    expect(blackjack(reset).phase).toBe('betting');

    const lowBankrollRoom = requireDirect(authority.handle('low', create('blackjack', 'low', 25)));
    authority.handle('low', claimSeat('seat-1'));
    authority.handle('low', { type: 'blackjack-deal', wager: 25 });
    const lowDouble = authority.handle('low', { type: 'blackjack-action', action: 'double' });
    expect(Boolean(lowDouble.error) || lowDouble.broadcasts.length > 0).toBe(true);
    expect(lowBankrollRoom.gameId).toBe('blackjack');
  });

  it('covers Slots spectator, affordability, unready, bonus-pick, free-spin, and reset branches', () => {
    const authority = new RoomAuthority();
    expect(requireDirect(authority.handle('cap', create('slots:thai-princess', 'cap', 20, 99))).maxPlayers).toBe(4);
    const roomId = requireDirect(authority.handle('a', create('slots:thai-princess', 'alice', 20, 2))).roomId;
    authority.handle('b', join('slots:thai-princess', roomId, 'bob', 20));
    authority.handle('s', join('slots:thai-princess', roomId, 'sue', 20, 'spectator'));
    authority.handle('a', claimSeat('seat-1'));
    authority.handle('b', claimSeat('seat-2'));

    expect(authority.handle('s', { type: 'slots-wager', wager: 5 }).error).toBe('Spectators cannot wager.');
    expect(authority.handle('s', { type: 'slots-ready', ready: true }).error).toBe('Spectators cannot ready spins.');
    expect(authority.handle('s', { type: 'slots-spin' }).error).toBe('Spectators cannot spin.');
    expect(authority.handle('s', { type: 'slots-pick-bonus' }).error).toBe('Spectators cannot pick bonus prizes.');
    expect(authority.handle('a', { type: 'slots-wager', wager: 50 }).error).toBe('Insufficient profile bankroll for that wager.');

    authority.handle('a', { type: 'slots-wager', wager: 5 });
    authority.handle('b', { type: 'slots-wager', wager: 10 });
    authority.handle('a', { type: 'slots-ready', ready: true });
    authority.handle('a', { type: 'slots-ready', ready: false });
    expect(authority.handle('a', { type: 'slots-spin' }).error).toBe('Every room player must be ready before the shared spin.');
    authority.handle('a', { type: 'slots-ready', ready: true });
    authority.handle('b', { type: 'slots-ready', ready: true });
    const spun = requireBroadcast(authority.handle('a', { type: 'slots-spin' }));
    expect(slots(spun).themeId).toBe('thai-princess');
    expect(requireBroadcast(authority.handle('a', { type: 'slots-pick-bonus' })).gameId).toBe('slots:thai-princess');
    expect(requireBroadcast(authority.handle('a', { type: 'admin-debug', action: 'reset-room' })).slots?.readyProfileIds).toEqual([]);
  });
});
