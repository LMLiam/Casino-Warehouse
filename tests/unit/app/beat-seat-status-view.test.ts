import { describe, expect, it } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { AppElements } from '../../../src/app/dom/appElements/AppElements';
import { BeatSeatStatusView } from '../../../src/app/views/BeatSeatStatusView';

describe('BeatSeatStatusView', () => {
  it('marks tipped seats only while the round is active', () => {
    const statusLayer = {
      innerHTML: '',
      style: {},
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

    view.render(active, createRoom(active), 'alice');
    expect(statusLayer.innerHTML).toContain('dealer-tipped');

    view.render({ ...active, phase: 'roundOver' }, createRoom({ ...active, phase: 'roundOver' }), 'alice');
    expect(statusLayer.innerHTML).not.toContain('dealer-tipped');
  });
});

const createRoom = (game: GameSnapshot): RoomSnapshot => ({
  roomId: 'ROOM42',
  roomName: 'Beat Room',
  hostProfileId: 'alice',
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'in-progress',
  phase: 'playing',
  sessionId: 'session-1',
  revision: 1,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1,
  updatedAt: 1,
  players: [{ connectionId: 'a', profileId: 'alice', profileName: 'Alice', bankroll: 95, sessionStartBankroll: 100, role: 'player' }],
  spectators: [],
  seats: [{ seatId: 'left', profileId: 'alice' }, { seatId: 'centre' }, { seatId: 'right' }],
  game,
  beat: { rebetSeatIds: [] },
});

const appElementsTestDouble = (implementation: object): AppElements => implementation as AppElements;
