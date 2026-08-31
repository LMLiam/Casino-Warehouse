import { describe, expect, it } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import { BeatSeatStatusView } from '../../../src/app/views/BeatSeatStatusView';
import type { BeatSeatStatusViewElements } from '../../../src/app/views/BeatSeatStatusViewElements';
import { testConnectionId, testProfileId, testRoomId, testSessionId } from '../schemas/testIds';

const aliceId = testProfileId('alice');

describe('BeatSeatStatusView', () => {
  it('marks tipped seats only while the round is active', () => {
    const statusLayer = {
      innerHTML: '',
      style: { width: '', height: '', left: '', top: '' },
      querySelectorAll: () => [],
    };
    const elements = appElementsTestDouble({
      tableHost: { clientWidth: 1000, clientHeight: 600 },
      beatSeatStatus: statusLayer,
    });
    const base = new BeatTheHouseGame({ initialBankroll: 100 }).snapshot();
    const active: GameSnapshot = {
      ...base,
      phase: 'playing',
      dealerTips: { ...base.dealerTips, left: 5 },
    };
    const view = new BeatSeatStatusView(elements);

    view.render(active, createRoom(active), aliceId);
    expect(statusLayer.innerHTML).toContain('dealer-tipped');

    view.render({ ...active, phase: 'roundOver' }, createRoom({ ...active, phase: 'roundOver' }), aliceId);
    expect(statusLayer.innerHTML).not.toContain('dealer-tipped');
  });

  it('uses server Beat readiness instead of local wager state for seat labels', () => {
    const statusLayer = {
      innerHTML: '',
      style: { width: '', height: '', left: '', top: '' },
      querySelectorAll: () => [],
    };
    const elements = appElementsTestDouble({
      tableHost: { clientWidth: 1000, clientHeight: 600 },
      beatSeatStatus: statusLayer,
    });
    const base = new BeatTheHouseGame({ initialBankroll: 100 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      bets: { ...base.bets, left: { ...base.bets.left, main: 25 } },
    };

    new BeatSeatStatusView(elements).render(
      snapshot,
      { ...createRoom(snapshot), beat: { rebetSeatIds: [], readyProfileIds: [], readyCount: 0, playerCount: 1 } },
      aliceId,
    );
    expect(statusLayer.innerHTML).toContain('Wagered');

    new BeatSeatStatusView(elements).render(
      snapshot,
      { ...createRoom(snapshot), beat: { rebetSeatIds: [], readyProfileIds: [aliceId], readyCount: 1, playerCount: 1, readyPhase: 'betting' } },
      aliceId,
    );
    expect(statusLayer.innerHTML).toContain('Ready');
  });
});

const createRoom = (game: GameSnapshot): RoomSnapshot => ({
  roomId: testRoomId('ROOM42'),
  roomName: 'Beat Room',
  hostProfileId: aliceId,
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'in-progress',
  phase: 'playing',
  sessionId: testSessionId('session-1'),
  revision: 1,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1,
  updatedAt: 1,
  players: [{ connectionId: testConnectionId('a'), profileId: aliceId, profileName: 'Alice', bankroll: 95, sessionStartBankroll: 100, role: 'player' }],
  spectators: [],
  seats: [{ seatId: 'left', profileId: aliceId }, { seatId: 'centre' }, { seatId: 'right' }],
  game,
  beat: { rebetSeatIds: [], readyProfileIds: [], readyCount: 0, playerCount: 1 },
});

const appElementsTestDouble = (implementation: BeatSeatStatusViewElements): BeatSeatStatusViewElements => implementation;
