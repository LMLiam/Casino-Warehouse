import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlackjackTable, type BlackjackTableActionResult } from '../../../src/game/blackjackTable';
import { findSlotTheme } from '../../../src/game/catalog';
import { BeatTheHouseGame } from '../../../src/game/engine';
import { SlotsGame, type SlotSnapshot } from '../../../src/game/slots';
import type { GameSnapshot } from '../../../src/game/types';
import type { RoomPlayer } from '../../../src/multiplayer/protocol';
import { RoomAuthorityBase } from '../../../src/multiplayer/roomAuthorityBase';
import {
  compareRoomListOrder,
  createGameModel,
  createId,
  createRoomId,
  createServerManagedBeatRoom,
  roomPhase,
  safeBankroll,
  type RoomState,
} from '../../../src/multiplayer/roomAuthorityModel';

const player = (profileId: string): RoomPlayer => ({
  connectionId: `conn-${profileId}`,
  profileId,
  profileName: profileId.toUpperCase(),
  bankroll: 100,
  sessionStartBankroll: 100,
  role: 'player',
});

const room = (overrides: Partial<RoomState> = {}): RoomState => ({
  ...createServerManagedBeatRoom(),
  roomId: 'ROOM01',
  serverManaged: false,
  createdAt: 1,
  updatedAt: 1,
  players: new Map(),
  spectators: new Map(),
  ...overrides,
});

const randomIdPartSpace = 36 ** 6;
const generatedId = (value: number): string => value.toString(36).padStart(6, '0').toUpperCase();

class AuthorityHarness extends RoomAuthorityBase {
  public addPlayer(room: RoomState): void {
    this.addMember(room, 'conn-alice', 'player', 'alice', 'ALICE', 100);
  }

  public setMissingPlayerBankroll(room: RoomState): void {
    this.setPlayerBankroll(room, 'missing', 50);
  }

  public settleBeatFor(room: RoomState, snapshot: GameSnapshot) {
    return this.settleBeat(room, snapshot);
  }

  public applyBlackjackFor(room: RoomState, result: BlackjackTableActionResult) {
    return this.applyBlackjackSettlements(room, result);
  }

  public settleSlotsFor(room: RoomState, before: SlotSnapshot, snapshot: SlotSnapshot) {
    return this.settleSlots(room, before, snapshot);
  }
}

describe('room authority model helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('orders active rooms before inactive rooms in both comparison directions', () => {
    const active = room({ roomId: 'ACTIVE', players: new Map([['alice', player('alice')]]) });
    const inactive = room({ roomId: 'EMPTY' });

    expect(compareRoomListOrder(active, inactive)).toBe(-1);
    expect(compareRoomListOrder(inactive, active)).toBe(1);
  });

  it('orders user-managed rooms before server-managed rooms', () => {
    const serverManaged = room({ roomId: 'SERVER', serverManaged: true });
    const userManaged = room({ roomId: 'USER', serverManaged: false });

    expect(compareRoomListOrder(serverManaged, userManaged)).toBe(1);
    expect(compareRoomListOrder(userManaged, serverManaged)).toBe(-1);
  });

  it('retries generated room ids until an unused id is available', () => {
    const firstValue = 18_000;
    const secondValue = 24_000;
    const first = generatedId(firstValue);
    const second = generatedId(secondValue);
    const randomInt = vi.fn().mockReturnValueOnce(firstValue).mockReturnValueOnce(secondValue);

    expect(createRoomId(new Map([[first, room({ roomId: first })]]), randomInt)).toBe(second);
    expect(randomInt).toHaveBeenNthCalledWith(1, randomIdPartSpace);
    expect(randomInt).toHaveBeenNthCalledWith(2, randomIdPartSpace);
  });

  it('uses the first generated room id when it is unused', () => {
    const firstValue = 30_000;
    const first = generatedId(firstValue);
    const randomInt = vi.fn().mockReturnValueOnce(firstValue);

    expect(createRoomId(new Map(), randomInt)).toBe(first);
  });

  it('creates timestamped ids with secure injected integer source', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    expect(createId('session', () => 35)).toBe('session-rs-00000z');
  });

  it('normalizes bankrolls to non-negative whole credits', () => {
    expect(safeBankroll(12.9)).toBe(12);
    expect(safeBankroll(-5)).toBe(0);
    expect(safeBankroll(Number.NaN)).toBe(0);
  });

  it('derives slots bonus rooms as playing', () => {
    const model = createGameModel('slots:thai-princess', 100);
    if (model.kind !== 'slots') {
      throw new Error('Expected slots model.');
    }
    model.game.restore({ ...model.game.snapshot(), phase: 'bonus' });
    const slotsRoom = room({
      gameId: 'slots:thai-princess',
      model,
    });

    expect(roomPhase(slotsRoom)).toBe('playing');
  });

  it('adds player members and ignores bankroll updates for absent players', () => {
    const harness = new AuthorityHarness();
    const target = room();

    harness.addPlayer(target);
    harness.setMissingPlayerBankroll(target);

    expect(target.players.get('alice')).toMatchObject({ profileId: 'alice', role: 'player', bankroll: 100 });
    expect(target.spectators.has('alice')).toBe(false);
  });

  it('skips beat settlements that are already settled or have no claimed seat', () => {
    const harness = new AuthorityHarness();
    const target = room();
    const snapshot: GameSnapshot = {
      ...new BeatTheHouseGame({ initialBankroll: 100 }).snapshot(),
      summaries: [{ handId: 'left', mainResult: 'win', stake: 10, returned: 20, profit: 10, sideWins: [] }],
    };

    target.settledSessionIds.add(target.sessionId);
    expect(harness.settleBeatFor(target, snapshot)).toEqual([]);

    target.settledSessionIds.clear();
    expect(harness.settleBeatFor(target, snapshot)).toEqual([]);
  });

  it('skips blackjack settlements for wrong rooms and unclaimed seats', () => {
    const harness = new AuthorityHarness();
    const result: BlackjackTableActionResult = {
      snapshot: new BlackjackTable().snapshot([]),
      debit: 0,
      settlements: [{ seatId: 'seat-1', wagered: 10, returned: 20, profit: 10 }],
    };

    expect(harness.applyBlackjackFor(room(), result)).toEqual([]);
    expect(harness.applyBlackjackFor(room({ model: createGameModel('blackjack', 100), gameId: 'blackjack' }), result)).toEqual([]);
  });

  it('skips duplicate slots settlements', () => {
    const harness = new AuthorityHarness();
    const baseSnapshot = new SlotsGame({ theme: findSlotTheme('slots:thai-princess') }).snapshot();
    const before: SlotSnapshot = { ...baseSnapshot, freeSpinsRemaining: 0 };
    const snapshot: SlotSnapshot = {
      ...baseSnapshot,
      phase: 'spun',
      returned: 10,
      reels: ['princess', 'lotus', 'elephant'],
      bonusPicksRemaining: 0,
    };
    const target = room({ gameId: 'slots:thai-princess', model: createGameModel('slots:thai-princess', 100) });

    if (target.model.kind !== 'slots') {
      throw new Error('Expected slots model.');
    }
    target.model.settledSpinKeys.add(`${target.sessionId}:10:princess-lotus-elephant:0`);

    expect(harness.settleSlotsFor(target, before, snapshot)).toEqual([]);
  });
});
