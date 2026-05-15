import { describe, expect, it } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import { BeatControlsView } from '../../../src/app/views/BeatControlsView';

class FakeClassList {
  private readonly classes = new Set<string>();

  public toggle(className: string, force?: boolean): boolean {
    const enabled = force ?? !this.classes.has(className);
    if (enabled) {
      this.classes.add(className);
    } else {
      this.classes.delete(className);
    }
    return enabled;
  }

  public contains(className: string): boolean {
    return this.classes.has(className);
  }
}

const createButton = () => ({
  disabled: false,
  classList: new FakeClassList(),
});

const createElement = () => ({
  textContent: '',
  classList: new FakeClassList(),
});

const createElements = () => ({
  status: createElement(),
  onTable: createElement(),
  chipRail: createElement(),
  dealButton: createButton(),
  rebetButton: createButton(),
  clearButton: createButton(),
  nextButton: createButton(),
  hitButton: createButton(),
  stickButton: createButton(),
});

const createRoom = (game: GameSnapshot): RoomSnapshot => ({
  roomId: 'ROOM42',
  roomName: 'Beat Room',
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
  updatedAt: 1,
  players: [
    { connectionId: 'a', profileId: 'alice', profileName: 'Alice', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
    { connectionId: 'b', profileId: 'bob', profileName: 'Bob', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
  ],
  spectators: [],
  seats: [{ seatId: 'left', profileId: 'alice' }, { seatId: 'right', profileId: 'bob' }, { seatId: 'centre' }],
  game,
});

describe('BeatControlsView', () => {
  it('keeps local rebet availability on the game snapshot path', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = { ...base, canRebet: true };
    const elements = createElements();

    new BeatControlsView(elements).render(snapshot, true, () => undefined, true);

    expect(elements.rebetButton.disabled).toBe(false);
  });

  it('confirms queued local deal actions after the main bet appears', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      bets: {
        ...base.bets,
        left: { ...base.bets.left, main: 25 },
      },
    };
    const elements = createElements();
    const view = new BeatControlsView(elements);
    let confirmed = false;

    view.markPendingBet('main');
    view.queueStartRound();
    view.render(snapshot, true, () => {
      confirmed = true;
    });

    expect(confirmed).toBe(true);
    expect(elements.dealButton.disabled).toBe(false);
  });

  it('clears pending controls when the Beat the House snapshot leaves betting', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = { ...base, phase: 'roundOver' };
    const elements = createElements();
    const view = new BeatControlsView(elements);

    view.markPendingBet('main');
    view.render(snapshot, true, () => undefined);

    expect(elements.dealButton.disabled).toBe(true);
    expect(elements.nextButton.disabled).toBe(false);
  });

  it('uses the acting multiplayer seat for clear and rebet button availability', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      canRebet: false,
      rebetAmounts: { ...base.rebetAmounts, left: 25, right: 40 },
      bets: {
        ...base.bets,
        right: { ...base.bets.right, main: 40 },
      },
    };
    const room = createRoom(snapshot);
    const aliceElements = createElements();
    const bobElements = createElements();

    new BeatControlsView(aliceElements).render(snapshot, true, () => undefined, true, room, 'alice', 100);
    new BeatControlsView(bobElements).render(snapshot, true, () => undefined, true, room, 'bob', 100);

    expect(aliceElements.rebetButton.disabled).toBe(false);
    expect(aliceElements.clearButton.disabled).toBe(true);
    expect(aliceElements.clearButton.classList.contains('hidden')).toBe(true);
    expect(bobElements.rebetButton.disabled).toBe(true);
    expect(bobElements.clearButton.disabled).toBe(false);
  });
});
